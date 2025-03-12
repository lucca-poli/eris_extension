const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} **/
module.exports = {
    context: path.resolve(__dirname, "src"),
    devtool: "source-map",
    mode: "development",
    entry: {
        "wa-js": "./wa-js.js",
        "content": "./content.js",
        "background": "./background.js"
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist", "js")
    },
    resolve: {
        extensions: ['.js'],
        preferRelative: true,
        //alias: {
        //    utils: path.resolve(__dirname, 'src/utils')
        //}
    },
    watch: true,
    watchOptions: {
        ignored: ['/node_modules', '/dist']
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: '.', to: '..', context: '../public/' }]
        })
    ]
};
