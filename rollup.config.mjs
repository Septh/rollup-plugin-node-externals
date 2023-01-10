import { createRequire, builtinModules } from 'node:module'
import path from 'node:path'
import { defineConfig } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'

/** @type { import('./package.json') } */
const pkg = createRequire(import.meta.url)('./package.json')

const builtins = new Set(builtinModules)

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

/** @type { import('rollup').OutputOptions } */
const sharedOutputOptions = {
    sourcemap: true,
    plugins: [
        packageType()
    ]
}

export default defineConfig({
    input: 'src/index.ts',
    output: [
        {
            format: 'commonjs',
            file: pkg.exports.require,
            generatedCode: {
                preset: 'es2015',
                symbols: false,
            },
            esModule: false,
            freeze: false,
            exports: 'named',
            ...sharedOutputOptions,

            // Using the same technique as rollup/plugins
            // (see https://github.com/rollup/plugins/blob/a87282241be1ab5059ed8cffae24d01660fae07d/shared/rollup.config.mjs#L28)
            footer: 'module.exports = Object.assign(exports.default, exports);',
        },
        {
            format: 'esm',
            file: pkg.exports.import,
            ...sharedOutputOptions
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({
            hook: {
                outputPath: (_, kind) => kind === 'declaration' ? path.normalize(pkg.exports.types) : undefined
            }
        })
    ]
})
