import { promisify } from 'node:util'
import cp from 'node:child_process'
import fs from 'node:fs/promises'
import test from 'ava'
import { initPlugin, fixture, EXTERNAL, IGNORED } from './_common.ts'

// Tests in this file need to be serial so they do not interfere with each other

test.serial('git monorepo usage', async t => {

    t.log('Creating temporary git repo...')
    process.chdir(fixture('01_monorepo'))
    const execFile = promisify(cp.execFile)
    await execFile('git', [ 'init' ] )

    t.teardown(async () => {
        t.log('Removing temporary git repo...')
        process.chdir(fixture('01_monorepo'))
        await fs.rm('.git', { recursive: true, force: true })
    })

    // Should gather dependencies up to ./test/fixtures/01_monorepo
    process.chdir(fixture('01_monorepo/one'))
    const context = await initPlugin()

    // Should be external
    for (const dependency of [ 'monorepo-one-dep', 'monorepo-dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), EXTERNAL)
    }

    // Should be ignored
    for (const dependency of [ 'monorepo-two-dep', 'dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), IGNORED)
    }
})

test.serial('non-git monorepo usage', async t => {

    // Should gather dependencies up to / !
    process.chdir(fixture('01_monorepo/one'))
    const context = await initPlugin()

    // Should be external
    for (const dependency of [
        'monorepo-one-dep', 'monorepo-dep', 'dep',
        'rollup',   // peer dependency in ./package.json (picked !)
    ]) {
        t.is(await context.resolveId(dependency, 'index.js'), EXTERNAL)
    }

    // Should be ignored
    for (const dependency of [ 'monorepo-two-dep' ]) {
        t.is(await context.resolveId(dependency, 'index.js'), IGNORED)
    }
})
