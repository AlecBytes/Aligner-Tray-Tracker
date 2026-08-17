const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite uses its WASM build on web.
config.resolver.assetExts.push('wasm');

module.exports = config;
