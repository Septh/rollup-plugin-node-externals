/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and npm dependencies as 'external'.
 *
 * Useful when bundling a NodeJS or an Electron app and you don't want to bundle
 * node/npm modules with your own code but rather require() them at runtime.
 */

/// <reference types="node" />
import { resolve } from 'path'
import { Plugin } from 'rollup'
import * as builtinModules from 'builtin-modules'

export interface ExternalsOptions {
    deps?: boolean
    devDeps?: boolean
    peerDeps?: boolean
    optDeps?: boolean
    except?: string | RegExp | (string | RegExp)[]
}

/** For backward compatibility. Use `ExternalsOptions` instead. */
export type ExternalOptions = ExternalsOptions

// The plugin implementation
const emptyObject = Object.create(null)
export default function externals(options: ExternalsOptions = {}): Plugin {

    const opts: ExternalsOptions = Object.assign({
        deps: true,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        except: []
    }, options)

    const pkg = require(resolve(process.cwd(), 'package.json'))

    const externals: string[] = [
        // Node built-in modules are always external
        ...builtinModules,

        // Conditionally add dependencies, devDependencies, peerDependencies and optionalDependencies
        ...(opts.deps     ? Object.keys(pkg.dependencies         || emptyObject) : []),
        ...(opts.devDeps  ? Object.keys(pkg.devDependencies      || emptyObject) : []),
        ...(opts.peerDeps ? Object.keys(pkg.peerDependencies     || emptyObject) : []),
        ...(opts.optDeps  ? Object.keys(pkg.optionalDependencies || emptyObject) : [])
    ]

    // Store eventual warnings until we can display them
    const warnings: string[] = []

    return {
        name: 'node-externals',

        options(config) {

            // Map the except option to an array of regexes
            const except: RegExp[] = []
                .concat(opts.except as any)
                .map( (entry: string | RegExp, index: number) => {
                    if (entry instanceof RegExp) {
                        return entry
                    }
                    else if (typeof entry === 'string') {
                        return new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
                    }
                    else {
                        warnings.push(`Ignoring wrong entry type #${index} in "except" option: "${entry}"`)
                        return /(?=cannot)match/
                    }
                })


            // Filter out modules that are to be kept as internal
            const external = externals.filter(name => !except.some(regex => regex.test(name)))

            // Update the `external` option in rollup.config.js
            if (typeof config.external === 'function') {
                const old_fn = config.external
                config.external = (id, parent, isResolved) => old_fn(id, parent, isResolved) || external.includes(id)
            }
            else if (Array.isArray(config.external)) {
                config.external = config.external.concat(external)
            }
            else if (typeof config.external === 'undefined') {
                config.external = external
            }
            else {
                warnings.push(`Unknown "external" entry type in Rollup config, node-externals is disabling itself as it doesn't know how to handle a "${typeof config.external}" .`)
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
