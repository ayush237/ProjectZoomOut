// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro defaults to watching only the app folder, so edits to packages/shared would
// not trigger a reload and its files would fail to resolve at bundle time.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// npm workspaces hoists to the root. Without this, Metro's hierarchical lookup can
// resolve two copies of React from different levels, which surfaces as the invalid
// hook call error rather than as anything resembling a resolution problem.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
