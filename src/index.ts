import path from 'path'
import { builtinModules } from 'module'
import { findPackagePaths, findDependencies } from './dependencies'
import type { Plugin } from 'rollup'

export interface ExternalsOptions {
    /** Mark node built-in modules like `path`, `fs`... as external. Defaults to `true`. */
    builtins?: boolean
    /** How to treat prefixed builtins. Defaults to `true` (prefixed are considered the same as unprefixed). */
    builtinsPrefix?: 'add' | 'strip'
    /**
     * Path/to/your/package.json file (or array of paths).
     * Defaults to all package.json files found in parent directories recursively.
     * Won't got outside of a git repository.
     */
    packagePath?: string | string[]
    /** Mark dependencies as external. Defaults to `true`. */
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
    /**
     * @deprecated - Please use `builtinsPrefix`instead.
    */
    prefixedBuiltins?: boolean | 'strip' | 'add'
}

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function externals(options: ExternalsOptions = {}): Plugin {

    // This will store all eventual warnings until we can display them.
    const warnings: string[] = []

    // Consolidate options
    const config: Required<ExternalsOptions> & { _builtinsPrefix: 'ignore' | 'add' | 'strip' } = {
        builtins: true,
        builtinsPrefix: 'strip',    // Will be be 'add' v5
        prefixedBuiltins: 'strip',  // Will be removed in v5
        packagePath: [],
        deps: true,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        include: [],
        exclude: [],

        ...options,

        _builtinsPrefix: 'strip',           // Used to handle prefixes until v5
    }

    if ('builtinsPrefix' in options) {
        config._builtinsPrefix = options.builtinsPrefix
    }
    else if ('prefixedBuiltins' in options) {
        warnings.push("The 'prefixedBuiltins' option is now deprecated, " +
            "please use 'builtinsPrefix' instead to silent this warning.")

        const { prefixedBuiltins } = options
        config._builtinsPrefix =
            prefixedBuiltins === false
                ? 'ignore'
                : prefixedBuiltins === true || prefixedBuiltins === 'add'
                    ? 'add'
                    : 'strip'
    }

    // Map the include and exclude options to arrays of regexes.
    const [ include, exclude ] = [ 'include', 'exclude' ].map(option =>
        ([] as (string | RegExp)[])
            .concat(config[ option as 'include' | 'exclude' ])
            .reduce((result, entry, index) => {
                if (entry instanceof RegExp)
                    result.push(entry)
                else if (typeof entry === 'string')
                    result.push(new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
                else if (entry) {
                    warnings.push(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`)
                }
                return result
            }, [] as RegExp[])
    )

    // Support for builtin modules.
    const nodePrefix = 'node:'
    const nodePrefixRx = /^node:/
    const _builtinModules = {
        bare:          [] as string[],  // w/o schemed-only builtins
        schemed:       [] as string[],  // w/ schemed-only builtins
        alwaysSchemed: [] as string[]   // e.g., node:test in node 18+
    }

    builtinModules.forEach(builtin => {
        if (builtin.startsWith(nodePrefix)) {
            _builtinModules.schemed.push(builtin)
            _builtinModules.alwaysSchemed.push(builtin)
        }
        else {
            _builtinModules.bare.push(builtin)
            _builtinModules.schemed.push(nodePrefix + builtin)
        }
    })

    const builtins = new Set([
        ..._builtinModules.bare,
        ..._builtinModules.schemed
    ])
    const alwaysSchemed = new Set(_builtinModules.alwaysSchemed)

    // A filter function to keep only non excluded dependencies.
    const isNotExcluded = (id: string) => !exclude.some(rx => rx.test(id))

    // The array of the final regexes.
    let externals: RegExp[] = []
    const isExternal = (id: string) => externals.some(rx => rx.test(id))

    return {
        name: 'node-externals',

        async buildStart() {

            // Begin with the include option as it has precedence over the other inclusion options.
            externals = [ ...include ]

            // Add builtins
            if (config.builtins) {
                externals.push(
                    new RegExp('^(?:' + _builtinModules.bare.filter(isNotExcluded).join('|') + ')$'),
                    new RegExp('^node:(?:' + _builtinModules.schemed.filter(isNotExcluded).map(id => id.replace(nodePrefixRx, '')).join('|') + ')$'),
                )
            }

            // Find and filter dependencies, supporting potential import from a sub directory (e.g. 'lodash/map').
            if (config.deps || config.devDeps || config.peerDeps || config.optDeps) {
                const packagePaths: string[] = ([] as string[]).concat(config.packagePath)
                const dependencies = (await findDependencies({
                    packagePaths: packagePaths.length > 0 ? packagePaths : findPackagePaths(),
                    keys: [
                        config.deps     && 'dependencies',
                        config.devDeps  && 'devDependencies',
                        config.peerDeps && 'peerDependencies',
                        config.optDeps  && 'optionalDependencies'
                    ].filter(Boolean) as string[],
                    warnings
                })).filter(isNotExcluded)

                if (dependencies.length > 0) {
                    externals.push(new RegExp('^(?:' + dependencies.join('|') + ')(?:/.+)?$'))
                }
            }

            // Issue the warnings we may have collected.
            while (warnings.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.warn(warnings.shift()!)
            }
        },

        resolveId(id) {

            // Ignore already resolved ids, relative imports and virtual modules.
            if (path.isAbsolute(id) || /^(?:\0|\.{1,2}[\\/])/.test(id))
                return null

            // Check for externality.
            const external = isExternal(id) && isNotExcluded(id)

            // If not a builtin, or we're told not to handle prefixes, return status immediately.
            if (!builtins.has(id) || config._builtinsPrefix === 'ignore')
                return external ? false : null

            // Otherwise, handle prefix.
            const stripped = id.replace(nodePrefixRx, '')
            return {
                id: alwaysSchemed.has(id) || config._builtinsPrefix === 'add'
                    ? 'node:' + stripped
                    : stripped,
                external
            }
        }
    }
}

export default externals
export { externals }
