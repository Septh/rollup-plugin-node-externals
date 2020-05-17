/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and npm dependencies as 'external'.
 *
 * Useful when bundling a NodeJS or an Electron app and you don't want to bundle
 * node/npm modules with your own code but rather require() them at runtime.
 */
import { resolve } from 'path'
import { Plugin } from 'rollup'
import builtinModules from 'builtin-modules'

export interface ExternalsOptions {
    /** Path/to/your/package.json file. Defaults to the one in `process.cwd()`. */
    packagePath?: string
    /** Mark node built-in modules like `path`, `fs`... as external. Defaults to `true`. */
    builtins?: boolean
    /** Mark dependencies as external. Defaults to `false`. */
    deps?: boolean
    /** Mark devDependencies as external. Defaults to `true`. */
    devDeps?: boolean
    /** Mark peerDependencies as external. Defaults to `true`. */
    peerDeps?: boolean
    /** Mark optionalDependencies as external. Defaults to `true`. */
    optDeps?: boolean
    /** Force these deps in the list of externals, regardless of other settings. Defaults to `[]`  */
    include?: string | RegExp | (string | RegExp)[]
    /** Exclude these deps from the list of externals, regardless of other settings. Defaults to `[]`  */
    exclude?: string | RegExp | (string | RegExp)[]
    /** @deprecated Use `exclude` instead. */
    except?: string | RegExp | (string | RegExp)[]
}

/** For backward compatibility. Use `ExternalsOptions` instead. */
export type ExternalOptions = ExternalsOptions

// The plugin implementation
export default function externals(options: ExternalsOptions = {}): Plugin {

    // Store eventual warnings until we can display them
    const warnings: string[] = []

    // Consolidate options
    const opts: Required<ExternalsOptions> = {
        packagePath: resolve(process.cwd(), 'package.json'),
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
                if (!!entry) {
                    warnings.push(`Ignoring wrong entry type #${index} in '${option}' option: '${entry}'`)
                }
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
        pkg = require(opts.packagePath)
    }
    catch {
        warnings.push("couldn't read package.json, please make sure it exists in the same directory as rollup.config.js or use the 'packagePath' option.")
        pkg = Object.create(null)
    }
    const dependencies: string[] = [
        ...(opts.deps     ? Object.keys(pkg.dependencies         || {}) : []),
        ...(opts.devDeps  ? Object.keys(pkg.devDependencies      || {}) : []),
        ...(opts.peerDeps ? Object.keys(pkg.peerDependencies     || {}) : []),
        ...(opts.optDeps  ? Object.keys(pkg.optionalDependencies || {}) : [])
    ].filter(f)

    // Build the final regexes, include potential import from a sub directory (e.g. 'lodash/map')
    const externals: RegExp[] = []
    if (builtins.length > 0) {
        externals.push(new RegExp('^(?:' + builtins.join('|') + ')(\/.+)?$'))
    }
    if (dependencies.length > 0) {
        externals.push(new RegExp('^(?:' + dependencies.join('|') + ')(\/.+)?$'))
   }
    if (include.length > 0) {
        externals.push(...include)
    }

    return {
        name: 'node-externals',

        resolveId(source, importer) {
            // Return `false` if importee should be treated as an external module,
            // otherwise return `null` to let Rollup and other plugins handle it.
            return importer && !/\0/.test(source) && externals.some(deps => deps.test(source)) ? false : null
        },

        buildStart() {
            let msg: string | undefined
            while (msg = warnings.shift()) {
                this.warn(msg)
            }
        }
    }
}
