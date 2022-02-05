import test from 'ava'
import { join } from 'path'
import { findPackagePaths, findDependencies } from './dependencies'

const path = (...paths: string[]): string => join(__dirname, ...paths)

test.serial('finds package paths in git monorepo', async t => {
    const cwd = path('fixtures/monorepo/packages/package')
    process.chdir(cwd)

    const packagePaths = [
        path('fixtures/monorepo/packages/package/package.json'),
        path('fixtures/monorepo/package.json'),
    ]

    // Should have two assertions
    t.plan(2)

    for await (const packagePath of findPackagePaths()) {
        t.is(packagePath, packagePaths.shift() as string)
    }
})

test.serial('finds package paths in non-git monorepo', async t => {
    const cwd = path('fixtures/monorepo-no-git/packages/package')
    process.chdir(cwd)

    const packagePaths = [
        path('fixtures/monorepo-no-git/packages/package/package.json'),
        path('fixtures/monorepo-no-git/package.json'),
        path('../package.json')
    ]

    // Should have three assertions
    t.plan(3)

    for await (const packagePath of findPackagePaths()) {
        t.is(packagePath, packagePaths.shift() as string)
    }
})

test.serial('finds dependencies in monorepo', async t => {
    const cwd = path('fixtures/monorepo/packages/package')
    process.chdir(cwd)

    const dependencies = await findDependencies({
        packagePaths: findPackagePaths(),
        keys: ['dependencies'],
        warnings: []
    })

    t.deepEqual(new Set(dependencies.sort()), new Set([
        ...Object.keys(require(path('./fixtures/monorepo/packages/package/package.json')).dependencies ?? {}),
        ...Object.keys(require(path('./fixtures/monorepo/package.json')).dependencies ?? {})
    ].sort()))
})

test.serial('finds dev dependencies in monorepo', async t => {
    const cwd = path('fixtures/monorepo/packages/package')
    process.chdir(cwd)

    const devDependencies = await findDependencies({
        packagePaths: findPackagePaths(),
        keys: ['devDependencies'],
        warnings: []
    })

    t.deepEqual(new Set(devDependencies.sort()), new Set([
        ...Object.keys(require(path('./fixtures/monorepo/packages/package/package.json')).devDependencies ?? {}),
        ...Object.keys(require(path('./fixtures/monorepo/package.json')).devDependencies ?? {})
    ].sort()))
})
