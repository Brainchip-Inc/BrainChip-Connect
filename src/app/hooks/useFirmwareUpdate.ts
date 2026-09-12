import { pick } from '@react-native-documents/picker';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import bleService from '../../services/ble/bleManager';
import {
  getTrustedKeyHash,
  rememberTrustedKeyHash,
} from '../../services/firmware/trustedKeyStorage';
import { useBleCommandStore } from '../store/useBleCommandStore';
import { useBleStore } from '../store/useBleStore';
import { useFirmwareStore } from '../store/useFirmwareStore';

/** Firmware the user picked, with what its header says about it. */
export interface SelectedFirmware {
  name: string;
  path: string;
  sizeBytes: number;
  version: string;
  keyHash: string | null;
}

/** A picked file signed with a different key than this board last accepted. */
export interface SigningKeyWarning {
  fileKeyHash: string;
  boardKeyHash: string;
}

/**
 * Where an update has got to, and how it ended.
 *
 * The three failing endings are deliberately distinct: `rejected` is the board
 * refusing to run firmware it accepted the transfer of, `failed` is the
 * transfer itself going wrong, and `unconfirmed` is the app being unable to
 * find out either way.
 */
export type FirmwareUpdateStage =
  | { kind: 'idle' }
  | { kind: 'sending'; percent: number }
  | { kind: 'restarting' }
  | { kind: 'checking' }
  | { kind: 'installed'; version: string }
  | { kind: 'rejected'; runningVersion: string | null }
  | { kind: 'unconfirmed' }
  | { kind: 'failed'; detail: string };

const BUSY_STAGES = ['sending', 'restarting', 'checking'];

/**
 * Copy a picked file into the app's cache under its own name.
 *
 * The picker hands back a URI that may not survive the update, so the file is
 * given a stable path first.
 *
 * @param sourceUri - URI the picker returned.
 * @param fileName - Name to keep it under.
 * @returns The cached path.
 */
const cacheFirmwareFile = async (
  sourceUri: string,
  fileName: string,
): Promise<string> => {
  const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  if (await RNFS.exists(localPath)) {
    await RNFS.unlink(localPath);
  }
  await RNFS.copyFile(sourceUri.replace('file://', ''), localPath);

  return localPath;
};

/**
 * Owns picking a firmware file, warning about its signing key, running the
 * update, and reporting what the board actually did with it.
 *
 * Both firmware screens drive this, so the wording and the state machine
 * cannot drift apart between them.
 */
export const useFirmwareUpdate = () => {
  const { connectedDevice } = useBleStore();
  const deviceSerial = useBleCommandStore(state => state.deviceSerial);

  const [selected, setSelected] = useState<SelectedFirmware | null>(null);
  const [keyWarning, setKeyWarning] = useState<SigningKeyWarning | null>(null);
  const [stage, setStage] = useState<FirmwareUpdateStage>({ kind: 'idle' });

  const clearSelection = useCallback(() => {
    setSelected(null);
    setKeyWarning(null);
  }, []);

  const browseForFirmware = useCallback(async () => {
    clearSelection();
    setStage({ kind: 'idle' });

    let localPath: string;
    let fileName: string;

    try {
      const [result] = await pick({
        allowMultiSelection: false,
        type: Platform.select({ ios: ['public.data'], android: ['*/*'] }),
        copyTo: 'cachesDirectory',
      });

      fileName = result.name ?? 'firmware.bin';
      const lowerName = fileName.toLowerCase();
      if (!lowerName.endsWith('.bin') && !lowerName.endsWith('.zip')) {
        Alert.alert(
          'Invalid File',
          'Please select a .bin or .zip firmware file',
        );
        return;
      }

      const sourceUri =
        (result as { fileCopyUri?: string }).fileCopyUri ?? result.uri;
      if (!sourceUri) {
        Alert.alert('Invalid file path');
        return;
      }

      localPath = await cacheFirmwareFile(sourceUri, fileName);
    } catch (error: any) {
      if (error?.message !== 'User cancelled the picker') {
        Alert.alert('File selection failed');
      }
      return;
    }

    try {
      const image = await bleService.readFirmwareImage(localPath);
      const stat = await RNFS.stat(localPath);

      setSelected({
        name: fileName,
        path: localPath,
        sizeBytes: Number(stat.size),
        version: image.version,
        keyHash: image.keyHash,
      });

      const boardKeyHash = deviceSerial
        ? await getTrustedKeyHash(deviceSerial)
        : null;

      if (image.keyHash && boardKeyHash && image.keyHash !== boardKeyHash) {
        setKeyWarning({ fileKeyHash: image.keyHash, boardKeyHash });
      }
    } catch (error: any) {
      Alert.alert(
        'Invalid File',
        error?.message ?? 'This file could not be read as firmware.',
      );
    }
  }, [clearSelection, deviceSerial]);

  const startUpdate = useCallback(async () => {
    if (!selected || !connectedDevice?.id) {
      Alert.alert(
        'Installation Failed',
        'No device connected or firmware selected',
      );
      return;
    }

    if (!(await bleService.isDeviceConnected(connectedDevice.id))) {
      Alert.alert('Device disconnected');
      return;
    }

    setKeyWarning(null);
    setStage({ kind: 'sending', percent: 0 });

    try {
      const outcome = await bleService.performFota(
        connectedDevice.id,
        selected.path,
        {
          expectedSerial: deviceSerial,
          onProgress: percent => setStage({ kind: 'sending', percent }),
          onPhase: phase => {
            if (phase === 'restarting') {
              setStage({ kind: 'restarting' });
            }
            if (phase === 'checking') {
              setStage({ kind: 'checking' });
            }
          },
        },
      );

      if (outcome.status === 'installed') {
        if (deviceSerial && selected.keyHash) {
          await rememberTrustedKeyHash(deviceSerial, selected.keyHash);
        }
        useFirmwareStore.getState().setInstalledBuild({
          title: selected.name,
          description: 'Installed from a local file',
          version: outcome.version,
          size: `${(selected.sizeBytes / 1024).toFixed(2)} KB`,
          useCases: ['Local Firmware'],
        });
        clearSelection();
        setStage({ kind: 'installed', version: outcome.version });
        return;
      }

      if (outcome.status === 'rejected') {
        setStage({
          kind: 'rejected',
          runningVersion: outcome.runningVersion,
        });
        return;
      }

      setStage({ kind: 'unconfirmed' });
    } catch (error: any) {
      setStage({
        kind: 'failed',
        detail: error?.message ?? 'The firmware update did not complete.',
      });
    }
  }, [clearSelection, connectedDevice, deviceSerial, selected]);

  return {
    selected,
    stage,
    keyWarning,
    isBusy: BUSY_STAGES.includes(stage.kind),
    browseForFirmware,
    startUpdate,
    clearSelection,
  };
};
