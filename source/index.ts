import path from 'node:path'
import fs from 'node:fs/promises'
import cp from 'node:child_process'
import { createRequire, isBuiltin } from 'node:module'
import type { Plugin } from 'rollup'

type MaybeFalsy<T> = (T) | undefined | null | false
type MaybeArray<T> = (T) | (T)[]

interface ViteCompatiblePlugin extends Plugin {
    apply?: 'build' | 'serve'
    enforce?: 'pre' | 'post'
}

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
    name: string
    version: string
    workspaces?: string[]
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

// Get our own name and version
const { name, version } = createRequire(import.meta.url)('#package.json') as PackageJson

// Files that mark the root of a monorepo
const workspaceRootFiles = [
    'pnpm-workspace.yaml',  // pnpm
    'lerna.json',           // Lerna / Lerna Light
    'rush.json',            // Rush
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
]

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

// Helpers.
const isString = (str: unknown): str is string => typeof str === 'string' && str.length > 0
const fileExists = (name: string) => fs.stat(name).then(stat => stat.isFile()).catch(() => false)

/**
 * A Rollup/Vite plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function nodeExternals(options: ExternalsOptions = {}): Plugin {

    const config: Config = { ...defaults, ...options }

    let include: RegExp[] = [],     // Initialized to empty arrays
        exclude: RegExp[] = []      // as a workaround to issue #30

    const isIncluded = (id: string) => include.length > 0 && include.some(rx => rx.test(id)),
          isExcluded = (id: string) => exclude.length > 0 && exclude.some(rx => rx.test(id))

    // Determine the root of the git repository, if any.
    //
    // Note: we can't await the promise here because this would require our factory function
    //       to be async and that would break the old Vite compatibility trick
    //       (see issue #37 and https://github.com/vitejs/vite/issues/20717).
    const gitTopLevel = new Promise<string>(resolve => {
        cp.execFile('git', [ 'rev-parse', '--show-toplevel' ], (error, stdout) => {
            resolve(error ? '' : path.normalize(stdout.trim()))
        })
    })

    return {
        name: name.replace(/^rollup-plugin-/, ''),
        version,
        apply: 'build',
        enforce: 'pre',

        async buildStart() {

            // Map the include and exclude options to arrays of regexes.
            [ include, exclude ] = ([ 'include', 'exclude' ] as const).map(option => ([] as Array<MaybeFalsy<string | RegExp>>)
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
                for (let current = process.cwd(), previous = ''; previous !== current; previous = current, current = path.dirname(current)) {

                    // Gather package.json files.
                    const name = path.join(current, 'package.json')
                    if (await fileExists(name))
                        packagePaths.push(name)

                    // Break early if we are at the root of the git repo
                    // or there is a known workspace root file.
                    const breaks = await Promise.all([
                        gitTopLevel.then(topLevel => topLevel === current),
                        ...workspaceRootFiles.map(name => fileExists(path.join(current, name)))
                    ])

                    if (breaks.some(result => result))
                        break
                }
            }

            // Gather dependencies names.
            const externals: Record<string, string> = {}
            for (const packagePath of packagePaths) {
                const manifest = await fs.readFile(packagePath)
                    .then(buffer => JSON.parse(buffer.toString()) as PackageJson)
                    .catch((err: NodeJS.ErrnoException | SyntaxError) => err)
                if (manifest instanceof Error) {
                    const message = manifest instanceof SyntaxError
                        ? `File ${JSON.stringify(packagePath)} does not look like a valid package.json.`
                        : `Cannot read ${JSON.stringify(packagePath)}, error: ${manifest.code}.`
                    return this.error({ message, stack: undefined })
                }

                Object.assign(externals,
                    config.deps     ? manifest.dependencies         : undefined,
                    config.devDeps  ? manifest.devDependencies      : undefined,
                    config.peerDeps ? manifest.peerDependencies     : undefined,
                    config.optDeps  ? manifest.optionalDependencies : undefined
                )

                // Watch this package.json.
                this.addWatchFile(packagePath)

                // Break early if this is an npm/yarn workspace root.
                if (Array.isArray(manifest.workspaces))
                    break
            }

            // Add all dependencies as an include RegEx.
            const names = Object.keys(externals)
            if (names.length > 0)
                include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'))
        },

        resolveId(specifier, _, { isEntry }) {
            if (
                isEntry                                 // Ignore entry points
                || /^(?:\0|\.{1,2}\/)/.test(specifier)  // Ignore virtual modules and relative imports
                || path.isAbsolute(specifier)           // Ignore already resolved ids
            ) {
                return null
            }

            // Handle node builtins.
            if (isBuiltin(specifier)) {
                const stripped = specifier.replace(/^node:/, '')
                return {
                    id: config.builtinsPrefix === 'ignore'
                        ? specifier
                        : config.builtinsPrefix === 'add' || !isBuiltin(stripped)
                            ? 'node:' + stripped
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
    } as ViteCompatiblePlugin
}

export default nodeExternals
export { nodeExternals }
