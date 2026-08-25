module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Hook dependency arrays in this app are deliberately narrowed to control
    // when effects re-run; surface drift as a warning rather than an error so
    // `eslint .` stays a clean gate without forcing behavioural changes.
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
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
