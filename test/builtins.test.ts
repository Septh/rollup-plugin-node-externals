import test from 'ava'
import { initPlugin, IGNORED } from './_common.ts'

test("Marks Node builtins external by default", async t => {
    const context = await initPlugin()
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            external: true
        })
    }
})

test("Does NOT mark Node builtins external when builtins=false", async t => {
    const context = await initPlugin({ builtins: false })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            external: false
        })
    }
})

test("Does NOT mark Node builtins external when builtins=true and implicitly excluded", async t => {
    const context = await initPlugin({ builtins: true, exclude: [ 'path', 'node:fs' ]})

    // Implicitly excluded
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            external: false
        })
    }

    // not excluded
    for (const builtin of [ 'node:module' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            external: true
        })
    }
})

test("Marks Node builtins external when builtins=false and implicitly included", async t => {
    const context = await initPlugin({ builtins: false, include: [ 'path', 'node:fs' ] })
    for (const builtin of [ 'path', 'node:fs' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            external: true
        })
    }
})

test("Adds 'node:' prefix to builtins by default", async t => {
    const context = await initPlugin()
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: 'node:path'
        })
    }
})

test("Adds 'node:' prefix when builtinsPrefix is 'add'", async t => {
    const context = await initPlugin({ builtinsPrefix: 'add' })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: 'node:path'
        })
    }
})

test("Adds 'node:' prefix when builtinsPrefix is true", async t => {
    const context = await initPlugin({ builtinsPrefix: true })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: 'node:path'
        })
    }
})

test("Removes 'node:' prefix when builtinsPrefix is 'strip'", async t => {
    const context = await initPlugin({ builtinsPrefix: 'strip' })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: 'path'
        })
    }
})

test("Removes 'node:' prefix when builtinsPrefix is false", async t => {
    const context = await initPlugin({ builtinsPrefix: false })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: 'path'
        })
    }
})

test("Does NOT remove 'node:' prefix on prefixed-only builtins even with builtinsPrefix='strip'", async t => {
    const context = await initPlugin({ builtinsPrefix: 'strip' })
    for (const builtin of [ 'node:test', 'node:sqlite', 'node:sea' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: builtin
        })
    }
})

test("Does not recognize unprefixed 'test' / 'sqlite' / 'sea' as a Node builtins", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('node',   'index.js'), IGNORED)
    t.is(await context.resolveId('sqlite', 'index.js'), IGNORED)
    t.is(await context.resolveId('sea',    'index.js'), IGNORED)
})

test("Ignores 'node:' prefix when using builtinsPrefix='ignore'", async t => {
    const context = await initPlugin({ builtinsPrefix: 'ignore' })
    for (const builtin of [ 'node:path', 'path' ]) {
        t.like(await context.resolveId(builtin, 'index.js'), {
            id: builtin
        })
    }
})
