import type { Plugin } from 'rollup'

// node-externals only implemented these two hooks
export type TestedPlugin = {
    buildStart: Plugin['buildStart']
    resolveId: Plugin['resolveId']
}

const fakePluginContext = {
    error(msg: string) {
        throw new Error(msg)
    },

    warn(msg: string) {
        console.warn(msg)
    }
}

export async function call(hook: TestedPlugin[keyof TestedPlugin], ...args: any[]) {
    if (typeof hook === 'function')
        return (hook as any).apply(fakePluginContext, args)
    if (typeof hook === 'object' && 'handler' in hook)
        return (hook.handler as any).apply(fakePluginContext, args)

    throw new Error('Ooops')
}
