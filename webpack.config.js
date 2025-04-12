import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('webpack').Configuration} **/
export default {
    context: path.resolve(__dirname, "src"),
    devtool: "source-map",
    mode: "development",
    entry: {
        "injected_api": "./injected_api.ts",
        "front": "./front.ts",
        "background": "./background.ts"
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist/js")
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: "ts-loader",
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
        extensionAlias: {
            utils: path.resolve(__dirname, 'src', 'utils'),
        },
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
