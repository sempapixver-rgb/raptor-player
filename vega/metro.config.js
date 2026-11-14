const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    // Nada de varrer pastas de referencia locais.
    blockList: [/(^|[/\\])reference[/\\].*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
