import fs from 'node:fs/promises'
import test from 'ava'
import { initPlugin, fixture } from './_common.ts'

// These two tests need to be run in sequence
test.serial('git monorepo usage', async t => {
    await fs.mkdir(fixture('01_monorepo/.git'), { recursive: true })
    process.chdir(fixture('01_monorepo/one'))

    // Should gather dependencies up to ./test/fixtures/01_monorepo
    const context = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // dependency in ./test/fixtures/01_monorepo/one/package.json (picked)
        'chalk'         // dependency in ./test/fixtures/01_monorepo/package.json (picked)
    ]) {
        t.false(await context.resolveId(dependency, 'index.js'))
    }

    // Should be ignored
    for (const dependency of [
        'react',        // dependency in ./test/fixtures/01_monorepo/two/package.json (not picked)
        'test-dep'      // dependency in ./test/fixtures/package.json (not picked)
    ]) {
        t.is(await context.resolveId(dependency, 'index.js'), null)
    }
})

test.serial('non-git monorepo usage', async t => {
    await fs.rmdir(fixture('01_monorepo/.git'))
    process.chdir(fixture('01_monorepo/one'))

    // Should gather dependencies up to . !
    const context = await initPlugin()

    // Should be external
    for (const dependency of [
        'moment',       // dependency in ./test/fixtures/01_monorepo/one/package.json (picked)
        'chalk',        // dependency in ./test/fixtures/01_monorepo/package.json (picked)
        'test-dep',     // dependency in ./test/fixtures/package.json (picked)
        'rollup',       // peer dependency in ./package.json (picked !)
    ]) {
        t.false(await context.resolveId(dependency, 'index.js'))
    }

    // Should be ignored
    for (const dependency of [
        'react'         // dependency in ./test/fixtures/01_monorepo/two/package.json (not picked)
    ]) {
        t.is(await context.resolveId(dependency, 'index.js'), null)
    }
})
