'use strict'
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} **/
module.exports = {
    context: path.resolve(__dirname, "src"),
    devtool: "eval",
    mode: "development",
    entry: "./content.js",
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist", "js")
    },
    resolve: {
        extensions: ['js'],
        preferRelative: true
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
