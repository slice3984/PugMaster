const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const LiveReloadPlugin = require('webpack-livereload-plugin');

const wwwDir = './www/';

const config = {
	mode: process.env.ENV || 'development',
	devtool: 'inline-source-map',
	entry: {
		dev: [wwwDir + 'dev/app.ts', wwwDir + 'dev/main.scss'],
	},
	output: {
		filename: './www/[name]/app.js',
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							configFile: 'www/tsconfig.json',
							onlyCompileBundledFiles: true,
						},
					},
				],
				exclude: [/node_modules/],
				resolve: {
					extensions: ['.tsx', '.ts', '.js'],
				},
			},
			{
				test: /\.(sa|sc|c)ss$/,
				use: [
					{
						loader: MiniCssExtractPlugin.loader,
					},
					'css-loader',
					'postcss-loader',
					'sass-loader',
				],
			},
		],
	},

	plugins: [
		new MiniCssExtractPlugin({
			filename: 'www/[name]/style.css',
			chunkFilename: '[id].css',
		}),
		new LiveReloadPlugin(),
	],
	optimization: {
		minimizer: [
			new TerserPlugin({
				test: /\.js(\?.*)?$/i,
				sourceMap: true,
			}),
		],
	},
};

module.exports = config;
