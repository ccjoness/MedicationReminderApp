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
    // Native Google Sign-In — no iOS URL scheme needed for Android-only
    '@react-native-google-signin/google-signin',
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
