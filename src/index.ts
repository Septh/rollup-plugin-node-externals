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
    const config: Required<ExternalsOptions> = {
        builtins: true,
        builtinsPrefix: 'add',
        packagePath: [],
        deps: true,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        include: [],
        exclude: [],

        prefixedBuiltins: 'strip',

        ...options
    }

    if ('prefixedBuiltins' in options) {
        warnings.push("The 'prefixedBuiltins' option is now deprecated, " +
            "please use 'builtinsPrefix' instead to silent this warning.")
    }
    else if ('builtinsPrefix' in options) {
        config.prefixedBuiltins = options.builtinsPrefix
    }

    // Map the include and exclude options to arrays of regexes.
    const [ include, exclude ] = [ 'include', 'exclude' ].map(option =>
        ([] as (string | RegExp)[])
            .concat(config[option as 'include' | 'exclude'])
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

    // A filter function to keep only non excluded dependencies.
    const isNotExcluded = (id: string) => !exclude.some(rx => rx.test(id))

    // The array of the final regexes.
    let externals: RegExp[] = []
    const isExternal = (id: string) => externals.some(rx => rx.test(id))

    // Support for builtin modules.
    const builtins: Set<string> = new Set(),
        alwaysSchemed: Set<string> = new Set()
    if (config.builtins) {
        const filtered = builtinModules.filter(b => isNotExcluded(b) && isNotExcluded('node:' + b))
        for (const builtin of filtered) {
            builtins.add(builtin)
            if (builtin.startsWith('node:'))
                alwaysSchemed.add(builtin)
            else
                builtins.add('node:' + builtin)
        }
    }

    return {
        name: 'node-externals',

        async buildStart() {

            // Begin with the include option as it has precedence over the other options.
            externals = [ ...include ]

            // Find and filter dependencies, supporting potential import from a sub directory (e.g. 'lodash/map').
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

            // Issue the warnings we may have collected.
            let warning: string | undefined
            while ((warning = warnings.shift())) {
                this.warn(warning)
            }
        },

        resolveId(importee) {

            // Ignore already resolved ids, relative imports and virtual modules.
            if (path.isAbsolute(importee) || /^(?:\0|\.{1,2}[\\/])/.test(importee))
                return null

            // Handle builtins first.
            if (alwaysSchemed.has(importee))
                return false

            if (builtins.has(importee)) {
                if (config.prefixedBuiltins === false)
                    return false

                const stripped = importee.replace(/^node:/, '')
                const prefixed = 'node:' + stripped

                return config.prefixedBuiltins === 'strip'
                    ? { id: stripped, external: true }
                    : { id: prefixed, external: true }
            }

            // Handle dependencies.
            return isExternal(importee) && isNotExcluded(importee)
                ? false
                : null
        }
    }
}

export default externals
export { externals }
