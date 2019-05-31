
import pkg from './package.json'
import ts from '@wessberg/rollup-plugin-ts'
import builtinModules from 'builtin-modules'

const input = 'src/index.ts'
const sourcemap = process.env.BUILD !== 'dist'
const external = [
    ...builtinModules,
    'builtin-modules'
]

export default [{
    input,
    output: { file: pkg.main, format: 'cjs', sourcemap },
    plugins: [
        ts()
    ],
    external
},
{
    input,
    output: { file: pkg.module, format: 'es', sourcemap },
    plugins: [
        ts()
    ],
    external
}]
