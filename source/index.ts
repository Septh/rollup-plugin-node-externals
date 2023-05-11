import path from 'node:path'
import fs from 'node:fs/promises'
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
     * - `'ignore'` leave Node builtin names as-is
     *
     * Defaults to `add`.
     */
    builtinsPrefix?: 'add' | 'strip' | 'ignore'

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
     * Defaults to `[]` (force include nothing)
     */
    include?: MaybeArray<MaybeFalsy<string | RegExp>>

    /**
     * Force exclude these deps from the list of externals, regardless of other settings.
     *
     * Defaults to `[]` (force exclude nothing)
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

const isString = (str: unknown): str is string =>
    typeof str === 'string' && str.length > 0

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function externals(options: ExternalsOptions = {}): Plugin {

    const config: Config = { ...defaults, ...options }
    let include: RegExp[],
        exclude: RegExp[]
    const isIncluded = (id: string) => include.some(rx => rx.test(id)),
          isExcluded = (id: string) => exclude.some(rx => rx.test(id))

    return {
        name: 'node-externals',

        async buildStart() {
            // Map the include and exclude options to arrays of regexes.
            [ include, exclude ] = ([ 'include', 'exclude' ] as const).map(option =>
                ([] as Array<string | RegExp | null | undefined | false>)
                    .concat(config[option])
                    .reduce((result, entry, index) => {
                        if (entry instanceof RegExp)
                            result.push(entry)
                        else if (isString(entry))
                            result.push(new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
                        else if (entry) {
                            this.warn(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`)
                        }
                        return result
                    }, [] as RegExp[])
            )

            // Populate the packagePath option if not given by getting all package.json files
            // from cwd up to the root of the git repo, the root of the monorepo,
            // or the root of the volume, whichever comes first.
            const packagePaths: string[] = Array.isArray(config.packagePath)
                ? config.packagePath.filter(isString)
                : isString(config.packagePath)
                    ? [ config.packagePath ]
                    : []
            if (packagePaths.length === 0) {
                for (
                    let current = process.cwd(), previous: string | undefined;
                    previous !== current;
                    previous = current, current = path.dirname(current)
                ) {
                    const entries = await fs.readdir(current, { withFileTypes: true })

                    // Gather package.json files
                    if (entries.some(entry => entry.name === 'package.json' && entry.isFile()))
                        packagePaths.push(path.join(current, 'package.json'))

                    // Break early if this is a git repo root or there is a known monorepo root file.
                    if (entries.some(entry =>
                        (entry.name === '.git' && entry.isDirectory())
                        || (workspaceRootFiles.has(entry.name) && entry.isFile())
                    )) {
                        break
                    }
                }
            }

            // Gather dependencies names.
            const dependencies: Record<string, string> = {}
            for (const packagePath of packagePaths) {
                try {
                    const json = (await fs.readFile(packagePath)).toString()
                    try {
                        const pkg: PackageJson = JSON.parse(json)
                        Object.assign(dependencies,
                            config.deps     ? pkg.dependencies         : undefined,
                            config.devDeps  ? pkg.devDependencies      : undefined,
                            config.peerDeps ? pkg.peerDependencies     : undefined,
                            config.optDeps  ? pkg.optionalDependencies : undefined
                        )

                        // Watch the file.
                        this.addWatchFile(packagePath)

                        // Break early if this is a npm/yarn workspace root.
                        if ('workspaces' in pkg)
                            break
                    }
                    catch {
                        this.error({
                            message: `File ${JSON.stringify(packagePath)} does not look like a valid package.json file.`,
                            stack: undefined
                        })
                    }
                }
                catch {
                    this.error({
                        message: `Cannot read file ${JSON.stringify(packagePath)}`,
                        stack: undefined
                    })
                }
            }

            const names = Object.keys(dependencies)
            if (names.length > 0)
                include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'))
        },

        async resolveId(id) {
            // Let Rollup handle already resolved ids, relative imports and virtual modules.
            if (path.isAbsolute(id) || /^(?:\0|\.{1,2}[\\/])/.test(id))
                return null

            // Handle node builtins.
            if (id.startsWith(nodePrefix) || builtins.all.has(id)) {
                const stripped = id.replace(nodePrefixRx, '')
                return {
                    id: config.builtinsPrefix === 'ignore'
                        ? id
                        : config.builtinsPrefix === 'add' || builtins.alwaysPrefixed.has(id)
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
