import test from 'ava'
import { testProp, fc } from '@fast-check/ava'
import type { Arbitrary } from 'fast-check'
import { initPlugin, callHook, fixture } from './_common'
import { type ExternalsOptions } from '../src/index'

// Ensures tests use local package.json
process.chdir(fixture())

// Returns an arbitrary for generating externals options objects
const externalsOptionsArbitrary = (): Arbitrary<ExternalsOptions> => fc.record({
    packagePath: fc.string(),
    builtins: fc.boolean(),
    builtinsPrefix: fc.oneof(fc.constant<'strip'>('strip'), fc.constant<'add'>('add')),
    deps: fc.boolean(),
    devDeps: fc.boolean(),
    peerDeps: fc.boolean(),
    optDeps: fc.boolean(),
    include: fc.oneof(fc.string(), fc.array(fc.string())),
    exclude: fc.oneof(fc.string(), fc.array(fc.string())),
}, { withDeletedKeys: true })

testProp(
    'Does not throw on constructing plugin object for valid input',
    [externalsOptionsArbitrary()],
    async (t, options) => {
        try {
            await initPlugin(options, false)
            t.pass()
        }
        catch {
            t.fail()
        }
    }
)

// Must be serial because it uses the 'warnings' global in _common.ts.
test.serial("Warns when given invalid include or exclude entry", async t => {
    const okay = 'some_dep' // string is ok
    const notOkay = 1       // number is not (unless 0, which is falsy)

    const { warnings } = await initPlugin({
        include: [ okay, notOkay as any ]
    })

    t.is(warnings.length, 1)
    t.is(warnings[0], `Ignoring wrong entry type #1 in 'include' option: ${JSON.stringify(notOkay)}`)
})

test('Marks dependencies as external by default', async t => {
    const { plugin } = await initPlugin()
    t.false(await callHook(plugin, 'resolveId', 'test-dep'))
})

test('Does NOT mark devDependencies as external by default', async t => {
    const { plugin } = await initPlugin()
    t.is(await callHook(plugin, 'resolveId', 'test-dev-dep'), null)
})

test('Does mark devDependencies as external when using devDeps=true', async t => {
    const { plugin } = await initPlugin({
        devDeps: true
    })
    t.false(await callHook(plugin, 'resolveId', 'test-dev-dep'))
})

test("Obeys 'packagePath' option (single file name)", async t => {
    const { plugin } = await initPlugin({
        packagePath: '00_simple/package.json'
    })
    t.false(await callHook(plugin, 'resolveId', 'simple-dep'))
})

test("Obeys 'packagePath' option (multiple file names)", async t => {
    const { plugin } = await initPlugin({
        packagePath: [
            '00_simple/package.json',
            '01_monorepo/package.json'
        ]
    })

    // Should be external
    for (const dependency of [
        'simple-dep',   // 00_simple/package.json
        'chalk',        // 01_monorepo/package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency))
    }
})
