import test from 'ava'
import { initPlugin, callHook } from './_common'
import type { ExternalsOptions } from '../src/index'

const noDeps: ExternalsOptions = {
    builtins: false,
    deps: false,
    devDeps: false,
    optDeps: false,
    peerDeps: false
}

test.only("Does NOT filter out relative specifiers by default", async t => {
    const relativeSpecifiers = [ './sibling.js', '../parent.js' ]

    const { plugin } = await initPlugin(noDeps)
    for (const identifier of relativeSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', identifier), null)
    }
})

test("Filters out relative specifiers when asked to", async t => {
    const relativeSpecifiers = [ './sibling.js', '../parent.js' ]

    const { plugin } = await initPlugin({
        ...noDeps,
        include: relativeSpecifiers
    })
    for (const identifier of relativeSpecifiers) {
        t.false(await callHook(plugin, 'resolveId', identifier))
    }
})

test("Does NOT filter out absolute specifiers by default", async t => {
    const absoluteSpecifiers = [ '/root.js' ]
    if (process.platform === 'win32')
        absoluteSpecifiers.push('C:\\root.js', '\\root.js')

    const { plugin } = await initPlugin(noDeps)
    for (const identifier of absoluteSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', identifier), null, `Failed id: ${identifier}`)
    }
})

test("Filters out absolute specifiers when asked to", async t => {
    const absoluteSpecifiers = [ '/root.js' ]
    if (process.platform === 'win32')
        absoluteSpecifiers.push('C:\\root.js', '\\root.js')

    const { plugin } = await initPlugin({
        ...noDeps,
        include: absoluteSpecifiers
    })
    for (const identifier of absoluteSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', identifier), null, `Failed id: ${identifier}`)
    }
})
