const { join, resolve } = require('path');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const ExtractCssChunks = require('extract-css-chunks-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const entry = {
  index: resolve('src', 'js', 'index.js'),
};

const rules = [
  // rule for .js/.jsx files
  {
    test: /\.(jsx?)$/,
    include: [join(__dirname, 'js', 'src')],
    exclude: [join(__dirname, 'node_modules')],
    use: {
      loader: 'babel-loader',
    },
  },
  // rule for standard (global) CSS files
  {
    test: /\.css$/,
    include: [join(__dirname, 'src', 'css')],
    use: [ExtractCssChunks.loader, 'css-loader'],
  },
  // rule for .woff2 font files
  {
    test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    use: 'url-loader',
  },
  // rule for .ttf/.eot/.svg files
  {
    test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    use: {
      loader: 'file-loader',
      options: {
        name: './fonts/[name].[ext]',
      },
    },
  },
  // rule for images (add svg? How to distinguish a svg font from a svg image?)
  {
    test: /\.(gif|jpe?g|png)$/i,
    include: join(__dirname, 'src', 'images'),
    loaders: [
      'file-loader',
      {
        loader: 'image-webpack-loader',
        options: {
          mozjpeg: {
            progressive: true,
            quality: 65,
          },
          // optipng.enabled: false will disable optipng
          optipng: {
            enabled: false,
          },
          pngquant: {
            quality: '65-90',
            speed: 4,
          },
          gifsicle: {
            interlaced: false,
          },
          // the webp option will enable WEBP
          webp: {
            quality: 75,
          },
        },
      },
    ],
  },
];

module.exports = mode => {
  const PUBLIC_URL = mode === 'production' ? 'TODO: public url here' : '';

  const plugins = [
    new BundleAnalyzerPlugin({
      analyzerMode: 'disabled',
      generateStatsFile: true,
      logLevel: 'info',
      statsFilename: 'stats.json',
    }),
    new ExtractCssChunks({
      chunkFilename: '[id].css',
      cssModules: false,
      filename: '[name].css',
      orderWarning: true,
      reloadAll: true,
    }),
    new HtmlWebpackPlugin({
      chunks: ['index'],
      filename: 'index.html',
      hash: true,
      template: join(__dirname, 'src', 'templates', 'index.html'),
      templateParameters: {
        PUBLIC_URL,
        TITLE: 'Reddit data visualization battle April 2019',
      },
    }),
  ];

  const config = {
    entry,
    module: {
      rules,
    },
    output: {
      filename: '[name].[hash].js',
      path: resolve(__dirname, 'build'),
      sourceMapFilename: '[file].map',
    },
    plugins,
    target: 'web',
  };
  return config;
};
