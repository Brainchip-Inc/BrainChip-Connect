module.exports = {
  preset: 'react-native',
  // Extend React Native's own pattern: several dependencies ship untranspiled
  // ESM, so they have to go through Babel rather than be skipped.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-documents)?|@react-navigation|react-native-.*|lucide-react-native|cbor-x|decode-uri-component)/)',
  ],
  // The documentation site is its own npm project; keep its tree out of the
  // module map so its dependencies are neither crawled nor tested.
  modulePathIgnorePatterns: ['<rootDir>/site/'],
  setupFiles: [
    require.resolve('react-native/jest/setup.js'),
    '<rootDir>/jest.setup.js',
  ],
};
