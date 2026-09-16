import { pick } from '@react-native-documents/picker';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import bleService from '../../services/ble/bleManager';
import { ModelUpdateError } from '../../services/ble/modelTransferProtocol';
import {
  ModelUpdateEnding,
  ModelUpdateStage,
  SelectedModel,
} from '../../types/modelUpdate';
import { useBleStore } from '../store/useBleStore';

/**
 * Copy a picked package into the app's cache under its own name.
 *
 * The picker hands back a URI that may not survive the update, so the file is
 * given a stable path first.
 *
 * @param sourceUri - URI the picker returned.
 * @param fileName - Name to keep it under.
 * @returns The cached path.
 */
const cacheModelFile = async (
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
 * Owns picking a model package, sending it, and reporting what the board
 * actually did with it.
 *
 * Both model screens drive this, so the wording and the state machine cannot
 * drift apart between them. The board answers twice and the difference matters
 * to whoever is holding it: the model arriving safely is not the model
 * running, and only the second is an update that worked.
 */
export const useModelUpdate = () => {
  const connectedDevice = useBleStore(state => state.connectedDevice);

  const [selected, setSelected] = useState<SelectedModel | null>(null);
  const [stage, setStage] = useState<ModelUpdateStage>({ kind: 'idle' });
  const updateInFlight = useRef(false);
  const stopRequested = useRef(false);

  const clearSelection = useCallback(() => setSelected(null), []);

  const reset = useCallback(() => {
    setSelected(null);
    setStage({ kind: 'idle' });
  }, []);

  const browseForModel = useCallback(async () => {
    setSelected(null);

    try {
      const [result] = await pick({
        allowMultiSelection: false,
        type: Platform.select({ ios: ['public.data'], android: ['*/*'] }),
        copyTo: 'cachesDirectory',
      });

      const fileName = result.name ?? 'model.zip';
      if (!fileName.toLowerCase().endsWith('.zip')) {
        Alert.alert('Invalid File', 'Please select a .zip model package');
        return;
      }

      const sourceUri =
        (result as { fileCopyUri?: string }).fileCopyUri ?? result.uri;
      if (!sourceUri) {
        Alert.alert('Invalid file path');
        return;
      }

      const localPath = await cacheModelFile(sourceUri, fileName);
      const stat = await RNFS.stat(localPath);

      setSelected({
        name: fileName,
        path: localPath,
        sizeBytes: Number(stat.size),
      });
    } catch (error: any) {
      if (error?.message !== 'User cancelled the picker') {
        Alert.alert('File selection failed');
      }
    }
  }, []);

  const startUpdate = useCallback(async () => {
    // Taken before the first await, because the stage that disables Install is
    // not set until after one and a second tap in that window would reach
    // sendModelZip, be turned away for an update already running, and report
    // that as a failure of the update that is running perfectly well.
    if (updateInFlight.current) {
      return;
    }
    updateInFlight.current = true;
    stopRequested.current = false;

    const deviceId = connectedDevice?.id;
    if (!selected || !deviceId) {
      updateInFlight.current = false;
      Alert.alert('Installation Failed', 'No device connected or model chosen');
      return;
    }

    setStage({ kind: 'sending', percent: 0 });

    let ending: ModelUpdateEnding;

    try {
      const outcome = await bleService.sendModelZip(deviceId, selected.path, {
        onProgress: percent =>
          setStage({ kind: 'sending', percent: Math.round(percent) }),
        onInstalling: () => setStage({ kind: 'installing' }),
      });

      ending = { status: outcome };
      if (outcome === 'installed') {
        setSelected(null);
      }
    } catch (error: unknown) {
      if (__DEV__) console.log('[MODEL]', error);
      updateInFlight.current = false;

      // A user who stopped the update is not told it failed; they are put back
      // where they were, with the model they picked still chosen.
      if (stopRequested.current) {
        setStage({ kind: 'idle' });
        return;
      }

      ending = {
        status: 'failed',
        detail: error instanceof ModelUpdateError ? error.message : undefined,
        boardHasNoModel:
          error instanceof ModelUpdateError ? error.boardHasNoModel : false,
      };
      setStage({ kind: 'done', ending });
      return;
    }

    updateInFlight.current = false;
    setStage({ kind: 'done', ending });
  }, [connectedDevice?.id, selected]);

  const stopUpdate = useCallback(() => {
    stopRequested.current = true;
    bleService.stopModelTransfer();
  }, []);

  const dismissOutcome = useCallback(() => setStage({ kind: 'idle' }), []);

  return {
    selected,
    stage,
    isBusy: stage.kind === 'sending' || stage.kind === 'installing',
    browseForModel,
    clearSelection,
    startUpdate,
    stopUpdate,
    dismissOutcome,
    reset,
  };
};
