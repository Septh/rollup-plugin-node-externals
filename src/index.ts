import path from 'node:path'
import fs from 'node:fs'
import { builtinModules } from 'node:module'
import type { Plugin } from 'rollup'

export interface ExternalsOptions {

    /**
     * Mark node built-in modules like `path`, `fs`... as external.
     *
     * Defaults to `true`.
     */
    builtins?: boolean

    /**
     * node: prefix handing for importing Node builtins:
     * - `'add'`    turns `'path'` to `'node:path'`
     * - `'strip'`  turns `'node:path'` to `'path'`
     *
     * Defaults to `add`.
     */
    builtinsPrefix?: 'add' | 'strip'

    /**
     * Path/to/your/package.json file (or array of paths).
     *
     * Defaults to all package.json files found in parent directories recursively.
     * Won't go outside of a git repository.
     */
    packagePath?: string | string[]

    /**
     * Mark dependencies as external.
     *
     * Defaults to `true`.
     */
    deps?: boolean

    /**
     * Mark devDependencies as external.
     *
     * Defaults to `false`.
     */
    devDeps?: boolean

    /**
     * Mark peerDependencies as external.
     *
     * Defaults to `true`.
     */
    peerDeps?: boolean

    /**
     * Mark optionalDependencies as external.
     *
     * Defaults to `true`.
     */
    optDeps?: boolean

    /**
     * Force include these deps in the list of externals, regardless of other settings.
     *
     * Defaults to `[]`
     */
    include?: string | RegExp | (string | RegExp)[]

    /**
     * Force exclude these deps from the list of externals, regardless of other settings.
     *
     * Defaults to `[]`
     */
    exclude?: string | RegExp | (string | RegExp)[]
}

type Config = Required<ExternalsOptions>

const defaults: Config = {
    builtins: true,
    builtinsPrefix: 'add',
    packagePath: [],
    deps: true,
    devDeps: false,
    peerDeps: true,
    optDeps: true,
    include: [],
    exclude: []
}

interface PackageJson {
    dependencies?:         Record<string, string>
    devDependencies?:      Record<string, string>
    peerDependencies?:     Record<string, string>
    optionalDependencies?: Record<string, string>
}

function isString(str: unknown): str is string {
    return typeof str === 'string' && str.length > 0
}

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function externals(options: ExternalsOptions = {}): Plugin {

    // This will store all eventual warnings until we can display them.
    const warnings: string[] = []

    // Consolidate options
    const config: Config = Object.assign(Object.create(defaults), options)

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

    // Prepare node built-in modules lists.
    const nodePrefixRx = /^node:/
    const builtins = {
        all: new Set([
            ...builtinModules,
            ...builtinModules.map(mod => 'node:' + mod.replace(nodePrefixRx, ''))
        ]),
        alwaysPrefixed: new Set(
            builtinModules.filter(mod => nodePrefixRx.test(mod))
        )
    }

    // Prepare npm dependencies lists.
    if (config.deps || config.devDeps || config.peerDeps || config.optDeps) {

        const packagePaths: string[] = Array.isArray(config.packagePath)
            ? config.packagePath.filter(isString)
            : isString(config.packagePath)
                ? [ config.packagePath ]
                : []

        // Get all package.json files from cwd up to the root of the git repo
        // or the root of the volume, whichever comes first.
        if (packagePaths.length === 0) {
            let cwd = process.cwd()
            for (;;) {
                let name = path.join(cwd, 'package.json')
                if (fs.statSync(name, { throwIfNoEntry: false })?.isFile())
                    packagePaths.push(name)

                name = path.join(cwd, '.git')
                if (fs.statSync(name, { throwIfNoEntry: false })?.isDirectory())
                    break

                const parent = path.dirname(cwd)
                if (parent === cwd)
                    break
                cwd = parent
            }
            console.log('packagePaths: ', packagePaths)
        }

        const dependencies: Record<string, string> = {}
        for (const packagePath of packagePaths) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packagePath).toString()) as PackageJson
                Object.assign(dependencies,
                    config.deps     && pkg.dependencies,
                    config.devDeps  && pkg.devDependencies,
                    config.peerDeps && pkg.peerDependencies,
                    config.optDeps  && pkg.optionalDependencies
                )
            }
            catch {}
        }

        const names = Object.keys(dependencies)
        if (names.length > 0)
            include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'))
    }

    console.log('include: ', include)
    console.log('exclude: ', exclude)

    const isIncluded = (id: string) => include.some(rx => rx.test(id))
    const isExcluded = (id: string) => exclude.some(rx => rx.test(id))

    return {
        name: 'node-externals',

        async buildStart() {

            // Simply issue the warnings we may have collected earlier.
            let warning: string | undefined
            while (warning = warnings.shift()) {
                this.warn(warning)
            }
        },

        async resolveId(id) {

            // Ignore already resolved ids, relative imports and virtual modules.
            if (path.isAbsolute(id) || /^(?:\0|\.{1,2}[\\/])/.test(id))
                return null

            // Handle builtins.
            if (builtins.all.has(id) && config.builtins) {
                const stripped = id.replace(nodePrefixRx, '')
                return {
                    id: config.builtinsPrefix === 'add' || builtins.alwaysPrefixed.has(id)
                        ? 'node:' + stripped
                        : stripped,
                    external: !isExcluded(id)
                }
            }

            // Handle npm dependencies.
            return isIncluded(id) && !isExcluded(id)
                ? false     // external
                : null      // normal handling
        }
    }
}

export default externals
export { externals }
