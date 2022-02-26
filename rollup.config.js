import typescript from '@rollup/plugin-typescript';
import postcss from "rollup-plugin-postcss";
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import multi from '@rollup/plugin-multi-entry';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import visualizer from 'rollup-plugin-visualizer';
import { terser } from 'rollup-plugin-terser';

const PRODUCTION = !process.env.ROLLUP_WATCH;

export default [
    {
        input: {
            include: ['server/www/js/main.ts'],
            exclude: ['server/main.ts']
        },
        output: {
            file: 'server/www/build/bundle.js',
            format: 'umd',
            sourcemap: !PRODUCTION,
        },
        onwarn: function(message) {
            // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
            if (message.code === 'THIS_IS_UNDEFINED') {
                return;
            }

            // Allow htmx its eval
            if (message.code === 'EVAL' && message.loc.file.includes('htmx.org')) {
                return;
            }

            // Allow Hyperscript plugin failed .d.ts file
            if (message.code === "PLUGIN_WARNING" && message.message.includes('/plugin/eventsource.d.ts\' is not a module.')) {
                return;
            }

            console.error(message);
            console.error(message.toString())
        },
        plugins: [
            nodePolyfills({ include: ['url'] }),
            multi({

            }),
            typescript({
                include: "server/www/js/*",
                tsconfig: "tsconfig.rollup.json",
                declaration: true,
                declarationDir: "server/www/build"
            }),
            json(),
            resolve(),
            commonjs(),
            PRODUCTION && terser(),
            visualizer({
                filename: 'bundle-analysis.html',
                open: true,
            }),
        ],
    },
    {
        input: 'server/www/css/main.css',
        output: {
            file: 'server/www/build/bundle.css'
        },
        plugins: [postcss({
            extract: true,
            config: "./postcss.config.js"
        })],
        onwarn: function(message) {
            if (message.code === 'FILE_NAME_CONFLICT' && message.message.includes("\"bundle.css\" overwrites a previously emitted file")) {
                return;
            }

            console.error(message);
        },
    }
];
