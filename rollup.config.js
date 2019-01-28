
import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

const IS_WATCHING = process.env.ROLLUP_WATCH === 'true'

export default {
    input: 'src/externals.ts',
    output: [
        { file: 'dist/externals.cjs.js', format: 'cjs', sourcemap: IS_WATCHING },
        { file: 'dist/externals.esm.js', format: 'es',  sourcemap: IS_WATCHING }
    ],
    plugins: [
        resolve(),
        commonjs(),
        typescript()
    ],
    external: [
        'path'
    ]
}
