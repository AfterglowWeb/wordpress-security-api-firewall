// webpack.config.js
const path = require('path');
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const extraPlugins = [];
if ( process.env.ANALYZE ) {
	const { BundleAnalyzerPlugin } = require( 'webpack-bundle-analyzer' );
	extraPlugins.push( new BundleAnalyzerPlugin() );
}

module.exports = {
	...defaultConfig,
	entry: {
		...defaultConfig.entry,
		'index': path.resolve(__dirname, './src/index.tsx'),
		'totp': path.resolve(__dirname, './src-totp/index.tsx'),
	},
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			cacheGroups: {
				vendor: {
					test: /[\\/]node_modules[\\/](react|react-dom|@wordpress)[\\/]/,
					name: 'vendor',
					chunks: 'all',
					priority: 10,
				},
				mui: {
					test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
					name: 'mui',
					chunks: 'all',
					priority: 20,
				},
				muiDataGrid: {
					test: /[\\/]node_modules[\\/]@mui[\\/]x-data-grid[\\/]/,
					name: 'mui-datagrid',
					chunks: 'all',
					priority: 30,
				},
			},
		},
	},
	plugins: [ ...defaultConfig.plugins, ...extraPlugins ],
	devtool: 'source-map',
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve.alias,
			'@components': path.resolve(__dirname, './src/components'),
			'@contexts': path.resolve(__dirname, './src/contexts'),
			'@features': path.resolve(__dirname, './src/features'),
			'@layouts': path.resolve(__dirname, './src/layouts'),
			'@pages': path.resolve(__dirname, './src/pages'),
			'@services': path.resolve(__dirname, './src/services'),
			'@app-types': path.resolve(__dirname, './src/app-types'),
			'@app-utils': path.resolve(__dirname, './src/utils'),
			'@hooks': path.resolve(__dirname, './src/hooks'),
			'@totp-components': path.resolve(__dirname, './src-totp/components'),
			'@totp-contexts': path.resolve(__dirname, './src-totp/contexts'),
			'@totp-services': path.resolve(__dirname, './src-totp/services'),
			'@totp-types': path.resolve(__dirname, './src-totp/types'),
		},
	},
};