// @ts-check
import { dirname } from 'path'
import { builtinModules as external, createRequire } from 'module'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from 'rollup-plugin-ts'

// @ts-ignore
const pkg = createRequire(import.meta.url)('./package.json')

/** @type { import('rollup').PluginImpl } */
const nodeColon = () => {
    return {
        name: 'node-colon',

        resolveId(id) {
            for (const scheme of [ 'node:', 'nodejs:' ]) {
                if (id.startsWith(scheme)) {
                    id = id.slice(scheme.length)
                    return {
                        id,
                        external: external.includes(id)
                    }
                }
            }
            return null
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
            exports: 'default',
            sourcemap: false
        },
        {
            format: 'module',
            file: pkg.module,
            sourcemap: false
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
    external
}

export default config
