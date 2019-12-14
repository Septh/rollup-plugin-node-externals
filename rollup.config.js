
import ts from '@wessberg/rollup-plugin-ts'
import builtins from 'builtin-modules'

import pkg from './package.json'
const input = 'src/index.ts'
const sourcemap = true
const external = builtins.concat(Object.keys(pkg.devDependencies), Object.keys(pkg.peerDependencies))
const tsOptions = {
}

/** @type {import('rollup').RollupOptions} */
const cfg = {
    input,
    output: [
        {
            format: 'cjs',
            file: pkg.main,
            sourcemap
        },
        {
            format: 'es',
            file: pkg.module,
            sourcemap
        },
    ],
    plugins: [
        ts(tsOptions)
    ],
    external
}

export default cfg
