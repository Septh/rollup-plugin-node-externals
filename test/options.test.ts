import path from 'node:path'
import test from 'ava'
import { testProp, fc } from '@fast-check/ava'
import { Arbitrary } from 'fast-check'
import { call, type TestedPlugin } from './_common'
import externals, { type ExternalsOptions } from '../src/index'

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
    (t, options) => {
        try {
            externals(options)
            t.pass()
        }
        catch {
            t.fail()
        }
    }
)

test('Obeys "packagePath" option', async t => {
    const plugin = externals({
        packagePath: [
            path.join(__dirname, 'fixtures', 'monorepo', 'package.json'),
            path.join(__dirname, 'fixtures', 'simple', 'package.json'),
            path.join(__dirname, 'fixtures', 'test.json')
        ]
    }) as TestedPlugin

    for (const dependency of [ 'chalk', 'simple_dep', 'example' ]) {
        t.false(await call(plugin.resolveId, dependency))
    }
})

test('Does mark "dependencies" as external by default', async t => {
    const plugin = externals({
        packagePath: path.join(__dirname, 'fixtures', 'simple', 'package.json')
    }) as TestedPlugin

    t.false(await call(plugin.resolveId, 'simple_dep'))
})

test('Doest NOT mark "devDependencies" as external by default', async t => {
    const plugin = externals({
        packagePath: path.join(__dirname, 'fixtures', 'simple', 'package.json')
    }) as TestedPlugin

    t.is(await call(plugin.resolveId, 'simple_dev_dep'), null)
})
