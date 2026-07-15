const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-worklets (required by react-native-reanimated v4) uses
// import.meta syntax which is invalid in Metro's default CommonJS web output.
// Adding it (and reanimated) to the transpile list causes Babel to compile
// the import.meta away before it reaches the browser.
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!' + [
    '(jest-)?react-native',
    '@react-native(-community)?',
    'expo(nent)?',
    '@expo(nent)?/.*',
    'react-native-worklets',
    'react-native-reanimated',
    '@shopify',
    '@react-navigation/.*',
    '@unimodules/.*',
    'unimodules-.*',
    'sentry-expo',
    'native-base',
    '@sentry/.*',
  ].join('|') + ')',
];

// Enable the package.json "exports" field so packages can ship
// browser-compatible entry points for web.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
