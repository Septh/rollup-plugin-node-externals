import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    VERSION,
    type Plugin, type RollupError, type PluginContextMeta, type NormalizedInputOptions
} from 'rollup'
import { nodeExternals, type ExternalsOptions } from '../source/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class MockPluginContext {
    private readonly plugin: Plugin
    readonly warnings: string[]
    readonly meta: PluginContextMeta

    constructor(plugin: Plugin) {
        this.plugin = plugin
        this.warnings = []
        this.meta = {
            rollupVersion: VERSION,
            watchMode: false
        }
    }

    async buildStart() {
        let { buildStart: hook } = this.plugin
        if (typeof hook === 'object')
            hook = hook.handler
        if (typeof hook === 'function')
            return await hook.call(this as any, {} as NormalizedInputOptions)
        throw new Error('Oops')
    }

    async resolveId(specifier: string, importer?: string | undefined) {
        let { resolveId: hook } = this.plugin
        if (typeof hook === 'object')
            hook = hook.handler
        if (typeof hook === 'function')
            return await hook.call(this as any, specifier, importer, { attributes: {}, isEntry: typeof importer === 'string' ? false : true })
        throw new Error('Oops')
    }

    error(err: string | RollupError): never {
        const message: string = typeof err === 'string'
            ? err
            : err.message
        throw new Error(message)
    }

    warn(message: string): void {
        this.warnings.push(message)
    }

    addWatchFile(_file: string) {
        // nop
    }
}

export async function initPlugin(options: ExternalsOptions = {}) {
    const plugin = await nodeExternals(options)
    const context = new MockPluginContext(plugin)
    await context.buildStart()
    return context
}

export function fixture(...parts: string[]) {
    return path.join(__dirname, 'fixtures', ...parts)
}
