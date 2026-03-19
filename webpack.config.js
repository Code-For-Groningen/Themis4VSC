//@ts-check

'use strict';

const path = require('path');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const commonRules = [
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: [{ loader: 'ts-loader' }]
  }
];

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: { extension: './src/extension/extension.ts' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: { vscode: 'commonjs vscode' },
  resolve: { extensions: ['.ts', '.js', '.json'] },
  module: { rules: commonRules },
  devtool: 'nosources-source-map',
  infrastructureLogging: { level: 'log' },
};

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: { react: './src/view/index.tsx' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: { extensions: ['.ts', '.js', '.tsx', '.jsx', '.json'] },
  module: { rules: commonRules },
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];