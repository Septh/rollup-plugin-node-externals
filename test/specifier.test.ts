import test from 'ava'
import { initPlugin, callHook } from './_common.js'

const testSpecifiers = {
    virtual:       [ '\\0virtual' ],
    absolute:      [ '/root.js' ],
    absoluteWin32: [ '/root.js', '\\root.js', 'C:\\root.js' ],
    bare:          [ 'bare' ],
    relative:      [ './sibling.js', '../parent.js' ],
    subpath:       [ 'lodash', 'lodash/flatten.js' ],
}

test("Always ignores virtual modules", async t => {
    const { plugin } = await initPlugin()
    for (const specifier of testSpecifiers.virtual) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed on: ${specifier}`)
    }
})

test("Always ignores absolute specifiers", async t => {
    const { plugin } = await initPlugin()
    for (const specifier of testSpecifiers[process.platform === 'win32' ? 'absoluteWin32' : 'absolute']) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed on: ${specifier}`)
    }
})

test("Always ignores relative specifiers", async t => {
    const { plugin } = await initPlugin()
    for (const specifier of testSpecifiers.relative) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed on: ${specifier}`)
    }
})

test("Does NOT mark bare specifiers external by default", async t => {
    const { plugin } = await initPlugin()
    for (const specifier of testSpecifiers.bare) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed on: ${specifier}`)
    }
})

test("Marks bare specifiers external when asked to", async t => {
    const { plugin } = await initPlugin({
        include: testSpecifiers.bare
    })
    for (const specifier of testSpecifiers.bare) {
        t.is(await callHook(plugin, 'resolveId', specifier), false, `Failed on: ${specifier}`)
    }
})

test("Marks subpath imports external (with regexes)", async t => {
    const { plugin } = await initPlugin({
        include: [ /^lodash/ ]
    })
    for (const specifier of testSpecifiers.subpath) {
        t.is(await callHook(plugin, 'resolveId', specifier), false, `Failed on: ${specifier}`)
    }
})
