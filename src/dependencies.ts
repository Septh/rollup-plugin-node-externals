import { dirname, relative, isAbsolute } from 'path'
import { promises as fs } from 'fs'
import { findUp } from 'find-up'

/**
 * Determines if the `child` path is under the `parent` path.
 */
function isInDirectory(parent: string, child: string): boolean {
    const relativePath = relative(parent, child)
    return !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

/**
 * @internal
 * Iterates over package.json file paths recursively found in parent directories, starting from the
 * current working directory. If the current working directory is in a git repository, then package.json
 * files outside of the git repository will not be yielded.
 */
export async function* findPackagePaths(): AsyncGenerator<string> {
    // Find git root if in git repository
    const gitDirectoryPath: string | undefined = await findUp('.git', { type: 'directory' })
    const gitRootPath: string | undefined = gitDirectoryPath === undefined
        ? undefined
        : dirname(gitDirectoryPath)

    function isInGitDirectory(path: string): boolean {
        return gitRootPath === undefined || isInDirectory(gitRootPath, path)
    }

    let cwd: string = process.cwd()
    let packagePath: string | undefined

    while (
        (packagePath = await findUp('package.json', { type: 'file', cwd })) &&
        isInGitDirectory(packagePath)
    ) {
        yield packagePath
        cwd = dirname(dirname(packagePath))
    }
}

/** @internal */
export async function findDependencies(
    { packagePaths, keys, warnings }: {
        packagePaths: AsyncIterable<string> | Iterable<string>,
        keys: string[],
        warnings: string[]
    }
): Promise<string[]> {
    const dependencies: Set<string> = new Set()

    for await (const packagePath of packagePaths) {
        try {
            const pkg: { [key in PropertyKey]: any } = JSON.parse((await fs.readFile(packagePath)).toString()) ?? {}

            for (const key of keys) {
                const dependenciesToVersions: { [key in PropertyKey]: any } = pkg[key] ?? {}

                for (const dependency of Object.keys(dependenciesToVersions)) {
                    dependencies.add(dependency)
                }
            }
        } catch {
            warnings.push(`Couldn't process '${packagePath}'. Make sure it is a valid JSON or use the 'packagePath' option`)
        }
    }

    return Array.from(dependencies)
}
