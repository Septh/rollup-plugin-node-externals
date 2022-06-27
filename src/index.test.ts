import test from 'ava'
import { testProp, fc } from 'ava-fast-check'
import { Arbitrary } from 'fast-check'
import { PluginContext, Plugin, NormalizedInputOptions } from 'rollup'
import externals, { ExternalsOptions } from './index'
import { join } from "path"

type TestedPlugin = Required<Plugin> & PluginContext
const fakeInputOptions = {} as NormalizedInputOptions

// Returns an arbitrary for generating externals options objects
const externalsOptionsArbitrary = (): Arbitrary<ExternalsOptions> => fc.record({
    packagePath: fc.string(),
    builtins: fc.boolean(),
    prefixedBuiltins: fc.oneof(fc.boolean(), fc.constant<'strip'>('strip'), fc.constant<'add'>('add')),
    deps: fc.boolean(),
    devDeps: fc.boolean(),
    peerDeps: fc.boolean(),
    optDeps: fc.boolean(),
    include: fc.oneof(fc.string(), fc.array(fc.string())),
    exclude: fc.oneof(fc.string(), fc.array(fc.string()))
}, { withDeletedKeys: true })

testProp(
    'does not throw on constructing plugin object for valid input',
    [externalsOptionsArbitrary()],
    (t, options) => {
        try {
            externals(options)
            t.pass()
        } catch {
            t.fail()
        }
    }
)

test('marks "dependencies" as external by default', async t => {
    process.chdir(__dirname)

    const source = 'example'
    const plugin = externals({ packagePath: './fixtures/test.json' }) as TestedPlugin

    await plugin.buildStart(fakeInputOptions)
    t.false(await plugin.resolveId(source))
})

const path = (...paths: string[]): string => join(__dirname, ...paths)

test.serial('monorepo usage', async t => {
    const cwd = path('fixtures/monorepo/packages/package')
    process.chdir(cwd)

    const plugin = externals() as TestedPlugin
    await plugin.buildStart(fakeInputOptions)

    for (const source of ['@babel/core', 'typescript', 'rollup', 'lodash', 'express', 'chalk']) {
        t.false(await plugin.resolveId(source))
    }
})

test('prefixedBuiltins === false', async t => {
    const plugin = externals({ prefixedBuiltins: false }) as TestedPlugin
    await plugin.buildStart(fakeInputOptions)

    for (const source of [ 'node:path', 'path' ]) {
        t.false(await plugin.resolveId(source))
    }
})

test('prefixedBuiltins === true (default)', async t => {
    const plugin = externals({ prefixedBuiltins: true }) as TestedPlugin
    await plugin.buildStart(fakeInputOptions)

    for (const source of [ 'node:path', 'path' ]) {
        t.deepEqual(
            await plugin.resolveId(source),
            { id: 'node:path', external: true }
        )
    }
})

test('prefixedBuiltins === "strip"', async t => {
    const plugin = externals({ prefixedBuiltins: 'strip' }) as TestedPlugin
    await plugin.buildStart(fakeInputOptions)

    for (const source of [ 'node:path', 'path' ]) {
        t.deepEqual(
            await plugin.resolveId(source),
            { id: 'path', external: true }
        )
    }
})

test('prefixedBuiltins === "add"', async t => {
    const plugin = externals({ prefixedBuiltins: 'add' }) as TestedPlugin
    await plugin.buildStart(fakeInputOptions)

    for (const source of [ 'node:path', 'path' ]) {
        t.deepEqual(
            await plugin.resolveId(source),
            { id: 'node:path', external: true }
        )
    }
})
