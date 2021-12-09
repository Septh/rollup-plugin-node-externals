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
}

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and optionally npm dependencies as 'external'.
 *
 * Useful when you don't want to bundle node/npm modules with your own code
 * but rather import or require them at runtime.
 */
 export default function externals(options: ExternalsOptions = {}): Plugin {

    // Consolidate options
    const consolidatedOptions: Required<ExternalsOptions> = {
        packagePath: [],
        builtins: true,
        deps: false,
        devDeps: true,
        peerDeps: true,
        optDeps: true,
        include: [],
        exclude: [],
        ...options
    }

    // This will store all eventual warnings until we can display them
    const warnings: string[] = []

    // Map the include and exclude options to arrays of regexes
    const [ include, exclude ] = [ 'include', 'exclude' ].map(optionName => new Array()
        .concat((consolidatedOptions as any)[optionName])
        .map((entry: string | RegExp, index: number): RegExp => {
            if (entry instanceof RegExp) {
                return entry
            }
            else if (typeof entry === 'string') {
                return new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
            }
            else {
                if (!!entry) {
                    warnings.push(`Ignoring wrong entry type #${index} in '${optionName}' option: '${entry}'`)
                }
                return /(?=no)match/
            }
        })
    )

    // Build a function to keep only non excluded dependencies
    const isNotExcluded = (id: string) => !exclude.some(rx => rx.test(id))

    // Array of the final regexes
    const externals: RegExp[] = []
    const isExternal = (id: string) => externals.some(deps => deps.test(id))

    return {
        name: 'node-externals',

        async buildStart() {

            // 1) Filter NodeJS builtins, supporting potential import from a sub directory (e.g. 'fs/promises')
            const builtins = (consolidatedOptions.builtins ? builtinModules : []).filter(isNotExcluded)
            if (builtins.length > 0) {
                externals.push(new RegExp('^(?:' + builtins.join('|') + ')(\/.+)?$'))
            }

            // 2) Find and filter dependencies, supporting potential import from a sub directory (e.g. 'lodash/map')
            const packagePaths: string[] = ([] as string[]).concat(consolidatedOptions.packagePath)
            const dependencies = (await findDependencies({
                packagePaths: packagePaths.length > 0 ? packagePaths : findPackagePaths(),
                keys: [
                    consolidatedOptions.deps && 'dependencies',
                    consolidatedOptions.devDeps && 'devDependencies',
                    consolidatedOptions.peerDeps && 'peerDependencies',
                    consolidatedOptions.optDeps && 'optionalDependencies'
                ].filter(Boolean) as string[],
                warnings
            })).filter(isNotExcluded)

            if (dependencies.length > 0) {
                externals.push(new RegExp('^(?:' + dependencies.join('|') + ')(\/.+)?$'))
            }

            // 3) Add the include option
            if (include.length > 0) {
                externals.push(...include)
            }

            // All done. Issue the warnings we may have collected
            let msg: string | undefined
            while (msg = warnings.shift()) {
                this.warn(msg)
            }
        },

        resolveId(id, importer) {
            // Ignore entry chunks & don't mess with other plugins
            if (!importer?.charCodeAt(0) || !id.charCodeAt(0)) {
                return null
            }

            // Return `false` if importee should be treated as an external module,
            // otherwise return `null` to let Rollup and other plugins handle it
            return isExternal(id) && isNotExcluded(id) ? false : null
        }
    }
}
