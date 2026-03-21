import test from 'ava'
import { initPlugin, fixture, EXTERNAL, IGNORED } from './_common.ts'

const specifiers = {
    virtual:       [ '\\0virtual' ],
    absolutePosix: [ '/root.js' ],
    absoluteWin32: [ '/root.js', '\\root.js', 'C:\\root.js' ],
    bare:          [ 'foo', 'bar' ],
    relative:      [ './sibling.js', '../parent.js' ],
    subpath:       [ 'lodash', 'lodash/flatten' ],
}

// Ensures tests use local package.json
process.chdir(fixture())

test("Always ignores bundle entry point", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('./path/to/entry.js'), IGNORED)
})

test("Always ignores virtual modules from other plugins", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId(specifiers.virtual[0], undefined), IGNORED, `Failed without importer`)
    t.is(await context.resolveId(specifiers.virtual[0], 'file.js'), IGNORED, `Failed with importer`)
})

test("Always ignores absolute specifiers", async t => {
    const context = await initPlugin()
    for (const specifier of (process.platform === 'win32' ? specifiers.absoluteWin32 : specifiers.absolutePosix)) {
        t.is(await context.resolveId(specifier, undefined), IGNORED, `Failed on: ${specifier} without importer`)
        t.is(await context.resolveId(specifier, 'file.js'), IGNORED, `Failed on: ${specifier} with importer`)
    }
})

test("Always ignores relative specifiers", async t => {
    const context = await initPlugin({ include: specifiers.relative })
    for (const specifier of specifiers.relative) {
        t.is(await context.resolveId(specifier, undefined), IGNORED, `Failed on: ${specifier} without importer`)
        t.is(await context.resolveId(specifier, 'file.js'), IGNORED, `Failed on: ${specifier} with importer`)
    }
})

test("Always ignores bare specifiers that are not dependencies", async t => {
    const context = await initPlugin({ deps: true, peerDeps: true, optDeps: true, devDeps: true })
    t.is(await context.resolveId('not-a-dep', 'index.js'), IGNORED)
})

test("Marks dependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('dep', 'index.js'), EXTERNAL)
})

test("Does NOT mark dependencies external when deps=false", async t => {
    const context = await initPlugin({ deps: false })
    t.is(await context.resolveId('dep', 'index.js'), IGNORED)
})

test("Does NOT mark excluded dependencies external", async t => {
    const context = await initPlugin({ exclude: 'dep' })
    t.is(await context.resolveId('dep', 'index.js'), IGNORED)
})

test("Marks peerDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('peerdep', 'index.js'), EXTERNAL)
})

test("Does NOT mark peerDependencies external when peerDeps=false", async t => {
    const context = await initPlugin({ peerDeps: false })
    t.is(await context.resolveId('peerdep', 'index.js'), IGNORED)
})

test("Does NOT mark excluded peerDependencies external", async t => {
    const context = await initPlugin({ exclude: 'peerdep' })
    t.is(await context.resolveId('peerdep', 'index.js'), IGNORED)
})

test("Marks optionalDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('optdep', 'index.js'), EXTERNAL)
})

test("Does NOT mark optionalDependencies external when optDeps=false", async t => {
    const context = await initPlugin({ optDeps: false })
    t.is(await context.resolveId('optdep', 'index.js'), IGNORED)
})

test("Does NOT mark excluded optionalDependencies external", async t => {
    const context = await initPlugin({ exclude: 'optdep' })
    t.is(await context.resolveId('optdep', 'index.js'), IGNORED)
})

test("Does NOT mark devDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('devdep', 'index.js'), IGNORED)
})

test("Marks devDependencies external when devDeps=true", async t => {
    const context = await initPlugin({ devDeps: true })
    t.is(await context.resolveId('devdep', 'index.js'), EXTERNAL)
})

test("Marks included devDependencies external", async t => {
    const context = await initPlugin({ include: 'devdep' })
    t.is(await context.resolveId('devdep', 'index.js'), EXTERNAL)
})

test("Subpath imports do not prevent dependencies/peerDependencies/optionalDependencies from being marked external", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('dep/sub',      'index.js'), EXTERNAL)
    t.is(await context.resolveId('peerdep/sub', 'index.js'), EXTERNAL)
    t.is(await context.resolveId('optdep/sub',  'index.js'), EXTERNAL)
})

test("Marks both dependency and dependency/subpath as external (with regex)", async t => {
    const context = await initPlugin({ include: /^devdep/ })
    t.is(await context.resolveId('devdep',     'index.js'), EXTERNAL)
    t.is(await context.resolveId('devdep/sub', 'index.js'), EXTERNAL)
})

test("exclude has precedence over include (builtins)", async t => {
    const context = await initPlugin({ include: 'node:fs', exclude: 'node:fs' })
    t.like(await context.resolveId('node:fs', 'index.js'), { external: false })
})

test("exclude has precedence over include (dependencies)", async t => {
    const context = await initPlugin({ include: 'dep', exclude: 'dep' })
    t.is(await context.resolveId('dep', 'index.js'), IGNORED)
})

test("exclude has precedence over include (with regexes)", async t => {
    const context = await initPlugin({ devDeps: true, exclude: /^devdep\/sub/ })
    t.is(await context.resolveId('devdep',     'index.js'), EXTERNAL)
    t.is(await context.resolveId('devdep/sub', 'index.js'), IGNORED)
})

test("Normal dependencies have precedence over devDependencies", async t => {
    const context = await initPlugin({ packagePath: '04_dual/package.json' })
    t.is(await context.resolveId('dual-dep', 'index.js'), EXTERNAL)
})
