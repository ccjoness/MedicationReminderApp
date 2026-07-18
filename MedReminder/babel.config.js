module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Note: react-native-reanimated/plugin is intentionally omitted.
    // In Reanimated v4 (SDK 54+) babel-preset-expo handles it automatically.
  };
};
