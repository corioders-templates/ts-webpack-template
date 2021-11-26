const path = require('path');

const config = require('./config.js');

const { DefinePlugin } = require('webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');

const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');
const WebpackBar = require('webpackbar');

const browserSyncReloadPlugin = require(path.resolve(config.MORE.BROWSER_SYNC_PLUGINS_PATH, 'reloadPlugin'));

const paths = {
	src: path.resolve(config.ROOT_PATH, 'src'),
	out: path.resolve(config.ROOT_PATH, 'out'),
	cache: path.resolve(config.ROOT_PATH, 'node_modules/.cache/webpack'),

	eslintConfig: path.resolve(config.ROOT_PATH, '.eslintrc.js'),
	tsConfig: path.resolve(config.ROOT_PATH, 'tsconfig.json'),
};

const options = {};
options.ts = {
	useCaseSensitiveFileNames: true,
	onlyCompileBundledFiles: true,
	configFile: paths.tsConfig,
	appendTsSuffixTo: [/\.vue$/],
};

const aliases = require(path.resolve(config.CONFIG_PATH, 'alias.json'));
for (const key in aliases) aliases[key] = path.resolve(config.ROOT_PATH, aliases[key]);

const webpack = {
	context: config.ROOT_PATH,
	entry: path.resolve(paths.src, 'index.ts'),

	// target: (see webpack.js.org/configuration/target),
	output: {
		clean: true,
		path: paths.out,
		filename: '[name].js',
		publicPath: '/',
	},

	resolve: {
		alias: {
			...aliases,
		},
		extensions: ['.ts', '.js'],
	},

	cache: {
		type: 'memory',
		// type: 'filesystem',
		// name: `${config.IS_PRODUCTION ? 'production' : 'development'}-${config.IS_FAST ? 'fast' : 'nonFast'}-${config.IS_DEBUG ? 'debug' : 'nonDebug'}`,
		// cacheDirectory: paths.cache,
	},

	module: {
		rules: [
			// =========================================================================
			// loaders
			{
				test: /\.ts$/,
				use: [
					{
						loader: 'ts-loader',
						options: options.ts,
					},
				],
			},
		],
	},

	plugins: [
		...(config.IS_ANALYZE ? [new BundleAnalyzerPlugin()] : []),

		new DefinePlugin({
			__IS_PRODUCTION__: config.IS_PRODUCTION,
		}),

		new ESLintPlugin({
			extensions: ['js', 'ts', 'vue'],
			lintDirtyModulesOnly: true,
		}),

		new BrowserSyncPlugin(
			{
				host: config.ENV.HOST,
				port: 8080,
				proxy: `http://${config.ENV.HOST}:8081/`,
				open: false,
				logLevel: 'silent',
				ui: { port: 8082 },
				plugins: [browserSyncReloadPlugin],
			},
			{ reload: false },
		),

		{
			PLUGIN_NAME: 'logging',
			/**
			 *
			 * @param {import('webpack').Compiler} compiler
			 */
			apply(compiler) {
				// Disable webpack-dev-server output.
				compiler.hooks.infrastructureLog.tap(this.PLUGIN_NAME, (name, type, args) => {
					if (name == 'webpack-dev-server') return true;
				});

				const chalk = require('chalk');

				const friendlyErrorsOutput = require('@soda/friendly-errors-webpack-plugin/src/output');
				class FriendlyErrorsWebpackPluginModified extends FriendlyErrorsWebpackPlugin {
					constructor() {
						super(...arguments);
					}
					displayDevServerInfo() {
						friendlyErrorsOutput.info(
							`Browser sync running at: ${chalk.cyan(`http://${config.ENV.HOST}:8080/`)} and ui: ${chalk.cyan(`http://${config.ENV.HOST}:8082/`)}`,
						);
						friendlyErrorsOutput.info(`Main app running at: ${chalk.cyan(`http://${config.ENV.HOST}:8081/`)}`);
					}
					displayErrors() {
						this.displayDevServerInfo();
						super.displayErrors.apply(this, arguments);
					}
					displaySuccess() {
						this.displayDevServerInfo();
						super.displaySuccess.apply(this, arguments);
					}
				}

				class WebpackBarModified extends WebpackBar {
					constructor() {
						super(...arguments);
					}

					updateProgress() {
						if (!this.state.done) super.updateProgress.apply(this, arguments);
					}
				}

				let once = false;
				const addLogging = (isWatching) => {
					if (once) return;
					once = true;

					const webpackBar = new WebpackBarModified();
					webpackBar._ensureState();
					webpackBar.apply(compiler);

					if (isWatching) {
						const friendlyErrors = new FriendlyErrorsWebpackPluginModified();
						friendlyErrors.apply(compiler);
					}
				};

				compiler.hooks.watchRun.tap(this.PLUGIN_NAME, addLogging.bind(undefined, true));
				compiler.hooks.beforeRun.tap(this.PLUGIN_NAME, addLogging.bind(undefined, false));
			},
		},
	],

	devServer: {
		host: config.ENV.HOST,
		port: 8081,
		hot: 'only',
		client: {
			logging: 'none',
		},
		devMiddleware: {
			writeToDisk: config.IS_DEBUG,
		},
		static: {
			publicPath: '/',
		},
	},
};

module.exports = {
	webpack,
	paths,
};