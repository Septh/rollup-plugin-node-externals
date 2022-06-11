import type { Plugin } from 'rollup'
import { builtinModules } from 'module'
import { findPackagePaths, findDependencies } from './dependencies'

export interface ExternalsOptions {
    /** Mark node built-in modules like `path`, `fs`... as external. Defaults to `true`. */
    builtins?: boolean
    /** How to treat prefixed builtins. Defaults to `true` (prefixed are considered the same as unprefixed). */
    prefixedBuiltins?: boolean | 'strip'
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
}

type IncludeExclude = Pick<ExternalsOptions, 'include' | 'exclude'>

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function externals(options: ExternalsOptions = {}): Plugin {

    // Consolidate options
    const config: Required<ExternalsOptions> = {
        builtins: true,
        prefixedBuiltins: 'strip',
        packagePath: [],
        deps: true,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        include: [],
        exclude: [],
        ...options
    }

    // This will store all eventual warnings until we can display them.
    const warnings: string[] = []

    // Map the include and exclude options to arrays of regexes.
    const [ include, exclude ] = [ 'include', 'exclude' ].map(option => new Array<string | RegExp>()
        .concat(config[option as keyof IncludeExclude])
        .map((entry, index) => {
            if (entry instanceof RegExp)
                return entry

            if (typeof entry === 'string')
                return new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')

            if (entry) {
                warnings.push(`Ignoring wrong entry type #${index} in '${option}' option: '${entry}'`)
            }

            return /(?=no)match/
        })
    )

    // A filter function to keep only non excluded dependencies.
    const isNotExcluded = (id: string) => !exclude.some(rx => rx.test(id))

    // The array of the final regexes.
    const externals: RegExp[] = []
    const isExternal = (id: string) => externals.some(rx => rx.test(id))

    return {
        name: 'node-externals',

        async buildStart() {

            // 1) Filter NodeJS builtins, supporting potential import from a sub directory (e.g. 'fs/promises').
            const builtins = (config.builtins ? builtinModules : []).filter(isNotExcluded)
            if (builtins.length > 0) {
                externals.push(new RegExp(`^(?:${builtins.join('|')})(?:/.+)?$`))
            }

            // 2) Find and filter dependencies, supporting potential import from a sub directory (e.g. 'lodash/map').
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
                externals.push(new RegExp(`^(?:${dependencies.join('|')})(?:/.+)?$`))
            }

            // 3) Add the include option.
            if (include.length > 0) {
                externals.push(...include)
            }

            // All done. Issue the warnings we may have collected.
            while (warnings.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.warn(warnings.shift()!)
            }
        },

        resolveId(importee, importer, { isEntry }) {

            // Ignore entry chunks & don't mess with other plugins.
            if (isEntry || !importee.charCodeAt(0) || !importer?.charCodeAt(0)) {
                return null
            }

            // Remove node:/nodejs: prefix so builtins resolve to their unprefixed equivalent.
            let stripped = importee
            if (config.prefixedBuiltins) {
                if (importee.startsWith('node:')) {
                    stripped = importee.slice(5)
                }
                else if (importee.startsWith('nodejs:')) {
                    stripped = importee.slice(7)
                }
            }

            // Return object if importee should be treated as an external module,
            // otherwise return `null` to let Rollup and other plugins handle it.
            return isExternal(stripped) && isNotExcluded(stripped)
                ? { id: config.prefixedBuiltins === 'strip' ? stripped : importee, external: true }
                : null
        }
    }
}

export default externals
export { externals }
