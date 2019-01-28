// A Rollup plugin that automatically declares NodeJS built-in modules
// and npm dependencies as 'external'.
// Useful when bundling a NodeJS or an Electron app and you don't want to bundle
// npm modules with your own code but rather require() them at runtime.
import { resolve } from 'path'
import { PluginImpl } from 'rollup'

export interface Options {
    deps?:     boolean
    devDeps?:  boolean
    peerDeps?: boolean
    optDeps?:  boolean
    except?:   string | RegExp | (string | RegExp)[]
}

const externals: PluginImpl<Options> = (options = {}) => {

    const opts: Options = Object.assign({
        deps:     true,
        devDeps:  true,
        peerDeps: true,
        optDeps:  true,
        except:   []
    }, options)

    // Node built-in modules are always external
    let externals: string[] = require('builtin-modules')

    // Conditionally add dependencies, devDependencies, peerDependencies and optionalDependencies
    const pkg = require(resolve(process.cwd(), 'package.json'))
    externals = externals.concat(
        opts.deps     ? Object.keys(pkg.dependencies         || {}) : [],
        opts.devDeps  ? Object.keys(pkg.devDependencies      || {}) : [],
        opts.peerDeps ? Object.keys(pkg.peerDependencies     || {}) : [],
        opts.optDeps  ? Object.keys(pkg.optionalDependencies || {}) : []
    )

    // Filter out modules that are to be kept as internal
    const warnings: string[] = []
    const keep: RegExp[] = [].concat(<any>opts.except).map( (entry: string | RegExp, index: number) => {
        if (entry instanceof RegExp) {
            return entry
        }
        else if (typeof entry === 'string') {
            return new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
        }
        else {
            warnings.push(`Ignoring wrong entry type #${index} in 'except' option: ${entry}`)
            return /(?=not)possible/
        }
    })

    externals = externals.filter(name => !keep.some(regex => regex.test(name)))

    return {
        name: 'node-externals',

        options(config) {

            // Update the `external` option in config
            if (typeof config.external === 'function') {
                const old_fn = config.external
                config.external = (id, parent, isResolved) => old_fn(id, parent, isResolved) || externals.includes(id)
            }
            else if (Array.isArray(config.external)) {
                config.external = config.external.concat(externals)
            }
            else if (typeof config.external === 'undefined') {
                config.external = externals
            }
        },

        buildStart() {
            let msg
            while (msg = warnings.shift()) {
                this.warn(msg)
            }
        }
    }
}

export default externals
