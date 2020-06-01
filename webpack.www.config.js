const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const LiveReloadPlugin = require('webpack-livereload-plugin');

const wwwDir = './www/';

module.exports = {
    mode: process.env.ENV || 'development',
    devtool: 'inline-source-map',
    entry: {
        'homepage': [wwwDir + 'homepage/app.ts', wwwDir + 'homepage/scss/main.scss'],
        'webinterface': [wwwDir + 'webinterface/app.ts', wwwDir + 'webinterface/scss/main.scss']
    },
    output: {
        filename: './www/[name]/app.js'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.www.json",
                        onlyCompileBundledFiles: true
                    }
                }],
                exclude: [
                    /node_modules/,

                ],
                resolve: {
                    extensions: ['.tsx', '.ts', '.js']
                },
            },
            {
                test: /\.(sa|sc|c)ss$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                        options: {
                            hmr: process.env.NODE_ENV === 'development',
                        },
                    },
                    'css-loader',
                    'postcss-loader',
                    'sass-loader',
                ],
            }
        ]
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: 'www/[name]/style.css',
            chunkFilename: '[id].css',
        }),
        new CopyWebpackPlugin([
            { from: wwwDir + 'homepage/img', to: './www/homepage/img' },
            { from: wwwDir + 'webinterface/img', to: './www/webinterface/img' }
        ]),
        new LiveReloadPlugin(),
    ],
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            test: /\.js(\?.*)?$/i,
        })],
    },
}