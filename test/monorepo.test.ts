import fs from 'node:fs/promises'
import test from 'ava'
import { initPlugin, callHook, fixture } from './_common.ts'

// These two tests need to be run in sequence
test.serial('git monorepo usage', async t => {
    await fs.mkdir(fixture('01_monorepo/.git'), { recursive: true })
    process.chdir(fixture('01_monorepo/one'))

    const { plugin } = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // 01_monorepo/one/package.json
        'chalk'         // 01_monorepo/package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency))
    }

    // Should be ignored
    for (const dependency of [
        'react',        // 01_monorepo/two/package.json
        'test-dep'      // ./package.json
    ]) {
        t.is(await callHook(plugin, 'resolveId', dependency), null)
    }
})

test.serial('no-git monorepo usage', async t => {
    await fs.rmdir(fixture('01_monorepo/.git'))
    process.chdir(fixture('01_monorepo/one'))

    const { plugin } = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // 01_monorepo/one/package.json
        'chalk',        // 01_monorepo/package.json
        'test-dep'      // ./package.json
    ]) {
        t.false(await callHook(plugin, 'resolveId', dependency))
    }

    // Should be ignored
    t.is(await callHook(plugin, 'resolveId', 'react'), null)
})
