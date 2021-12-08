import type { Plugin } from 'rollup'
import { builtinModules } from 'module'
import { findPackagePaths, findDependencies } from './dependencies'

export interface ExternalsOptions {
    /**
     * Path/to/your/package.json file (or array of paths).
     * Defaults to all package.json files found in parent directories recursively.
     * Won't got outside of a git repository.
     */
    packagePath?: string | string[]
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

/** @deprecated Use `ExternalsOptions` instead. */
export type ExternalOptions = ExternalsOptions

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and optionally npm dependencies as 'external'.
 *
 * Useful when you don't want to bundle node/npm modules with your own code
 * but rather import or require them at runtime.
 */
 export default function externals(options: ExternalsOptions = {}): Plugin {

    // Store eventual warnings until we can display them
    const warnings: string[] = []

    // Consolidate options
    const opts: Required<ExternalsOptions> = {
        packagePath: [],
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
    const filterFn: (dep: string) => boolean = dep => !exclude.some(rx => rx.test(dep))

    // Filter NodeJS builtins
    const builtins = (opts.builtins ? builtinModules : []).filter(filterFn)

    // Normalize package paths
    let packagePaths: string[] = ([] as string[]).concat(opts.packagePath)

    // Array of the final regexes, include potential import from a sub directory (e.g. 'lodash/map')
    const externals: RegExp[] = []

    return {
        name: 'node-externals',

        async buildStart() {

            // Find and filter dependencies
            const dependencies = (await findDependencies({
                packagePaths: packagePaths.length > 0 ? packagePaths : findPackagePaths(),
                keys: [
                    opts.deps && 'dependencies',
                    opts.devDeps && 'devDependencies',
                    opts.peerDeps && 'peerDependencies',
                    opts.optDeps && 'optionalDependencies'
                ].filter(Boolean) as string[],
                warnings
            })).filter(filterFn)

            // Issue the warnings we may have collected
            let msg: string | undefined
            while (msg = warnings.shift()) {
                this.warn(msg)
            }

            // Build regexes
            if (builtins.length > 0) {
                externals.push(new RegExp('^(?:' + builtins.join('|') + ')(\/.+)?$'))
            }

            if (dependencies.length > 0) {
                externals.push(new RegExp('^(?:' + dependencies.join('|') + ')(\/.+)?$'))
            }

            if (include.length > 0) {
                externals.push(...include)
            }
        },

        resolveId(source, importer) {
            // Return `false` if importee should be treated as an external module,
            // otherwise return `null` to let Rollup and other plugins handle it.
            return importer && !/\0/.test(source) && externals.some(deps => deps.test(source)) ? false : null
        }
    }
}
