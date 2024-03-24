import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, RollupError, ObjectHook, PluginContextMeta, PluginHooks, PluginContext, NormalizedInputOptions } from 'rollup'
import { nodeExternals, type ExternalsOptions } from '../source/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class MockPluginContext {
    private readonly externals: Plugin
    readonly warnings: string[]
    readonly meta: PluginContextMeta

    constructor(externals: Plugin) {
        this.externals = externals
        this.warnings = []
        this.meta = {
            rollupVersion: '4.9.6',
            watchMode: false
        }
    }

    async buildStart() {
        let { buildStart } = this.externals
        if (typeof buildStart === 'object')
            buildStart = buildStart.handler
        if (typeof buildStart === 'function')
            return await buildStart.call(this as any, {} as NormalizedInputOptions)
        throw new Error('Ooops')
    }

    async resolveId(specifier: string, importer: string | undefined) {
        let { resolveId } = this.externals
        if (typeof resolveId === 'object')
            resolveId = resolveId.handler
        if (typeof resolveId === 'function')
            return await resolveId.call(this as any, specifier, importer, { attributes: {}, isEntry: typeof importer === 'string' ? false : true })
        throw new Error('Ooops')
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
