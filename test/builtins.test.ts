import test from 'ava'
import { call, type TestedPlugin } from './_common'
import externals from '../src/index'

test('Adds "node:" prefix to builtins by default', async t => {
    const plugin = externals() as TestedPlugin

    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await call(plugin.resolveId, builtin), {
            id: 'node:path',
            external: true
        })
    }
})

test('Removes "node:" prefix when option "builtinsPrefix" is set to "strip"', async t => {
    const plugin = externals({
        builtinsPrefix: 'strip'
    }) as TestedPlugin

    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await call(plugin.resolveId, builtin), {
            id: 'path',
            external: true
        })
    }
})
