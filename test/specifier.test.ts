import test from 'ava'
import { initPlugin, callHook, noDepsAtAllOptions } from './_common.js'

test("Does NOT filter out relative specifiers by default", async t => {
    const relativeSpecifiers = [ './sibling.js', '../parent.js' ]
    const { plugin } = await initPlugin(noDepsAtAllOptions)
    for (const specifier of relativeSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed id: ${specifier}`)
    }
})

test("Does NOT filter out relative specifiers, even when asked to", async t => {
    const relativeSpecifiers = [ './sibling.js', '../parent.js' ]
    const { plugin } = await initPlugin({
        ...noDepsAtAllOptions,
        include: relativeSpecifiers
    })
    for (const specifier of relativeSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed id: ${specifier}`)
    }
})

test("Does NOT filter out absolute specifiers by default", async t => {
    const absoluteSpecifiers = [ '/root.js' ]
    if (process.platform === 'win32')
        absoluteSpecifiers.push('\\root.js', 'C:\\root.js')
    const { plugin } = await initPlugin(noDepsAtAllOptions)
    for (const specifier of absoluteSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed id: ${specifier}`)
    }
})

test("Does NOT filter out absolute specifiers, even when asked to", async t => {
    const absoluteSpecifiers = [ '/root.js' ]
    if (process.platform === 'win32')
        absoluteSpecifiers.push('\\root.js', 'C:\\root.js')
    const { plugin } = await initPlugin({
        ...noDepsAtAllOptions,
        include: absoluteSpecifiers
    })
    for (const specifier of absoluteSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed id: ${specifier}`)
    }
})

test("Does NOT filter out bare specifiers by default", async t => {
    const bareSpecifiers = [ 'dependency' ]
    const { plugin } = await initPlugin(noDepsAtAllOptions)
    for (const specifier of bareSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), null, `Failed id: ${specifier}`)
    }
})

test("Filters out bare specifiers when asked to", async t => {
    const bareSpecifiers = [ 'bare' ]
    const { plugin } = await initPlugin({
        ...noDepsAtAllOptions,
        include: bareSpecifiers
    })
    for (const specifier of bareSpecifiers) {
        t.is(await callHook(plugin, 'resolveId', specifier), false, `Failed id: ${specifier}`)
    }
})
