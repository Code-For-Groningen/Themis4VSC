//@ts-check

'use strict';

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const commonRules = [
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: [{ loader: 'ts-loader' }]
  }
];

class CopyStaticAssetsPlugin {
  /** @param {import('webpack').Compiler} compiler */
  apply(compiler) {
    compiler.hooks.afterEmit.tap('CopyStaticAssetsPlugin', () => {
      const sourceDir = path.resolve(__dirname, 'src', 'public');
      const outputDir = path.resolve(__dirname, 'dist', 'public');
      fs.mkdirSync(outputDir, { recursive: true });
      fs.cpSync(sourceDir, outputDir, { recursive: true });
    });
  }
}

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
  plugins: [
    // Ignore optional native modules used by `ws` (bufferutil, utf-8-validate)
    // They are optional performance modules and not required for the extension to work.
    new webpack.IgnorePlugin({ resourceRegExp: /^bufferutil$|^utf-8-validate$/ }),
    new CopyStaticAssetsPlugin(),
  ],
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
  plugins: [
    // Ignore optional native modules for browser build as well
    new webpack.IgnorePlugin({ resourceRegExp: /^bufferutil$|^utf-8-validate$/ }),
  ],
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];