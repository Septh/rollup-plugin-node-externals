import path from 'node:path'
import fs from 'node:fs/promises'
import test from 'ava'
import { call, type TestedPlugin } from './_common'
import externals from '../src/index'

/**
 * Those two below need to be run in sequence
 */
test.serial('git monorepo usage', async t => {
    await fs.mkdir(path.join(__dirname, 'fixtures', 'monorepo', '.git'), { recursive: true })
    process.chdir(path.join(__dirname, 'fixtures', 'monorepo', 'packages', 'package'))

    const plugin = externals() as TestedPlugin

    // Declared in monorepo/packages/package/package.json and monorepo/package.json
    for (const dep of [ 'lodash', 'express', 'moment', 'chalk' ])
        t.false(await call(plugin.resolveId, dep))

    // Declared in /package.json so should be ignored by plugin
    t.is(await call(plugin.resolveId, 'rollup'), null)
})

test.serial('no-git monorepo usage', async t => {
    await fs.rmdir(path.join(__dirname, 'fixtures', 'monorepo', '.git'))
    process.chdir(path.join(__dirname, 'fixtures', 'monorepo', 'packages', 'package'))

    const plugin = externals() as TestedPlugin

    // Declared in monorepo/packages/package/package.json and monorepo/package.json
    for (const dep of [ 'lodash', 'express', 'moment', 'chalk' ])
        t.false(await call(plugin.resolveId, dep))

    // Declared in /package.json so should be fetched by plugin
    t.false(await call(plugin.resolveId, 'rollup'))
})
