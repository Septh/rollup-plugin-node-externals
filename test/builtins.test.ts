import test from 'ava'
import { initPlugin, callHook } from './_common.ts'

test("Marks Node builtins external by default", async t => {
    const { plugin } = await initPlugin()
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            external: true
        })
    }
})

test("Does NOT mark Node builtins external when builtins=false", async t => {
    const { plugin } = await initPlugin({
        builtins: false
    })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            external: false
        })
    }
})

test("Marks Node builtins external when builtins=false and implicitly included", async t => {
    const { plugin } = await initPlugin({
        builtins: false,
        include: [ 'path', 'node:fs' ]
    })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            external: true
        })
    }
})

test("Does NOT mark Node builtins external when builtins=true implicitly excluded", async t => {
    const { plugin } = await initPlugin({
        builtins: true,
        exclude: [ 'path', 'node:fs' ]
    })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            external: false
        })
    }
})

test("Adds 'node:' prefix to builtins by default", async t => {
    const { plugin } = await initPlugin()
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: 'node:path'
        })
    }
})

test("Removes 'node:' prefix when using builtinsPrefix='strip'", async t => {
    const { plugin } = await initPlugin({
        builtinsPrefix: 'strip'
    })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: 'path'
        })
    }
})

test("Ignores 'node:' prefix when using builtinsPrefix='ignore'", async t => {
    const { plugin } = await initPlugin({
        builtinsPrefix: 'ignore'
    })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: builtin
        })
    }
})

test("Does NOT remove 'node:' prefix for specific builtins, even with builtinsPrefix='add'", async t => {
    const { plugin } = await initPlugin({
        builtinsPrefix: 'strip'
    })
    for (const builtin of [ 'node:test' ]) {
        t.like(await callHook(plugin, 'resolveId', builtin), {
            id: builtin
        })
    }
})
