const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.assetExts.push('glb', 'gltf');
// Fuerza resolución de node_modules desde la raíz (evita "Unable to resolve react/jsx-dev-runtime")
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
