/**
 * Explicit rather than implied.
 *
 * Metro would apply `babel-preset-expo` on its own, but Jest needs a config file to
 * find, and Reanimated's worklet transform must run last in the plugin list. Stating
 * both here keeps the test run and the bundler on identical transforms — the
 * alternative is a component that animates in the simulator and throws in a test.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
