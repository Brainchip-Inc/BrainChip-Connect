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
      // The BLE layer speaks a byte-level wire protocol, so masking and
      // shifting is inherent to it rather than a smell.
      files: ['src/services/ble/**'],
      rules: {
        'no-bitwise': 'off',
      },
    },
  ],
};
