const { IOSConfig } = require('expo/config-plugins');
const { appTargetIntents } = require('./app-target-intents');

module.exports = function withAlignerTrackerIntents(config) {
  return IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'AlignerTrackerAppIntents.swift',
    contents: appTargetIntents,
    overwrite: true,
  });
};
