import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';

/** @type {import('webpack').Configuration} **/
export default {
    context: path.resolve(import.meta.dirname, "src"),
    devtool: "source-map",
    mode: "development",
    entry: {
        "injected_api": "./injected_api.js",
        "front": "./front.js",
        "background": "./background.js"
    },
    output: {
        filename: "[name].js",
        path: path.resolve(import.meta.dirname, "dist", "js")
    },
    module: {
        rules: [
            {
                test: /\.([cm]?ts|tsx)$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        transpileOnly: true,
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
        extensionAlias: {
            utils: path.resolve(import.meta.dirname, 'src/utils'),
            ".ts": [".js", ".ts"],
        },
        preferRelative: true,
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
