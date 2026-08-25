/**
 * Registers the native-module stubs the app's native dependencies look up at
 * import time. Without these the libraries throw while their JS is still being
 * evaluated, so no component test can even mount the app.
 *
 * Only the native bridge is stubbed here — the libraries' own JavaScript still
 * runs, so tests exercise the real code paths above the bridge.
 */

const { NativeModules } = require('react-native');

const eventEmitterStub = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

NativeModules.RNFSManager = {
  ...eventEmitterStub,
  RNFSFileTypeRegular: 0,
  RNFSFileTypeDirectory: 1,
  RNFSMainBundlePath: '/main-bundle',
  RNFSCachesDirectoryPath: '/caches',
  RNFSDocumentDirectoryPath: '/documents',
  RNFSTemporaryDirectoryPath: '/tmp',
  RNFSExternalDirectoryPath: '/external',
  RNFSExternalStorageDirectoryPath: '/external-storage',
  RNFSLibraryDirectoryPath: '/library',
  RNFSDownloadDirectoryPath: '/downloads',
  RNFSPicturesDirectoryPath: '/pictures',
};

/**
 * Bridges whose surface is large enough that listing every method by hand
 * would rot: any method the library reaches for resolves to a jest.fn().
 */
const nativeBridgeStub = () =>
  new Proxy(
    { ...eventEmitterStub },
    {
      get(target, prop) {
        if (!(prop in target) && typeof prop === 'string') {
          target[prop] = jest.fn();
        }
        return target[prop];
      },
    },
  );

NativeModules.BlePlx = nativeBridgeStub();
NativeModules.RNZipArchive = nativeBridgeStub();
NativeModules.RNDocumentPicker = nativeBridgeStub();

// AsyncStorage ships its own functional in-memory jest mock; use that rather
// than a hand-rolled stub so storage reads and writes still behave.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
