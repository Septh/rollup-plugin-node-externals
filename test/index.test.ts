import path from 'node:path'
import fs from 'node:fs/promises'
import test from 'ava'
import { testProp, fc } from '@fast-check/ava'
import { Arbitrary } from 'fast-check'
import { type Plugin, type PluginContext } from 'rollup'
import externals, { type ExternalsOptions } from '../src/index'

type TestedPlugin = Plugin & PluginContext

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

testProp.serial(
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

test.serial('Obeys "packagePath" option', async t => {
    const plugin = externals({
        deps: true,
        packagePath: [
            path.join(__dirname, 'fixtures', 'monorepo', 'package.json'),
            path.join(__dirname, 'fixtures', 'simple', 'package.json'),
            path.join(__dirname, 'fixtures', 'test.json')
        ]
    }) as TestedPlugin

    for (const builtin of [ 'chalk', 'simple_dep', 'example' ]) {
        t.false(await plugin.resolveId(builtin))
    }
})

test.serial('Does mark "dependencies" as external by default', async t => {
    const plugin = externals({
        packagePath: path.join(__dirname, 'fixtures', 'simple', 'package.json')
    }) as TestedPlugin

    t.false(await plugin.resolveId('simple_dep'))
})

test.serial('Doest NOT mark "devDependencies" as external by default', async t => {
    const plugin = externals({
        packagePath: path.join(__dirname, 'fixtures', 'simple', 'package.json')
    }) as TestedPlugin

    t.is(await plugin.resolveId('simple_dev_dep'), null)
})

test.serial('Adds "node:" prefix to builtins by default', async t => {
    const plugin = externals() as TestedPlugin

    for (const builtin of [ 'node:path', 'path' ]) {
        t.deepEqual(await plugin.resolveId(builtin), {
            id: 'node:path',
            external: true
        })
    }
})

test.serial('Removes "node:" prefix when option "builtinsPrefix" is set to "strip"', async t => {
    const plugin = externals({
        builtinsPrefix: 'strip'
    }) as TestedPlugin

    for (const builtin of [ 'node:path', 'path' ]) {
        t.deepEqual(await plugin.resolveId(builtin), {
            id: 'path',
            external: true
        })
    }
})

test.serial('git monorepo usage', async t => {
    await fs.mkdir(path.join(__dirname, 'fixtures', 'monorepo', '.git'), { recursive: true })
    process.chdir(path.join(__dirname, 'fixtures', 'monorepo', 'packages', 'package'))

    const plugin = externals({
        deps: true
    }) as TestedPlugin

    // Declared in monorepo/packages/package/package.json and monorepo/package.json
    for (const dep of [ 'lodash', 'express', 'moment', 'chalk' ])
        t.false(await plugin.resolveId(dep))

    // Declared in /package.json so should be ignored by plugin
    t.is(await plugin.resolveId('rollup'), null)
})


test.serial('no-git monorepo usage', async t => {
    await fs.rmdir(path.join(__dirname, 'fixtures', 'monorepo', '.git'))
    process.chdir(path.join(__dirname, 'fixtures', 'monorepo', 'packages', 'package'))

    const plugin = externals({
        deps: true
    }) as TestedPlugin

    // Declared in monorepo/packages/package/package.json and monorepo/package.json
    for (const dep of [ 'lodash', 'express', 'moment', 'chalk' ])
        t.false(await plugin.resolveId(dep))

    // Declared in /package.json so should be fetched by plugin
    t.false(await plugin.resolveId('rollup'))
})
