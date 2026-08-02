/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  name: 'Quovi',
  slug: 'quovi',
  jsEngine: 'hermes',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  assetBundlePatterns: ['**/*'],
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.darkmattergaming.quovi',
    permissions: [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
    ],
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
        color: '#225F06',
        sounds: [],
        androidMode: 'default',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Quovi lets you select an image for a mission.',
        cameraPermission: 'Quovi uses the camera so you can add an image to a mission.',
      },
    ],
    'expo-background-task',
    'expo-task-manager',
    // Native Google Sign-In — no iOS URL scheme needed for Android-only
    '@react-native-google-signin/google-signin',
  ],
  scheme: 'quovi',
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
        "projectId": "20b72cfd-4c36-4337-b437-0a6d967280e7"
    },
  },
  owner: 'ccjoness',
};
