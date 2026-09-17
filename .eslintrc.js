module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Jest's setup file runs in the test environment, not the app's.
      files: ['jest.setup.js'],
      env: {
        jest: true,
      },
    },
    {
      // The BLE layer speaks a byte-level wire protocol and the image layer
      // writes a byte-level file format, so masking and shifting is inherent
      // to both rather than a smell.
      files: ['src/services/ble/**', 'src/services/image/**'],
      rules: {
        'no-bitwise': 'off',
      },
    },
  ],
};
