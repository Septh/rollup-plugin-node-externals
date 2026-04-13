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
    builtinsPrefix?: 'add' | 'strip' | 'ignore'

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

// Helpers.
function isString(str: unknown): str is string {
    return typeof str === 'string' && str.length > 0
}

function fileExists(name: string): Promise<boolean>{
    return fs.stat(name).then(stat => stat.isFile(), () => false)
}

function directoryExists(name: string): Promise<boolean>{
    return fs.stat(name).then(stat => stat.isDirectory(), () => false)
}

class Config {
    builtins = true
    builtinsPrefix: NonNullable<ExternalsOptions['builtinsPrefix']> = 'add'
    packages = new Set<string>()
    deps = true
    peerDeps = true
    optDeps = true
    devDeps = false
    include: RegExp[] = []
    exclude: RegExp[] = []

    async applyOptions(context: PluginContext, options: ExternalsOptions): Promise<Config> {

        // Apply options.
        for (const [ key, value] of Object.entries(options) as [ keyof ExternalsOptions, unknown ][]) {
            if (value == undefined)
                continue

            switch (key) {
                case 'include':
                case 'exclude':
                    this[key] = this[key].concat(value as RegExp[]).reduce((result, entry: unknown, index) => {
                        if (entry instanceof RegExp)
                            result.push(entry)
                        else if (isString(entry))
                            result.push(new RegExp('^' + RegExp.escape(entry) + '$'))
                        else if (entry)
                            context.warn(`Ignoring wrong entry type #${index} in '${key}' option: ${JSON.stringify(entry)}.`)
                        return result
                    }, this[key])
                    continue

                case 'packagePath':
                    ([] as unknown[]).concat(value as string[]).forEach((entry, index) => {
                        if (isString(entry))
                            this.packages.add(path.resolve(entry))
                        else if (entry)
                            context.warn(`Ignoring wrong entry type #${index} in '${key}' option: ${JSON.stringify(entry)}.`)
                    })
                    continue

                case 'builtinsPrefix':
                    if (value === 'add' || value === 'strip' || value === 'ignore')
                        this[key] = value
                    else context.warn(`Ignoring bad value ${JSON.stringify(value)} for option '${key}', using default of 'add'.`)
                    continue

                case 'builtins':
                case 'deps':
                case 'devDeps':
                case 'optDeps':
                case 'peerDeps':
                    this[key] = Boolean(value)
                    continue

                default:
                    context.warn(`Ignoring unknown option ${JSON.stringify(key)}.`)
                    continue
            }
        }

        // If the packagePath option is not given, get all package.json files
        // from cwd up to the root of the git repo, the root of the monorepo,
        // or the root of the volume, whichever comes first.
        if (this.packages.size === 0) {

            // undefined = unknown (couldn't run git), null = not in a repo
            const gitTopLevel = await new Promise<string | null | undefined>(resolve => {
                cp.execFile('git', [ 'rev-parse', '--show-toplevel' ], (error, stdout) => resolve(
                    error ? typeof error.code === 'string' ? undefined : null
                          : path.normalize(stdout.trim())
                ))
            })

            find_up: for (let cwd = process.cwd(), previous = ''; previous !== cwd; previous = cwd, cwd = path.dirname(cwd)) {
                let file = path.join(cwd, 'package.json')
                if (await fileExists(file))
                    this.packages.add(file)

                // Break early if we are at the root of the git repo.
                if (cwd === gitTopLevel || (gitTopLevel === undefined && await directoryExists(path.join(cwd, '.git'))))
                    break

                // Break early if we are at the root of the monorepo.
                for (file of monorepoRootFiles) {
                    if (await fileExists(path.join(cwd, file)))
                        break find_up
                }
            }
        }

        // Gather dependencies names.
        const externalDependencies: Record<string, string> = {}
        for (const pkg of this.packages) {
            const json = await fs.readFile(pkg).then(
                buffer => JSON.parse(buffer.toString()) as PackageJson,
                (err: NodeJS.ErrnoException | SyntaxError) => err
            )
            if (json instanceof Error) {
                const message = json instanceof SyntaxError
                    ? `File ${JSON.stringify(pkg)} does not look like a valid package.json.`
                    : `Cannot read ${JSON.stringify(pkg)}, error: ${json.code}.`
                context.error({ message, cause: json })
            }

            Object.assign(externalDependencies,
                this.deps     ? json.dependencies         : undefined,
                this.devDeps  ? json.devDependencies      : undefined,
                this.peerDeps ? json.peerDependencies     : undefined,
                this.optDeps  ? json.optionalDependencies : undefined
            )

            // Break early if this is an npm/yarn workspace root.
            if (Array.isArray(json.workspaces))
                break
        }

        // Add all dependencies as a single include RegEx.
        const names = Object.keys(externalDependencies)
        if (names.length > 0)
            this.include.push(new RegExp('^(?:' + names.map(RegExp.escape).join('|') + ')(?:/.+)?$'))

        return this
    }

    isIncluded(id: string) {
        return this.include.length > 0 && this.include.some(rx => rx.test(id))
    }

    isExcluded(id: string) {
        return this.exclude.length > 0 && this.exclude.some(rx => rx.test(id))
    }

    static fromOptions(context: PluginContext, options: ExternalsOptions): Promise<Config> {
        return new Config().applyOptions(context, options)
    }
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
            config ??= await Config.fromOptions(this, options)
            config.packages.forEach(pkg => this.addWatchFile(pkg))
        },

        watchChange(id) {
            if (config?.packages.has(id))
                config = undefined
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
            assert(config)
            if (isBuiltin(specifier)) {
                const stripped = specifier.replace(/^node:/, '')
                const prefixed = 'node:' + stripped
                return {
                    id: config.builtinsPrefix === 'add'
                        ? prefixed
                        : config.builtinsPrefix === 'strip'
                            ? isBuiltin(stripped) ? stripped : prefixed
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
}

export default nodeExternals
export { nodeExternals }
