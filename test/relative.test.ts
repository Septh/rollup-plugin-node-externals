import test from 'ava'
import { initPlugin, callHook } from './_common'

test("Filters out relative specifiers", async t => {
    const relativeSpecifiers = [ './sibling.js', '../parent.js' ]

    const { plugin } = await initPlugin({
        include: relativeSpecifiers
    })
    for (const builtin of relativeSpecifiers) {
        t.false(await callHook(plugin, 'resolveId', builtin))
    }
})

test("Does NOT filter out absolute specifiers", async t => {
    const absoluteSpecifiers = [ '/root.js' ]
    if (process.platform === 'win32')
        absoluteSpecifiers.push('C:\\root.js', '\\root.js')

    const { plugin } = await initPlugin({
        include: absoluteSpecifiers
    })
    for (const builtin of absoluteSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', builtin), null)
    }
})
