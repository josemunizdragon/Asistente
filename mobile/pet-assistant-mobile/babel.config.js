// Expo + react-native-worklets-core (requerido por react-native-filament).
// Orden: presets primero, luego plugins. Sin duplicados.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin', { processNestedWorklets: true }],
    ],
  };
};
