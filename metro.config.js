const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite uses WebAssembly for its web implementation.
config.resolver.assetExts.push('wasm');

module.exports = config;
