const TerserPlugin = require('terser-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: process.env.ENV || 'development',
    target: 'node',
    node: {
        __dirname: false,
        __filename: false,
    },
    // If the required packages are already installed
    // externals: [nodeExternals()],
    devtool: 'inline-source-map',
    entry: './app.ts',
    output: {
        filename: 'bot.js'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.bot.json"
                    }
                }],
                exclude: [
                    /node_modules/
                ],
                resolve: {
                    extensions: ['.tsx', '.ts', '.js']
                },
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'views', to: 'views' }
            ]
        })
    ],
    optimization: {
        minimize: false,
        minimizer: [new TerserPlugin({
            terserOptions: {
                keep_fnames: true
            },
            test: /\.js(\?.*)?$/i,
        })],
    },
}