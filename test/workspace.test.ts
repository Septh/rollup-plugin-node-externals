import path from 'node:path'
import test from 'ava'
import { call, type TestedPlugin } from './_common'
import externals from '../src/index'

test('npm/yarn workspace usage', async t => {
    process.chdir(path.join(__dirname, 'fixtures', 'workspaces', 'npm-and-yarn', 'two'))

    const plugin = externals() as TestedPlugin

    // Declared in workspaces/npm-and-yarn/two/package.json (cwd), should be marked as external
    t.false(await call(plugin.resolveId, 'lodash'))

    // Declared in workspaces/npm-and-yarn/package.json, should be marked as external
    t.false(await call(plugin.resolveId, 'express'))

    // Declared in workspaces/npm-and-yarn/one/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'chalk'), null)

    // Declared in workspaces/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'rollup'), null)
})

test('pnpm workspace usage', async t => {
    process.chdir(path.join(__dirname, 'fixtures', 'workspaces', 'pnpm', 'two'))

    const plugin = externals() as TestedPlugin

    // Declared in workspaces/pnpm/two/package.json (cwd), should be marked as external
    t.false(await call(plugin.resolveId, 'lodash'))

    // Declared in workspaces/pnpm/package.json, should be marked as external
    t.false(await call(plugin.resolveId, 'express'))

    // Declared in workspaces/pnpm/one/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'chalk'), null)

    // Declared in workspaces/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'rollup'), null)
})

test('lerna usage', async t => {
    process.chdir(path.join(__dirname, 'fixtures', 'workspaces', 'lerna', 'two'))

    const plugin = externals() as TestedPlugin

    // Declared in workspaces/lerna/two/package.json (cwd), should be marked as external
    t.false(await call(plugin.resolveId,'lodash'))

    // Declared in workspaces/lerna/package.json, should be marked as external
    t.false(await call(plugin.resolveId, 'express'))

    // Declared in workspaces/lerna/one/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'chalk'), null)

    // Declared in workspaces/package.json, should not be fetched
    t.is(await call(plugin.resolveId, 'rollup'), null)
})
