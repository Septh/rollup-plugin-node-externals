// @ts-check
import { builtinModules } from 'node:module'
import { normalize } from 'node:path'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'
import { defineConfig } from 'rollup'

import pkg from './package.json'

const builtins = new Set([
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`)
])

/** @type { import('rollup').PluginImpl } */
function packageType() {
    return {
        name: 'package-type',
        renderStart({ format }) {
            const type = { cjs: 'commonjs', es: 'module' }[ format ]
            if (type) {
                this.emitFile({
                    type: 'asset',
                    fileName: 'package.json',
                    source: JSON.stringify({ type })
                })
            }
        }
    }
}

export default defineConfig({
    input: 'src/index.ts',
    output: [
        {
            file: pkg.main,
            format: 'commonjs',
            interop: id => id && builtins.has(id) ? false : 'auto',
            generatedCode: {
                preset: 'es2015',
                symbols: false
            },
            esModule: false,
            exports: 'named',
            sourcemap: true,
        },
        {
            file: pkg.module,
            format: 'module',
            sourcemap: true,
            generatedCode: 'es2015'
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({
            hook: {
                outputPath: (_path, kind) => kind === 'declaration' ? normalize(pkg.types) : undefined
            }
        }),
        packageType()
    ]
})
