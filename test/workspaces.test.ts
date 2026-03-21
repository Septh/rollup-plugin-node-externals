import test from 'ava'
import { initPlugin, fixture, EXTERNAL, IGNORED } from './_common.ts'

// Tests in this file need to be serial so they do not interfere with each other

test.serial('npm/yarn workspaces usage', async t => {
    process.chdir(fixture('02_workspaces/npm-and-yarn/one'))
    const context = await initPlugin()

    // Should be external
    for (const dependency of [ 'workspaces-npm+yarn-one-dep', 'workspaces-npm+yarn-dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), EXTERNAL)
    }

    // Should be ignored
    for (const dependency of [ 'workspaces-npm+yarn-two-dep', 'workspaces-dep', 'dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), IGNORED)
    }
})

test.serial('pnpm workspaces usage', async t => {
    process.chdir(fixture('02_workspaces/pnpm/one'))
    const context = await initPlugin()

    // Should be external
    for (const dependency of [ 'workspaces-pnpm-one-dep', 'workspaces-pnpm-dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), EXTERNAL)
    }

    // Should be ignored
    for (const dependency of [ 'workspaces-pnpm-two-dep', 'workspaces-dep', 'dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), IGNORED)
    }
})

test.serial('lerna usage', async t => {
    process.chdir(fixture('02_workspaces/lerna/one'))
    const plugin = await initPlugin()

    // Should be external
    for (const dependency of [ 'workspaces-lerna-one-dep', 'workspaces-lerna-dep' ]) {
        t.is(await plugin.resolveId(dependency, 'index.js'), EXTERNAL)
    }

    // Should be ignored
    for (const dependency of [ 'workspaces-lerna-two-dep', 'workspaces-dep', 'dep' ]) {
        t.is(await plugin.resolveId(dependency, 'index.js'), IGNORED)
    }
})
