// @ts-check
import { normalize } from 'path'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'
import { defineConfig } from 'rollup'

import pkg from './package.json'

/**
 * @param {'commonjs'|'module'} type
 * @returns { import('rollup').Plugin }
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

const cfg = defineConfig({
    input: 'src/index.ts',
    output: [
        {
            file: pkg.main,
            format: 'commonjs',
            interop: 'default',
            sourcemap: true,
            generatedCode: 'es2015',
            exports: 'named',
            plugins: [ emitPkg('commonjs') ]
        },
        {
            file: pkg.module,
            format: 'module',
            interop: 'default',
            sourcemap: true,
            generatedCode: 'es2015',
            plugins: [ emitPkg('module') ]
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({
            hook: {
                outputPath: (_path, kind) => kind === 'declaration' ? normalize(pkg.types) : undefined
            }
        })
    ],
    external: Object.keys(pkg.dependencies) // nodeResolve will take care of builtins
})

export default cfg
