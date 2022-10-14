// @ts-check
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-ts'
import { defineConfig } from 'rollup'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

/** @type { import('./package.json') } */
const pkg = JSON.parse(await fs.readFile(path.resolve(__dirname, './package.json'), 'utf-8'))

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
    generatedCode: {
        preset: 'es2015',
        symbols: false,
    },
    esModule: false,
    exports: 'named',
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
            interop: id => id && (id.startsWith('node:') || builtins.has(id)) ? 'default' : 'auto',
            ...sharedOutputOptions
        },
        {
            format: 'module',
            file: pkg.exports.import,
            ...sharedOutputOptions
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({
            hook: {
                outputPath: (_path, kind) => kind === 'declaration' ? path.normalize(pkg.exports.types) : undefined
            }
        })
    ]
})
