# rollup-plugin-node-externals
A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Also handles npm dependencies, devDependencies, peerDependencies and optionalDependencies.

Works in monorepos too!

## Why you need this
<details><summary>(click to expand)</summary>

By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import path from 'node:path'` in your code generates an `Unresolved dependencies` warning.

The solution here is quite simple: you must tell Rollup that the `node:path` module is in fact _external_. This way, Rollup won't try to bundle it in and rather leave the `import` statement as is (or translate it to a `require()` call if bundling for CommonJS).

However, this must be done for each and every NodeJS built-in you happen to use in your program: `node:path`, `node:os`, `node:fs`, `node:url`, etc., which can quicky become cumbersome when done manually.

So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as external.

As an added bonus, this plugin will also allow you to declare your dependencies (as per your local or monorepo `package.json` file(s)) as external.
</details>

## Installation
Use your favorite package manager. Mine is [npm](https://www.npmjs.com).
```sh
npm install --save-dev rollup-plugin-node-externals
```

## Usage
When bundling an application or library, you want to have your **runtime dependencies** listed under `dependencies` in `package.json`, and **development dependencies** listed under `devDependencies`.

If you follow this simple rule, then the defaults are just what you need:
```js
export default {
  ...
  plugins: [
    externals(),
  ]
}
```

This will bundle your `devDependencies` in while leaving your `dependencies`, `peerDependencies` and `optionalDependencies` external.

### Options
All options are, well, optional.

```typescript
import externals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    externals({

      // Make node builtins external. Default: true.
      builtins?: boolean

      // node: prefix handing for importing Node builtins. Default: 'add'.
      builtinsPrefix?: 'add' | 'strip' | 'ignore'

      // The path(s) to your package.json. See below for default.
      packagePath?: string | string[]

      // Make pkg.dependencies external. Default: true.
      deps?: boolean

      // Make pkg.devDependencies external. Default: false.
      devDeps?: boolean

      // Make pkg.peerDependencies external. Default: true.
      peerDeps?: boolean

      // Make pkg.optionalDependencies external. Default: true.
      optDeps?: boolean

      // Modules to force include in externals. Default: [].
      include?: string | RegExp | (string | RegExp)[]

      // Modules to force exclude from externals. Default: [].
      exclude?: string | RegExp | (string | RegExp)[]
    })
  ]
}
```

#### builtins?: boolean = true
Set the `builtins` option to `false` if you'd like to use some shims/polyfills for those. You'll most certainly need [an other plugin](https://github.com/ionic-team/rollup-plugin-node-polyfills) for this.

#### builtinsPrefix?: 'add' | 'strip' | 'ignore' = 'add'
How to handle the `node:` scheme used in recent versions of Node (i.e., `import path from 'node:path'`).<br>
- If `add` (the default), the `node:` prefix is always added. In effect, this homogenizes all your imports of node builtins to their prefixed version.
- If `strip` (the default), the import is always resolved unprefixed. In effect, this homogenizes all your imports of node builtins to their unprefixed version.
- `ignore` will simply leave all prefixes as written in your code.
> _Note that prefix handling is independant of the `builtins` options being enabled or disabled._

#### packagePath?: string | string[] = []
If you're working with monorepos, the `packagePath` option is made for you. It can take a path, or an array of paths, to your package.json file(s). If not specified, the default is to start with the current directory's package.json then go up scan for all package.json files in parent directories recursively until either the root git directory is reached or until no other package.json can be found.

#### deps?: boolean = true
#### devDeps?: boolean = false
#### peerDeps?: boolean = true
#### optDeps?: boolean = true
Set the `deps`, `devDeps`, `peerDeps` and `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them with your code.

#### include?: string | RegExp | (string | RegExp)[] = []
Use the `include` option to force certain dependencies into the list of externals, regardless of other settings:
```js
externals({
  deps: false,                // Deps will be bundled in
  include: /^fsevents/        // Except for fsevents
})
```

#### exclude?: string | RegExp | (string | RegExp)[] = []
Conversely, use the `exclude` option to remove certain dependencies from the list of externals, regardless of other settings:
```js
externals({
  deps: true,                 // Deps are external
  exclude: 'electron-reload'  // Yet we want `electron-reload` bundled in
})
```

## Notes
### 1/ This plugin is smart
- Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like `exclude: process.env.NODE_ENV === 'production' && 'my-prod-only-dep'`.
- Subpath imports are supported with regexes, meaning that `include: /^lodash/` will externalize `lodash` and also `lodash/map`, `lodash/merge`, etc.

### 2/ This plugin is not _that_ smart
It uses an exact match against your imports _as written in your code_, so if your are using some kind of path substitution, eg.:

```js
// In your code, say '@/' is mapped to some directory:
import something from '@/mylib'
```

and you don't want `mylib` bundled in, then write:

```js
// In rollup.config.js:
externals({
    include: '@/mylib'
})
```

### 3/ Order matters
If you're also using [`@rollup/plugin-node-resolve`](https://github.com/rollup/plugins/tree/master/packages/node-resolve/#readme), make sure this plugin comes _before_ it in the `plugins` array:

```js
import externals from 'rollup-plugin-node-externals'
import resolve from '@rollup/plugin-node-resolve'

export default {
  ...
  plugins: [
    externals(),
    resolve(),
  ]
}
```

As a general rule of thumb, you might want to always make this plugin the first one in the `plugins` array.

### 4/ Rollup rules
Rollup's own `external` configuration option always takes precedence over this plugin. This is intentional.


## Breaking changes
<details><summary>(click to expand)</summary>

### Breaking changes in version 5
- In previous versions, the `devDeps` option defaulted to `true`.<br>This was practical, but often wrong: devDependencies are meant just for that: being used when developping. Therefore, the `devDeps` option now defaults to `false`, meaning Rollup will include them in your bundle.
- As anticipated since v4, the `builtinsPrefix` option now defaults to `'add'`.
- The deprecated `prefixedBuiltins` option has been removed. Use `builtinsPrefix` instead.
- `rollup-plugin-node-externals` no longer depends on the Find-Up package (while this is not a breaking change per se, it can be in some edge situations).
- The plugin now has a _peer dependency_ on `rollup ^2.60.0 || ^3.0.0`.

### Breaking changes in version 4
- In previous versions, the `deps` option defaulted to `false`.<br>This was practical, but often wrong: when bundling for distribution, you want your own dependencies to be installed by the package manager alongside your package, so they should not be bundled in the code. Therefore, the `deps` option now defaults to `true`.
- Now requires Node 14 (up from Node 12 for previous versions).
- Now has a _peer dependency_ on `rollup ^2.60.0`.
</summary>


## Licence
MIT
