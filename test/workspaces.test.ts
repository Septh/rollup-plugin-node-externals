import test from 'ava'
import { initPlugin, callHook, fixture } from './_common.ts'

test('npm/yarn workspaces usage', async t => {
    process.chdir(fixture('02_workspaces/npm-and-yarn/one'))
    const { plugin } = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // 02_workspaces/npm-and-yarn/one/package.json
        'chalk'         // 02_workspaces/npm-and-yarn/package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency, 'index.js'))
    }

    // Should be ignored
    for (const dependency of [
        'react',        // 02_workspaces/npm-and-yarn/two/package.json
        'rollup',       // 02_workspaces/package.json
        'test-dep'      // ./package.json
    ]) {
        t.is(await callHook(plugin, 'resolveId', dependency, 'index.js'), null)
    }
})

test('pnpm workspaces usage', async t => {
    process.chdir(fixture('02_workspaces/pnpm/one'))
    const { plugin } = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // 02_workspaces/pnpm/one/package.json
        'chalk'         // 02_workspaces/pnpm/package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency, 'index.js'))
    }

    // Should be ignored
    for (const dependency of [
        'react',        // 02_workspaces/pnpm/two/package.json
        'rollup',       // 02_workspaces/package.json
        'test-dep'      // ./package.json
    ]) {
        t.is(await callHook(plugin, 'resolveId', dependency, 'index.js'), null)
    }
})

test('lerna usage', async t => {
    process.chdir(fixture('02_workspaces/lerna/one'))
    const { plugin } = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // 02_workspaces/lerna/one/package.json
        'chalk'         // 02_workspaces/lerna/package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency, 'index.js'))
    }

    // Should be ignored
    for (const dependency of [
        'react',        // 02_workspaces/lerna/two/package.json
        'rollup',       // 02_workspaces/package.json
        'test-dep'      // ./package.json
    ]) {
        t.is(await callHook(plugin, 'resolveId', dependency, 'index.js'), null)
    }
})
