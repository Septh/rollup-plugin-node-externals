import test from 'ava'
import { initPlugin, fixture } from './_common.ts'

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
    t.is(await context.resolveId('./path/to/entry.js'), null)
})

test("Always ignores virtual modules from other plugins", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId(specifiers.virtual[0], undefined), null, `Failed without importer`)
    t.is(await context.resolveId(specifiers.virtual[0], 'file.js'), null, `Failed with importer`)
})

test("Always ignores absolute specifiers", async t => {
    const context = await initPlugin()
    for (const specifier of (process.platform === 'win32' ? specifiers.absoluteWin32 : specifiers.absolutePosix)) {
        t.is(await context.resolveId(specifier, undefined), null, `Failed on: ${specifier} without importer`)
        t.is(await context.resolveId(specifier, 'file.js'), null, `Failed on: ${specifier} with importer`)
    }
})

test("Always ignores relative specifiers", async t => {
    const context = await initPlugin({ include: specifiers.relative })
    for (const specifier of specifiers.relative) {
        t.is(await context.resolveId(specifier, undefined), null, `Failed on: ${specifier} without importer`)
        t.is(await context.resolveId(specifier, 'file.js'), null, `Failed on: ${specifier} with importer`)
    }
})

test("Always ignores bare specifiers that are not dependencies", async t => {
    const context = await initPlugin({ deps: true, peerDeps: true, optDeps: true, devDeps: true })
    t.is(await context.resolveId('not-a-dep', 'index.js'), null)
})

test("Marks dependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('test-dep', 'index.js'), false)
})

test("Does NOT mark dependencies external when deps=false", async t => {
    const context = await initPlugin({ deps: false })
    t.is(await context.resolveId('test-dep', 'index.js'), null)
})

test("Does NOT mark excluded dependencies external", async t => {
    const context = await initPlugin({ exclude: 'test-dep' })
    t.is(await context.resolveId('test-dep', 'index.js'), null)
})

test("Marks peerDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('test-peer-dep', 'index.js'), false)
})

test("Does NOT mark peerDependencies external when peerDeps=false", async t => {
    const context = await initPlugin({ peerDeps: false })
    t.is(await context.resolveId('test-peer-dep', 'index.js'), null)
})

test("Does NOT mark excluded peerDependencies external", async t => {
    const context = await initPlugin({ exclude: 'test-peer-dep' })
    t.is(await context.resolveId('test-peer-dep', 'index.js'), null)
})

test("Marks optionalDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('test-opt-dep', 'index.js'), false)
})

test("Does NOT mark optionalDependencies external when optDeps=false", async t => {
    const context = await initPlugin({ optDeps: false })
    t.is(await context.resolveId('test-opt-dep', 'index.js'), null)
})

test("Does NOT mark excluded optionalDependencies external", async t => {
    const context = await initPlugin({ exclude: 'test-opt-dep' })
    t.is(await context.resolveId('test-opt-dep', 'index.js'), null)
})

test("Does NOT mark devDependencies external by default", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('test-dev-dep', 'index.js'), null)
})

test("Marks devDependencies external when devDeps=true", async t => {
    const context = await initPlugin({ devDeps: true })
    t.is(await context.resolveId('test-dev-dep', 'index.js'), false)
})

test("Marks included devDependencies external", async t => {
    const context = await initPlugin({ include: 'test-dev-dep' })
    t.is(await context.resolveId('test-dev-dep', 'index.js'), false)
})

test("Subpath imports do not prevent dependencies/peerDependencies/optionalDependencies from being marked external", async t => {
    const context = await initPlugin()
    t.is(await context.resolveId('test-dep/sub',      'index.js'), false)
    t.is(await context.resolveId('test-peer-dep/sub', 'index.js'), false)
    t.is(await context.resolveId('test-opt-dep/sub',  'index.js'), false)
})

test("Marks both dependency and dependency/subpath as external (with regex)", async t => {
    const context = await initPlugin({ include: /^test-dev-dep/ })
    t.is(await context.resolveId('test-dev-dep',     'index.js'), false)
    t.is(await context.resolveId('test-dev-dep/sub', 'index.js'), false)
})

test("exclude has precedence over include (builtins)", async t => {
    const context = await initPlugin({ include: 'node:fs', exclude: 'node:fs' })
    t.like(await context.resolveId('node:fs', 'index.js'), { external: false })
})

test("exclude has precedence over include (dependencies)", async t => {
    const context = await initPlugin({ include: 'test-dep', exclude: 'test-dep' })
    t.is(await context.resolveId('test-dep', 'index.js'), null)
})

test("exclude has precedence over include (with regexes)", async t => {
    const context = await initPlugin({ devDeps: true, exclude: /^test-dev-dep\/sub/ })
    t.is(await context.resolveId('test-dev-dep',     'index.js'), false)
    t.is(await context.resolveId('test-dev-dep/sub', 'index.js'), null)
})

test("Normal dependencies have precedence over devDependencies", async t => {
    const context = await initPlugin({ packagePath: '04_dual/package.json' })
    t.is(await context.resolveId('dual-dep', 'index.js'), false)
})
