// @ts-check
import { dirname } from 'path'
import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'

import pkg from './package.cjs'

/** @type {import('rollup').OutputOptions} */
const commonOutput = {
    sourcemap: false,
    generatedCode: 'es2015'
}

/**
 * @param {'commonjs'|'module'} format
 * @returns {import('rollup').Plugin[]}
 */
const plugins = format => ([
    alias({
        entries: [{
            find: /^node(?:js)?:(.*)$/,
            replacement: '$1'
        }]
    }),
    resolve(),
    commonjs(),
    typescript({
        tsconfig: cfg => ({
            ...cfg,
            // No need to emit the declarations twice
            declaration: format === 'module',
            declarationDir: dirname(pkg.types)
        })
    }),
    {
        // An inlined mini-plugin that generates a package.json
        // file next to the bundle with just the 'type' field set.
        name: 'emit-pkg',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify({ type: format })
            })
        }
    }
])

/** @type {import('rollup').RollupOptions[]} */
const configs = [
    {
        input: 'src/index.ts',
        output: {
            ...commonOutput,
            format: 'commonjs',
            file: pkg.main,
            exports: 'default', // externals is exported as default
            interop: 'default', // How to import external modules?
        },
        plugins: plugins('commonjs')
    },
    {
        input: 'src/index.ts',
        output: {
            ...commonOutput,
            format: 'module',
            file: pkg.module
        },
        plugins: plugins('module'),
        // Leave find-up out of the esm build
        external: 'find-up'
    }
]

export default configs
