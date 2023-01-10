import test from 'ava'
import { initPlugin, callHook } from './_common'

test("Adds 'node:' prefix to builtins by default", async t => {
    const { plugin } = await initPlugin(undefined, false)
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: 'node:path',
            external: true
        })
    }
})

test("Removes 'node:' prefix when using builtinsPrefix='strip'", async t => {
    const { plugin } = await initPlugin({
        builtinsPrefix: 'strip'
    }, false)
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: 'path',
            external: true
        })
    }
})
