// @ts-check
import { dirname } from 'path'
import { builtinModules, createRequire } from 'module'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from 'rollup-plugin-ts'

// @ts-ignore
const pkg = createRequire(import.meta.url)('./package.json')

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
                    return id.slice(scheme.length)
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
        name: 'emit-module-package-file',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify({ type }, undefined, 2)
            })
        }
    }
}

/** @type {import('rollup').RollupOptions} */
const config = {
    input: 'src/index.ts',
    output: [
        {
            format: 'commonjs',
            file: pkg.main,
            exports: 'named',
            plugins: [
                emitPkg('commonjs')
            ],
        },
        {
            format: 'module',
            file: pkg.module,
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
                declarationDir: dirname(pkg.types),
            })
        })
    ],
    external: builtinModules.concat(Object.keys(pkg.dependencies))
}

export default config
