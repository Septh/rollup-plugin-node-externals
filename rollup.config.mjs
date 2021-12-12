// @ts-check
import { dirname } from 'path'
import { builtinModules } from 'module'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from 'rollup-plugin-ts'

// https://rollupjs.org/guide/en/#using-untranspiled-config-files
import pkg from './package.cjs'

/**
 * A mini-plugin that resolves `node:` and `nodejs:` imports to their unprefixed equivalent.
 * @type { import('rollup').PluginImpl }
 */
function nodeColon() {
    return {
        name: 'node-colon',
        resolveId(id) {
            for (const scheme of [ 'node:', 'nodejs:' ]) {
                if (id.startsWith(scheme)) {
                    return { id: id.slice(scheme.length), external: true}
                }
            }
        }
    }
}

/**
 * A mini-plugin that generates a package.json file next to the bundle.
 * @type { import('rollup').PluginImpl<'module' | 'commonjs'> }
 */
function emitPkg(type) {
    return {
        name: 'emit-pkg',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify({ type }, undefined, 2)
            })
        }
    }
}

/** @type {import('rollup').OutputOptions} */
const commonOutput = {
    sourcemap: true,
    generatedCode: 'es2015'
}

/** @type {import('rollup').RollupOptions} */
const config = {
    input: 'src/index.ts',
    output: [
        {
            ...commonOutput,
            format: 'commonjs',
            file: pkg.main,
            exports: 'auto',
            sourcemap: true,
            plugins: [
                emitPkg('commonjs')
            ]
        },
        {
            ...commonOutput,
            format: 'module',
            file: pkg.module,
            sourcemap: true,
            plugins: [
                emitPkg('module')
            ]
        },
    ],
    plugins: [
        nodeColon(),
        resolve(),
        commonjs(),
        ts({
            tsconfig: cfg => ({
                ...cfg,
                declarationDir: dirname(pkg.types)
            })
        })
    ],
    external: builtinModules.concat(Object.keys(pkg.dependencies))
}

export default config
