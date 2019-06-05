/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and npm dependencies as 'external'.
 *
 * Useful when bundling a NodeJS or an Electron app and you don't want to bundle
 * node/npm modules with your own code but rather require() them at runtime.
 */
import { resolve } from 'path'
import { Plugin, ResolveIdResult } from 'rollup'
import * as builtinModules from 'builtin-modules'

export interface ExternalsOptions {
    builtins: boolean
    deps: boolean
    devDeps: boolean
    peerDeps: boolean
    optDeps: boolean
    include: string | RegExp | (string | RegExp)[]
    exclude: string | RegExp | (string | RegExp)[]
    /** @deprecated. Use include/exclude instead. */
    except: string | RegExp | (string | RegExp)[]
}

/** For backward compatibility. Use `ExternalsOptions` instead. */
export type ExternalOptions = ExternalsOptions

// The plugin implementation
function externals(options: Partial<ExternalsOptions> = {}): Plugin {

    // Store eventual warnings until we can display them
    const warnings: string[] = []

    // Consolidate options
    const opts: ExternalsOptions = {
        builtins: true,
        deps: false,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        include: [],
        exclude: [],
        except: [],
        ...options
    }

    // Map the include and exclude options to arrays of regexes
    const [ include, exclude, except ] = [ 'include', 'exclude', 'except' ].map(option => new Array()
        .concat((opts as any)[option])
        .map((entry: string | RegExp, index: number): RegExp => {
            if (entry instanceof RegExp) {
                return entry
            }
            else if (typeof entry === 'string') {
                return new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
            }
            else {
                warnings.push(`Ignoring wrong entry type #${index} in '${option}' option: '${entry}'`)
                return /(?=no)match/
            }
        })
    )

    if (except.length > 0) {
        warnings.push("'except' option is deprecated, please use include/exclude instead")
        exclude.push(...except)
    }

    // Build a function to filter out unwanted dependencies
    const f: (dep: string) => boolean = dep => !exclude.some(rx => rx.test(dep))

    // Filter NodeJS builtins
    const builtins = (opts.builtins ? builtinModules : []).filter(f)

    // Filter deps from package.json
    let pkg
    try {
        pkg = require(resolve(process.cwd(), 'package.json'))
    }
    catch {
        warnings.push("couldn't read package.json, please make sure it exists in the same directory as rollup.config.js")
        pkg = Object.create(null)
    }
    const dependencies: string[] = [
        ...(opts.deps     ? Object.keys(pkg.dependencies         || {}) : []),
        ...(opts.devDeps  ? Object.keys(pkg.devDependencies      || {}) : []),
        ...(opts.peerDeps ? Object.keys(pkg.peerDependencies     || {}) : []),
        ...(opts.optDeps  ? Object.keys(pkg.optionalDependencies || {}) : [])
    ].filter(f)

    // Build the final regexes
    const externals: RegExp[] = []
    if (builtins.length > 0) {
        externals.push(new RegExp('^(?:' + builtins.join('|') + ')$'))
    }
    if (dependencies.length > 0) {
        externals.push(new RegExp('^(?:' + dependencies.join('|') + ')$'))
    }
    if (include.length > 0) {
        externals.push(...include)
    }

    return {
        name: 'node-externals',

        resolveId(importee, importer): ResolveIdResult {
            // Only return something if we handled this id,
            // otherwise we let Rollup and other plugins handle it
            if (importer && !/\0/.test(importee)) {
                if (externals.some(ext => ext.test(importee))) {
                    // console.log('External: %O', importee)
                    return false
                }
            }
        },

        buildStart() {
            let msg: string | undefined
            while (msg = warnings.shift()) {
                this.warn(msg)
            }
        }
    }
}

export default externals
