import test from 'ava'
import { initPlugin, callHook } from './_common.ts'

test("Marks Node builtins external by default", async t => {
    const { plugin } = await initPlugin()
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            external: true
        })
    }
})

test("Does NOT mark Node builtins external when builtins=false", async t => {
    const { plugin } = await initPlugin({ builtins: false })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            external: false
        })
    }
})

test("Does NOT mark Node builtins external when implicitely excluded", async t => {
    const { plugin } = await initPlugin({ exclude: [ 'path', 'node:fs' ]})
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            external: false
        })
    }
})

test("Marks Node builtins external when builtins=false and implicitly included", async t => {
    const { plugin } = await initPlugin({ builtins: false, include: [ 'path', 'node:fs' ] })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            external: true
        })
    }
})

test("Adds 'node:' prefix to builtins by default", async t => {
    const { plugin } = await initPlugin()
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            id: 'node:path'
        })
    }
})

test("Removes 'node:' prefix when using builtinsPrefix='strip'", async t => {
    const { plugin } = await initPlugin({ builtinsPrefix: 'strip' })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            id: 'path'
        })
    }
})

test("Does NOT remove 'node:test' prefix even with builtinsPrefix='add'", async t => {
    const { plugin } = await initPlugin({ builtinsPrefix: 'strip' })
    for (const builtin of [ 'node:test' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            id: builtin
        })
    }
})

test("Does not recognize 'test' as a Node builtin", async t => {
    const { plugin } = await initPlugin()
    t.is(await callHook(plugin, 'resolveId', 'node', 'index.js'), null)
})

test("Ignores 'node:' prefix when using builtinsPrefix='ignore'", async t => {
    const { plugin } = await initPlugin({ builtinsPrefix: 'ignore' })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin, 'index.js'), {
            id: builtin
        })
    }
})
