import path from 'node:path'
import fs from 'node:fs'
import { builtinModules } from 'node:module'
import type { Plugin } from 'rollup'

type MaybeFalsy<T> = T | undefined | null | false
type MaybeArray<T> = T | T[]

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
    include?: MaybeArray<MaybeFalsy<string | RegExp>>

    /**
     * Force exclude these deps from the list of externals, regardless of other settings.
     *
     * Defaults to `[]`
     */
    exclude?: MaybeArray<MaybeFalsy<string | RegExp>>
}

// Listing only fields of interest in package.json
interface PackageJson {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    workspaces?: string[]
    packages?: string[]
}

// Prepare node built-in modules lists.
const nodePrefix = 'node:'
const nodePrefixRx = /^node:/
const builtins = {
    all: new Set(builtinModules),
    alwaysPrefixed: new Set(
        builtinModules.filter(mod => nodePrefixRx.test(mod))
    )
}

const workspaceRootFiles = new Set([
    'pnpm-workspace.yaml',  // pnpm
    'lerna.json',           // Lerna
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
    // 'rush.json',            // Rush
])

// Our defaults
type Config = Required<ExternalsOptions> & {
    invalid?: boolean
}

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

const isString = (str: unknown): str is string =>
    typeof str === 'string' && str.length > 0

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function externals(options: ExternalsOptions = {}): Plugin {

    // This will store all eventual errors/warnings until we can display them.
    const messages: string[] = []

    // Consolidate options
    const config: Config = Object.assign(Object.create(null), defaults, options)

    // Map the include and exclude options to arrays of regexes.
    const [ include, exclude ] = ([ 'include', 'exclude' ] as const).map(option =>
        ([] as (string | RegExp | null | undefined | false)[])
            .concat(config[option])
            .reduce((result, entry, index) => {
                if (entry instanceof RegExp)
                    result.push(entry)
                else if (typeof entry === 'string')
                    result.push(new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
                else if (entry) {
                    messages.push(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`)
                }
                return result
            }, [] as RegExp[])
    )

    // Prepare npm dependencies list.
    if (config.deps || config.devDeps || config.peerDeps || config.optDeps) {

        const packagePaths: string[] = Array.isArray(config.packagePath)
            ? config.packagePath.filter(isString)
            : isString(config.packagePath)
                ? [ config.packagePath ]
                : []

        // Populate packagePaths if not given by getting all package.json files
        // from cwd up to the root of the monorepo, the root of the git repo,
        // or the root of the volume, whichever comes first.
        if (packagePaths.length === 0) {
            for (
                let current = process.cwd(), previous: string | null = null;
                previous !== current;
                previous = current, current = path.dirname(current)
            ) {
                const entries = fs.readdirSync(current, { withFileTypes: true })

                if (entries.some(entry => entry.name === 'package.json' && entry.isFile()))
                    packagePaths.push(path.join(current, 'package.json'))

                // Break early if there is a pnpm/lerna workspace config file.
                if (entries.some(entry =>
                    (workspaceRootFiles.has(entry.name) && entry.isFile()) ||
                    (entry.name === '.git' && entry.isDirectory())
                )) {
                    break
                }
            }
        }

        // Gather dependencies names.
        const dependencies: Record<string, string> = {}
        for (const packagePath of packagePaths) {
            let pkg: PackageJson | null = null
            try {
                pkg = JSON.parse(fs.readFileSync(packagePath).toString()) as PackageJson
                Object.assign(dependencies,
                    config.deps     && pkg.dependencies,
                    config.devDeps  && pkg.devDependencies,
                    config.peerDeps && pkg.peerDependencies,
                    config.optDeps  && pkg.optionalDependencies
                )

                // Break early if this is a npm/yarn workspace root.
                if ('workspaces' in pkg || 'packages' in pkg)
                    break
            }
            catch {
                messages.push(pkg
                    ? `File ${JSON.stringify(packagePath)} does not look like a valid package.json file.`
                    : `Cannot read file ${JSON.stringify(packagePath)}`
                )

                config.invalid = true
                break
            }
        }

        const names = Object.keys(dependencies)
        if (names.length > 0)
            include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'))
    }

    const isIncluded = (id: string) => include.some(rx => rx.test(id))
    const isExcluded = (id: string) => exclude.some(rx => rx.test(id))

    return {
        name: 'node-externals',

        async buildStart() {
            // Bail out if there was an error.
            if (config.invalid)
                this.error(messages[0])

            // Otherwise issue any warnings we may have collected earlier.
            while (messages.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.warn(messages.shift()!)
            }
        },

        async resolveId(id) {

            // Let Rollup handle already resolved ids, relative imports and virtual modules.
            if (path.isAbsolute(id) || /^(?:\0|\.{1,2}[\\/])/.test(id))
                return null

            // Handle node builtins.
            if (id.startsWith(nodePrefix) || builtins.all.has(id)) {
                const stripped = id.replace(nodePrefixRx, '')
                return {
                    id: config.builtinsPrefix === 'add' || builtins.alwaysPrefixed.has(id)
                        ? nodePrefix + stripped
                        : stripped,
                    external: config.builtins && !isExcluded(id),
                    moduleSideEffects: false
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
