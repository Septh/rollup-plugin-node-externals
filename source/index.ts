import path from 'node:path'
import fs from 'node:fs/promises'
import { createRequire, isBuiltin } from 'node:module'
import type { Plugin } from 'rollup'

type MaybeFalsy<T> = (T) | undefined | null | false
type MaybeArray<T> = (T) | (T)[]

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
     * - `'ignore'` leaves Node builtin names as-is
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
     * Defaults to `[]` (force include nothing).
     */
    include?: MaybeArray<MaybeFalsy<string | RegExp>>

    /**
     * Force exclude these deps from the list of externals, regardless of other settings.
     *
     * Defaults to `[]` (force exclude nothing).
     */
    exclude?: MaybeArray<MaybeFalsy<string | RegExp>>
}

// Fields of interest in package.json
interface PackageJson {
    version: string
    workspaces?: string[]
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

// Get our own version
const { version } = createRequire(import.meta.url)('../package.json') as PackageJson

// Node built-in prefix handling
const nodePrefix = 'node:'
const nodePrefixRx = /^node:/

// Files that mark the root of a workspace
const workspaceRootFiles = new Set([
    'pnpm-workspace.yaml',  // pnpm
    'lerna.json',           // Lerna
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
    // 'rush.json',            // Rush
])

// Our defaults.
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
function nodeExternals(options: ExternalsOptions = {}): Plugin {

    const config: Config = { ...defaults, ...options }

    let include: RegExp[],
        exclude: RegExp[]

    const isIncluded = (id: string) => include.length > 0 && include.some(rx => rx.test(id)),
          isExcluded = (id: string) => exclude.length > 0 && exclude.some(rx => rx.test(id))

    return {
        name: 'node-externals',
        version,

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
                        else if (entry)
                            this.warn(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`)

                        return result
                    }, [] as RegExp[])
            )

            // Populate the packagePath option if not given by getting all package.json files
            // from cwd up to the root of the git repo, the root of the monorepo,
            // or the root of the volume, whichever comes first.
            const packagePaths = ([] as string[])
                    .concat(config.packagePath)
                    .filter(isString)
                    .map(packagePath => path.resolve(packagePath))
            if (packagePaths.length === 0) {
                for (
                    let current = process.cwd(), previous: string | undefined = undefined;
                    previous !== current;
                    previous = current, current = path.dirname(current)
                ) {
                    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => null)
                    if (entries === null) {
                        return this.error({
                            message: `Could not read contents of directory ${JSON.stringify(current)}.`,
                            stack: undefined
                        })
                    }

                    // Gather package.json files.
                    if (entries.some(entry => entry.name === 'package.json' && entry.isFile()))
                        packagePaths.push(path.join(current, 'package.json'))

                    // Break early if this is a git repo root or there is a known workspace root file.
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
                    const json = await fs.readFile(packagePath).then(buffer => buffer.toString())
                    try {
                        const pkg = JSON.parse(json) as PackageJson
                        Object.assign(dependencies,
                            config.deps     ? pkg.dependencies         : undefined,
                            config.devDeps  ? pkg.devDependencies      : undefined,
                            config.peerDeps ? pkg.peerDependencies     : undefined,
                            config.optDeps  ? pkg.optionalDependencies : undefined
                        )

                        // Watch this package.json
                        this.addWatchFile(packagePath)

                        // Break early if this is a npm/yarn workspace root.
                        if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0)
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

            // Add all dependencies as an include RegEx.
            const names = Object.keys(dependencies)
            if (names.length > 0)
                include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'))
        },

        resolveId: {
            order: 'pre',
            async handler(specifier, importer) {
                if (
                    !importer                               // Ignore entry points (they should always be resolved)
                    || path.isAbsolute(specifier)           // Ignore already resolved ids
                    || /^(?:\0|\.{1,2}\/)/.test(specifier)  // Ignore virtual modules and relative imports
                ) {
                    return null
                }

                // Handle node builtins.
                if (isBuiltin(specifier)) {
                    const stripped = specifier.replace(nodePrefixRx, '')
                    return {
                        id: config.builtinsPrefix === 'ignore'
                            ? specifier
                            : config.builtinsPrefix === 'add' || !isBuiltin(stripped)
                                ? nodePrefix + stripped
                                : stripped,
                        external: (config.builtins || isIncluded(specifier)) && !isExcluded(specifier),
                        moduleSideEffects: false
                    }
                }

                // Handle npm dependencies.
                return isIncluded(specifier) && !isExcluded(specifier)
                    ? false     // external
                    : null      // normal handling
            }
        }
    }
}

export default nodeExternals
export { nodeExternals }
