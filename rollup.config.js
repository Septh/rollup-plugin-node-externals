// @ts-check
import { normalize } from 'path'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'
import { defineConfig } from 'rollup'

import pkg from './package.json'

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
                    source: JSON.stringify({ type }, undefined, 2)
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
            interop: 'default',
            sourcemap: true,
            generatedCode: 'es2015',
            exports: 'named'
        },
        {
            file: pkg.module,
            format: 'module',
            interop: 'default',
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
    ],
    external: Object.keys(pkg.dependencies) // nodeResolve will take care of builtins
})
