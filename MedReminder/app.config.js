// app.config.js — dynamic Expo config.
// Expo prefers this file over app.json when both exist.
// Using a JS config allows environment variables to be read at build time,
// which is required for values like the Google iOS URL scheme.

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  name: 'Lumidose',
  slug: 'lumidose',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.darkmattersoftware.lumidose',
    infoPlist: {
      NSCameraUsageDescription:
        'Lumidose uses the camera so you can take a photo of your medication.',
      NSPhotoLibraryUsageDescription:
        'Lumidose accesses your photo library so you can attach a photo to your medication.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.darkmattersoftware.lumidose',
    permissions: [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECORD_AUDIO',
      'android.permission.WAKE_LOCK',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#6750A4',
        sounds: [],
        androidMode: 'default',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Lumidose accesses your photos to let you add medication images.',
        cameraPermission: 'Lumidose uses the camera so you can take a photo of your medication.',
      },
    ],
    'expo-background-task',
    'expo-task-manager',
    [
      // Google native Sign-In plugin.
      // iosUrlScheme is the reversed iOS OAuth client ID from Google Cloud Console.
      // Format: com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_PREFIX
      // Set GOOGLE_IOS_URL_SCHEME in your .env and EAS secrets.
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.PLACEHOLDER',
      },
    ],
  ],
  scheme: 'lumidose',
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'e34fdd43-d731-41e4-a755-4ecaef6384dd',
    },
  },
  owner: 'ccjoness',
};
