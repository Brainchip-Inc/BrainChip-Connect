import { pick } from '@react-native-documents/picker';
import { useCallback } from 'react';
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
import { useFirmwareUpdateStore } from '../store/useFirmwareUpdateStore';
import BleConnectionHelper from '../utils/BleConnectionHelper';

const BUSY_STAGES = ['sending', 'restarting', 'checking'];
const FINISHED_STAGES = ['installed', 'rejected', 'unconfirmed', 'failed'];

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
 * cannot drift apart between them. The state itself lives in a store rather
 * than in the screen, so an update that outlasts the screen it was started
 * from still has its outcome to show when the user comes back.
 */
export const useFirmwareUpdate = () => {
  const deviceSerial = useBleCommandStore(state => state.deviceSerial);
  const {
    selected,
    keyWarning,
    stage,
    setSelected,
    setKeyWarning,
    setStage,
    reset,
  } = useFirmwareUpdateStore();

  const browseForFirmware = useCallback(async () => {
    reset();

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
  }, [deviceSerial, reset, setKeyWarning, setSelected]);

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

    // Only the board itself can say whether it took the whole image, and it
    // says so before it is asked to install it. That is what separates a
    // transfer that never landed from one the board then refused.
    let boardStoredImage = false;

    try {
      const outcome = await bleService.performFota(deviceId, selected.path, {
        expectedSerial: deviceSerial,
        onProgress: percent => setStage({ kind: 'sending', percent }),
        onPhase: phase => {
          if (phase === 'installing') {
            boardStoredImage = true;
          }
          if (phase === 'restarting') {
            setStage({ kind: 'restarting' });
          }
          if (phase === 'checking') {
            setStage({ kind: 'checking' });
          }
        },
      });

      BleConnectionHelper.markConnectionClosed();

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
        setSelected(null);
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

      setStage({ kind: 'unconfirmed', reason: outcome.reason });
    } catch (error: any) {
      setStage({
        kind: 'failed',
        failedWhile: boardStoredImage ? 'installing' : 'sending',
        detail: error?.message ?? 'The firmware update did not complete.',
      });
    }
  }, [deviceSerial, selected, setKeyWarning, setSelected, setStage]);

  /**
   * The one ending an update has, whichever control the user reaches for.
   *
   * Closing the outcome card, closing the modal and backing out of the screen
   * all land here, so there is a single place that gives up the board and puts
   * the app back where it can pick one again. It does nothing while an update
   * is still running or has not been started, which is what lets the user
   * leave and come back to an update in flight rather than being held there.
   */
  const endUpdate = useCallback(async () => {
    if (!FINISHED_STAGES.includes(stage.kind)) {
      return;
    }

    const openDeviceId = useBleStore.getState().connectedDevice?.id;
    if (openDeviceId) {
      try {
        await bleService.disconnectDevice(openDeviceId);
      } catch {}
    }

    reset();
    BleConnectionHelper.returnToDeviceList();
  }, [reset, stage.kind]);

  return {
    selected,
    stage,
    keyWarning,
    isBusy: BUSY_STAGES.includes(stage.kind),
    hasFinished: FINISHED_STAGES.includes(stage.kind),
    browseForFirmware,
    startUpdate,
    endUpdate,
  };
};
