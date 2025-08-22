import { promisify } from 'node:util'
import cp from 'node:child_process'
import fs from 'node:fs/promises'
import test from 'ava'
import { initPlugin, fixture } from './_common.ts'

// The two tests in this file need to be run in sequence so one does not interfere with the other

test.serial('git monorepo usage', async t => {

    t.log('Creating temporary git repo...')
    process.chdir(fixture('01_monorepo'))
    const execFile = promisify(cp.execFile)
    await execFile('git', [ 'init' ] ).catch(() => {})

    t.teardown(async () => {
        t.log('Removing temporary git repo...')
        process.chdir(fixture('01_monorepo'))
        await fs.rm('.git', { recursive: true, force: true })
    })

    // Should gather dependencies up to ./test/fixtures/01_monorepo
    process.chdir(fixture('01_monorepo/one'))
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

    // Should gather dependencies up to / !
    process.chdir(fixture('01_monorepo/one'))
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
