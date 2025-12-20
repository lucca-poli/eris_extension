import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import webpack from 'webpack';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('webpack').Configuration} **/
const config = (env, argv) => {
    // 1. Extract the mode from argv (defaults to development if not provided)
    const mode = argv.mode || 'development';

    // 2. Determine log level
    const isProduction = mode === 'production';
    const logLevel = isProduction ? 'INFO' : 'DEBUG';
    return {
        context: path.resolve(__dirname, "src"),
        devtool: "source-map",
        mode: argv.mode,
        entry: {
            "injected_api": "./injected_api.ts",
            "front": "./front.ts",
            "background": "./background.ts",
            "default_popup": "./default_popup.ts"
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
            ignored: ['../node_modules', '../dist']
        },
        plugins: [
            new CopyPlugin({
                patterns: [{
                    from: path.resolve(__dirname, 'public/'),
                    to: path.resolve(__dirname, 'dist/'),
                    force: true,
                }]
            }),
            new webpack.DefinePlugin({
                // This ensures your Logger class knows which level to use at compile-time
                'process.env.LOG_LEVEL': JSON.stringify(logLevel),
            }),
        ]
    }
};

export default config;
