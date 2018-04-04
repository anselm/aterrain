
const path = require('path');

// const UglifyJsPlugin = require('uglifyjs-webpack-plugin') - decided to do this as a separate phase in package.json

module.exports = {
  mode: 'development',
  // plugins: [ new UglifyJsPlugin() ],
  entry: './src/all.js',
  output: {
    filename: 'aframe-aterrain-component.js',
    path: path.resolve(__dirname, 'dist')
  }
};

