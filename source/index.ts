import path from 'node:path'
import fs from 'node:fs/promises'
import cp from 'node:child_process'
import { isBuiltin } from 'node:module'
import type { Plugin } from 'rollup'

import self from '#package.json' with { type: 'json' }

// RegExp.escape() is in Node24 but not yet in TypeScript default lib :(
declare global {
    interface RegExpConstructor {
        escape(str: string): string
    }
}

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
const monorepoRootFiles = [
    'pnpm-workspace.yaml',  // pnpm
    'lerna.json',           // Lerna / Lerna Light
    'rush.json',            // Rush
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
]

/**
 * A Rollup/Vite plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
async function nodeExternals(options: ExternalsOptions = {}): Promise<Plugin> {

    // Resolve options.
    const config: Required<ExternalsOptions> = {
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

    const configWarnings: string[] = []
    for (const [ option, value ] of Object.entries(options)) {
        if (option in config) {
            if (value !== undefined && value !== null)
                (config as Record<string, unknown>)[option] = value
        }
        else configWarnings.push(`Ignoring unknown option '${JSON.stringify(option)}'`)
    }

    // Map the include and exclude options to arrays of regexes.
    const [ include, exclude ] = ([ 'include', 'exclude' ] as const).map(option => ([] as Array<MaybeFalsy<string | RegExp>>)
        .concat(config[option])
        .reduce((result, entry, index) => {
            if (entry instanceof RegExp)
                result.push(entry)
            else if (isString(entry))
                result.push(new RegExp('^' + RegExp.escape(entry) + '$'))
            else if (entry)
                configWarnings.push(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`)
            return result
        }, [] as RegExp[])
    )

    // Populate the packagePath option if not given by getting all package.json files
    // from cwd up to the root of the git repo, the root of the monorepo,
    // or the root of the volume, whichever comes first.
    const packagePaths = ([] as string[])
        .concat(config.packagePath)
        .filter(isString)
        .map(pkg => path.resolve(pkg))
    if (packagePaths.length === 0) {

        // Ask git the root of the repository, if any.
        // - If git is not available, resolves with `null`.
        // - If git says we're not inside a repo, resolves with an empty string ('').
        // - Otherwise, resolves with the path to the root of the repository.
        const gitTopLevel = await new Promise<string | null>(resolve => {
            cp.execFile('git', [ 'rev-parse', '--show-toplevel' ], (error, stdout) => {
                if (error) {
                    // - If `execFile()` failed to execute git, `error` is a `NodeJS.ErrnoException`
                    //   and `error.code` is a string, eg. 'ENOENT' or 'EPERM'.
                    // - Otherwise, git ran but exited with non-zero and we simply assume this is because
                    //   we are not inside a repo.
                    resolve(typeof error.code === 'string' ? null : '')
                }
                else resolve(path.normalize(stdout.trim()))
            })
        })

        for (let cwd = process.cwd(), previous = ''; previous !== cwd; previous = cwd, cwd = path.dirname(cwd)) {
            const name = path.join(cwd, 'package.json')
            if (await fileExists(name))
                packagePaths.push(name)

            // Break early if we are at the root of the git repo.
            if (cwd === gitTopLevel)
                break

            // If execFile() failed to run git, this doesn't necessarily mean that we're not in a repo
            // so fallback to the old method of checking for a `.git` directory.
            if (gitTopLevel === null && await directoryExists(path.join(cwd, '.git')))
                break

            // Otherwise, check if there is a known monorepo root file.
            const checks = await Promise.all(monorepoRootFiles.map(file => fileExists(path.join(cwd, file))))
            if (checks.some(Boolean))
                break
        }
    }

    // Gather dependencies names.
    if (packagePaths.length > 0) {
        const externalDependencies: Record<string, string> = {}

        for (const pkg of packagePaths) {
            const json = await fs.readFile(pkg, 'utf-8')
                .then(text => JSON.parse(text) as PackageJson)
                .catch((err: NodeJS.ErrnoException | SyntaxError) => err)
            if (json instanceof Error) {
                const message = json instanceof SyntaxError
                    ? `File ${JSON.stringify(pkg)} does not look like a valid package.json.`
                    : `Cannot read ${JSON.stringify(pkg)}, error: ${json.code}.`
                throw new Error(message, { cause: json })
            }

            Object.assign(externalDependencies,
                config.deps     ? json.dependencies         : undefined,
                config.devDeps  ? json.devDependencies      : undefined,
                config.peerDeps ? json.peerDependencies     : undefined,
                config.optDeps  ? json.optionalDependencies : undefined
            )

            // Break early if this is an npm/yarn workspace root.
            if (Array.isArray(json.workspaces))
                break
        }

        // Add all dependencies as a single include RegEx.
        const names = Object.keys(externalDependencies)
        if (names.length > 0)
            include.push(new RegExp('^(?:' + names.map(RegExp.escape).join('|') + ')(?:/.+)?$'))
    }

    const isIncluded = (id: string) => include.length > 0 && include.some(rx => rx.test(id)),
          isExcluded = (id: string) => exclude.length > 0 && exclude.some(rx => rx.test(id))

    return {
        name: self.name.replace(/^rollup-plugin-/, ''),
        version: self.version,
        apply: 'build',
        enforce: 'pre',

        buildStart() {

            // Display initial warnings, if any, but only once.
            let warning: string | undefined
            while (warning = configWarnings.shift())
                this.warn(warning)

            // Watch all package.json
            packagePaths.forEach(pkg => this.addWatchFile(pkg))
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
}

export default nodeExternals
export { nodeExternals }
