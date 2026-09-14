import { pick } from '@react-native-documents/picker';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import bleService from '../../services/ble/bleManager';
import {
  getTrustedKeyHash,
  rememberTrustedKeyHash,
} from '../../services/firmware/trustedKeyStorage';
import {
  FirmwareUpdateEnding,
  FirmwareUpdateStage,
  SelectedFirmware,
  SigningKeyWarning,
} from '../../types/firmwareUpdate';
import { useBleCommandStore } from '../store/useBleCommandStore';
import { useBleStore } from '../store/useBleStore';
import { useFirmwareStore } from '../store/useFirmwareStore';
import BleConnectionHelper from '../utils/BleConnectionHelper';

/**
 * Put the app's connection state back in step with the radio.
 *
 * An update ends holding the board it reconnected to, or holding nothing at
 * all, and which of the two it is cannot be read off the ending: a board that
 * drops mid-upload and one that refuses the image both end in a failure. So
 * the radio is asked, and the board is given up only when it really is gone.
 * Nothing else will correct it, because the disconnect that happens during an
 * update is deliberately swallowed while one is running.
 */
const forgetBoardUnlessStillConnected = async () => {
  const boardId = useBleStore.getState().connectedDevice?.id;

  if (!boardId || !(await bleService.isDeviceConnected(boardId))) {
    BleConnectionHelper.markConnectionClosed();
  }
};

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
 * cannot drift apart between them. One modal follows the whole update, from
 * the first byte sent to the answer the board gives once it is back, and the
 * ending is the last thing it shows rather than a separate announcement.
 */
export const useFirmwareUpdate = () => {
  const deviceSerial = useBleCommandStore(state => state.deviceSerial);
  const connectedDevice = useBleStore(state => state.connectedDevice);

  const [selected, setSelected] = useState<SelectedFirmware | null>(null);
  const [keyWarning, setKeyWarning] = useState<SigningKeyWarning | null>(null);
  const [stage, setStage] = useState<FirmwareUpdateStage>({ kind: 'idle' });

  const clearSelection = useCallback(() => {
    setSelected(null);
    setKeyWarning(null);
  }, []);

  const browseForFirmware = useCallback(async () => {
    clearSelection();

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
    const deviceId = useBleStore.getState().connectedDevice?.id;
    if (!selected || !deviceId) {
      Alert.alert(
        'Installation Failed',
        'No device connected or firmware selected',
      );
      return;
    }

    if (!(await bleService.isDeviceConnected(deviceId))) {
      Alert.alert('Device disconnected');
      return;
    }

    setKeyWarning(null);
    setStage({ kind: 'sending', percent: 0 });

    let ending: FirmwareUpdateEnding;

    try {
      const outcome = await bleService.performFota(deviceId, selected.path, {
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
      });

      ending = outcome;

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
      }
    } catch (error: any) {
      ending = {
        status: 'failed',
        detail: error?.message ?? 'The firmware update did not complete.',
      };
    }

    await forgetBoardUnlessStillConnected();
    setStage({ kind: 'done', ending });
  }, [clearSelection, deviceSerial, selected]);

  const dismissOutcome = useCallback(() => setStage({ kind: 'idle' }), []);

  const isBusy = stage.kind !== 'idle';

  return {
    selected,
    stage,
    keyWarning,
    isBusy,
    canInstall: Boolean(selected) && Boolean(connectedDevice) && !isBusy,
    browseForFirmware,
    startUpdate,
    dismissOutcome,
  };
};
