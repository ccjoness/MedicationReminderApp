const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Web fix: react-native-worklets uses import.meta (for Web Worker thread setup)
// which is invalid in Metro's CommonJS web output. We intercept module
// resolution on web and redirect to a no-op stub so the bundle succeeds.
// On native, the real package is used as normal.
// ---------------------------------------------------------------------------

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-worklets') {
    return {
      filePath: path.resolve(__dirname, 'src/stubs/worklets-web.js'),
      type: 'sourceFile',
    };
  }

  // Fall through to the default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Enable package.json "exports" field so packages can ship browser entry points
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
