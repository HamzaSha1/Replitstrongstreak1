const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Required for Firebase JS SDK subpath imports (firebase/firestore, firebase/auth, etc.)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
