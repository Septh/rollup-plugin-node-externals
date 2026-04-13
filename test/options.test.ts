import test from 'ava'
import { testProp, fc } from '@fast-check/ava'
import type { Arbitrary } from 'fast-check'
import { initPlugin, fixture, EXTERNAL } from './_common.ts'
import { type ExternalsOptions } from '../source/index.ts'

// Ensures tests use local package.json
process.chdir(fixture())

// Returns an arbitrary for generating externals options objects
const externalsOptionsArbitrary = (): Arbitrary<ExternalsOptions> => fc.record({
    packagePath: fc.string(),
    builtins: fc.boolean(),
    builtinsPrefix: fc.oneof(fc.constant<'strip'>('strip'), fc.constant<'add'>('add'), fc.constant<'ignore'>('ignore')),
    deps: fc.boolean(),
    devDeps: fc.boolean(),
    peerDeps: fc.boolean(),
    optDeps: fc.boolean(),
    include: fc.oneof(fc.string(), fc.array(fc.string())),
    exclude: fc.oneof(fc.string(), fc.array(fc.string())),
}, { requiredKeys: [] })

testProp(
    'Does not throw on constructing plugin object for valid input',
    [externalsOptionsArbitrary()],
    async (t, options) => {
        try {
            await initPlugin(options)
            t.pass()
        }
        catch (err) {
            const { message } = err as Error
            message.startsWith('Cannot read') ? t.pass() : t.fail(message)
        }
    }
)

test("Warns when given invalid truthy value in 'include'/'exclude'", async t => {
    const okay = 'some_dep' // string is ok
    const notOkay = 1       // number is not (unless 0, which is falsy)

    const context = await initPlugin({
        include: [ okay, notOkay as any ],
        exclude: [ okay, notOkay as any ],
    })

    t.is(context.warnings.length, 2)
    t.is(context.warnings[0], `Ignoring wrong entry type #1 in 'include' option: ${JSON.stringify(notOkay)}.`)
    t.is(context.warnings[1], `Ignoring wrong entry type #1 in 'exclude' option: ${JSON.stringify(notOkay)}.`)
})

test("Warns when given invalid truthy value in 'packagePath'", async t => {
    const okay = './package.json'   // string is ok
    const notOkay = 1               // number is not (unless 0, which is falsy)

    const context = await initPlugin({
        packagePath: [ okay, notOkay as any ]
    })

    t.is(context.warnings.length, 1)
    t.is(context.warnings[0], `Ignoring wrong entry type #1 in 'packagePath' option: ${JSON.stringify(notOkay)}.`)
})

test("Obeys 'packagePath' option (single file name)", async t => {
    const context = await initPlugin({
        packagePath: '00_simple/package.json'
    })
    t.is(await context.resolveId('simple-dep', 'index.js'), EXTERNAL)
})

test("Obeys 'packagePath' option (multiple file names)", async t => {
    const context = await initPlugin({
        packagePath: [
            '00_simple/package.json',
            '01_monorepo/package.json'
        ]
    })

    // Should be external
    for (const dependency of [ 'simple-dep', 'monorepo-dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), EXTERNAL)
    }
})
