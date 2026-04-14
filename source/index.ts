import assert from 'node:assert'
import path from 'node:path'
import fs from 'node:fs/promises'
import cp from 'node:child_process'
import { isBuiltin } from 'node:module'
import type { Plugin, PluginContext } from 'rollup'

import self from '#package.json' with { type: 'json' }

type MaybeFalsy<T> = (T) | undefined | null | false
type MaybeArray<T> = (T) | (T)[]

export interface ExternalsOptions {

    /**
     * Mark NodeJS built-in modules like `node:path`, `node:fs`... as external.
     *
     * Defaults to `true`.
     */
    builtins?: boolean

    /**
     * node: prefix handing for importing NodeJS builtins:
     * - `'add'`    turns `'path'` to `'node:path'`
     * - `'strip'`  turns `'node:path'` to `'path'`
     * - `'ignore'` leaves NodeJS builtins names as-is
     *
     * Defaults to `'add'`.
     */
    builtinsPrefix?: boolean | 'add' | 'strip' | 'ignore'

    /**
     * Path/to/your/package.json file (or array of paths).
     *
     * Defaults to all package.json files found in parent directories recursively.
     * Won't go outside of a git repository or a monorepository.
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

interface ViteCompatiblePlugin extends Plugin {
    apply?: 'build' | 'serve'
    enforce?: 'pre' | 'post'
}

// Files that mark the root of a monorepo
const monorepoRootFiles: ReadonlyArray<string> = [
    'pnpm-workspace.yaml',  // pnpm
    'lerna.json',           // Lerna / Lerna Light
    'rush.json',            // Rush
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
]

const emptyArray: unknown[] = []

interface Config {
    builtins:   boolean
    prefix:     boolean | null  // true = 'add', false = 'strip', null = 'ignore'
    packages:   Set<string>
    isIncluded: (id: string) => boolean
    isExcluded: (id: string) => boolean
}

/**
 * A Rollup/Vite plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function nodeExternals(options: ExternalsOptions = {}): Plugin {

    let config: Config | undefined = undefined

    return {
        name: self.name.replace(/^rollup-plugin-/, ''),
        version: self.version,
        apply: 'build',
        enforce: 'pre',

        async buildStart() {
            config ??= await getConfig.call(this)
            config.packages.forEach(pkg => this.addWatchFile(pkg))
        },

        watchChange(id) {
            if (config?.packages.has(id))
                config = undefined
        },

        resolveId(specifier, _importer, { isEntry }) {
            // Ignore entry points, virtual modules, relative imports and already resolved ids.
            if (isEntry || /^(?:\0|\.{1,2}\/)/.test(specifier) || path.isAbsolute(specifier))
                return null

            // Handle node builtins.
            assert(config)
            if (isBuiltin(specifier)) {
                const stripped = specifier.replace(/^node:/, '')
                const prefixed = 'node:' + stripped
                return {
                    id: config.prefix ? prefixed
                        : config.prefix === false ? isBuiltin(stripped) ? stripped : prefixed
                        : specifier,
                    external: (config.builtins || config.isIncluded(specifier)) && !config.isExcluded(specifier),
                    moduleSideEffects: false
                }
            }

            // Handle npm dependencies.
            return config.isIncluded(specifier) && !config.isExcluded(specifier)
                ? false     // external
                : null      // normal handling
        }
    } as ViteCompatiblePlugin

    async function getConfig(this: PluginContext): Promise<Config> {

        // Set defaults.
        const config: Config = {
            builtins: true,
            prefix:   true,
            packages: new Set(),
            isIncluded,
            isExcluded
        }

        const include: RegExp[] = []
        const exclude: RegExp[] = []

        let deps = true,
            peerDeps = true,
            optDeps = true,
            devDeps = false

        // Apply user options.
        for (const [ key, value ] of Object.entries(options) as Array<[ keyof ExternalsOptions, unknown ]>) {
            switch (key) {
                case 'builtins':
                    config.builtins = Boolean(value)
                    continue

                case 'builtinsPrefix':
                    if (value === 'add' || value === true)
                        config.prefix = true
                    else if (value === 'strip' || value === false)
                        config.prefix = false
                    else if (value === 'ignore')
                        config.prefix = null
                    else if (value)
                        this.warn(`Ignoring bad value ${JSON.stringify(value)} for option '${key}', using default of 'add'.`)
                    continue

                case 'packagePath':
                    emptyArray.concat(value).forEach((entry, index) => {
                        if (isString(entry))
                            config.packages.add(path.resolve(entry))
                        else if (entry)
                            this.warn(`Ignoring wrong entry type #${index} in '${key}' option: ${JSON.stringify(entry)}.`)
                    })
                    continue

                case 'include':
                case 'exclude':
                    emptyArray.concat(value).reduce<RegExp[]>((array, entry, index) => {
                        if (entry instanceof RegExp)
                            array.push(entry)
                        else if (isString(entry))
                            array.push(new RegExp('^' + RegExp.escape(entry) + '$'))
                        else if (entry)
                            this.warn(`Ignoring wrong entry type #${index} in '${key}' option: ${JSON.stringify(entry)}.`)
                        return array
                    }, key === 'include' ? include : exclude)
                    continue

                case 'deps':     deps     = Boolean(value); continue
                case 'optDeps':  optDeps  = Boolean(value); continue
                case 'peerDeps': peerDeps = Boolean(value); continue
                case 'devDeps':  devDeps  = Boolean(value); continue

                default:
                    this.warn(`Ignoring unknown option ${JSON.stringify(key)}.`)
                    continue
            }
        }

        // If the packagePath option was not given, get all package.json files
        // from cwd up to the root of the git repo, the root of the monorepo,
        // or the root of the volume, whichever comes first.
        if (config.packages.size === 0) {

            // Ask git the root of the repository.
            // undefined = unknown (couldn't run git), null = not in a repo
            const gitTopLevel = await new Promise<string | null | undefined>(resolve => {
                cp.execFile('git', [ 'rev-parse', '--show-toplevel' ], (error, stdout) => resolve(
                    error ? typeof error.code === 'string' ? undefined : null
                          : path.normalize(stdout.trim())
                ))
            })

            walk: for (const cwd of walkUp(process.cwd())) {
                let file = path.join(cwd, 'package.json')
                if (await fileExists(file))
                    config.packages.add(file)

                // Break early if we are at the root of the git repo.
                if (cwd === gitTopLevel || (gitTopLevel === undefined && await directoryExists(path.join(cwd, '.git'))))
                    break

                // Break early if we are at the root of the monorepo.
                for (file of monorepoRootFiles) {
                    if (await fileExists(path.join(cwd, file)))
                        break walk
                }
            }
        }

        // Gather dependencies names.
        const externalDependencies: Record<string, string> = {}
        for (const pkg of config.packages) {
            const json = await fs.readFile(pkg).then(
                buffer => JSON.parse(buffer.toString()) as PackageJson,
                (err: NodeJS.ErrnoException | SyntaxError) => err
            )
            if (json instanceof Error) {
                const message = json instanceof SyntaxError
                    ? `File ${JSON.stringify(pkg)} does not look like a valid package.json.`
                    : `Cannot read ${JSON.stringify(pkg)}, error: ${json.code}.`
                this.error({ message, cause: json })
            }

            Object.assign(externalDependencies,
                deps     ? json.dependencies         : undefined,
                devDeps  ? json.devDependencies      : undefined,
                peerDeps ? json.peerDependencies     : undefined,
                optDeps  ? json.optionalDependencies : undefined
            )

            // Break early if this is an npm/yarn workspace root.
            if (Array.isArray(json.workspaces))
                break
        }

        // Add all dependencies as a single include RegEx.
        const names = Object.keys(externalDependencies)
        if (names.length > 0)
            include.push(new RegExp('^(?:' + names.map(RegExp.escape).join('|') + ')(?:/.+)?$'))

        return config

        // Helpers.
        function isString(str: unknown): str is string {
            return typeof str === 'string' && str.length > 0
        }

        function* walkUp(start: string): Generator<string> {
            for (let curr = start, prev = ''; prev !== curr; prev = curr, curr = path.dirname(curr))
                yield curr
        }

        function fileExists(name: string): Promise<boolean>{
            return fs.stat(name).then(stat => stat.isFile(), () => false)
        }

        function directoryExists(name: string): Promise<boolean>{
            return fs.stat(name).then(stat => stat.isDirectory(), () => false)
        }

        function isIncluded(id: string) {
            return include.length > 0 && include.some(rx => rx.test(id))
        }

        function isExcluded(id: string) {
            return exclude.length > 0 && exclude.some(rx => rx.test(id))
        }
    }
}

export default nodeExternals
export { nodeExternals }
