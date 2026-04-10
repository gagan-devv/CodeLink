const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      // Disable HMR for web to avoid the error
      mode: env.mode || 'development',
    },
    argv
  );

  // Disable HMR
  if (config.devServer) {
    config.devServer.hot = false;
    config.devServer.liveReload = false;
  }

  return config;
};
