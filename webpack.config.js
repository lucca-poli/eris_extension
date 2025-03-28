import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';

/** @type {import('webpack').Configuration} **/
export default {
    context: path.resolve(import.meta.dirname, "src"),
    devtool: "source-map",
    mode: "development",
    entry: {
        "wa-js": "./wa-js.js",
        "content": "./content.js",
        "background": "./background.js"
    },
    output: {
        filename: "[name].js",
        path: path.resolve(import.meta.dirname, "dist", "js")
    },
    resolve: {
        extensions: ['.js'],
        preferRelative: true,
        alias: {
            utils: path.resolve(import.meta.dirname, 'src/utils')
        }
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
