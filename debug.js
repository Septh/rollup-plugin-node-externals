
const rollup = require('rollup')
const externals = require('./dist/externals.cjs.js')

const cfg = {
    input: 'debug.js',
    output: 'debug_out.js',
    plugins: [
        externals({
            deps: false,
            devDeps: true,
            except: [
                /^typescript/,
                /^ts/
            ]
        })
    ],
    external: [
    ]
}

rollup.rollup(cfg)
