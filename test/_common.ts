import path from 'node:path'
import type { Plugin, RollupError, ObjectHook } from 'rollup'
import { externals, type ExternalsOptions } from '../src/index'

const warnings: string[] = []
const fakePluginContext = {
    meta: {
        watchMode: false
    },

    error(err: string | RollupError): never {
        const message: string = typeof err === 'string'
            ? err
            : err.message
        throw new Error(message)
    },

    warn(message: string): void {
        warnings.push(message)
    }
}

// node-externals only implements these hooks
type ImplementedHooks =
    | 'buildStart'
    | 'resolveId'

// This config makes for empty include[] and exclude[] patterns.
export const noDepsAtAllOptions: ExternalsOptions = {
    packagePath: path.join(__dirname, 'fixtures/no-deps.package.json'),
    builtins: false,
    deps: false,
    devDeps: false,
    optDeps: false,
    peerDeps: false
}

export async function callHook(plugin: Plugin, hookName: ImplementedHooks, ...args: any[]) {
    const hook = plugin[hookName] as ObjectHook<(this: typeof fakePluginContext, ...args: any) => any>
    if (typeof hook === 'function')
        return hook.apply(fakePluginContext, args)
    if (typeof hook === 'object' && typeof hook.handler === 'function')
        return hook.handler.apply(fakePluginContext, args)
    throw new Error('Ooops')
}

export async function initPlugin(options: ExternalsOptions = {}): Promise<{ plugin: Plugin, warnings: string[] }> {
    warnings.splice(0, Infinity)

    const plugin = externals(options)
    await callHook(plugin, 'buildStart')
    return { plugin, warnings }
}

export function fixture(...parts: string[]) {
    return path.join(__dirname, 'fixtures', ...parts)
}
