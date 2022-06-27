# rollup-plugin-node-externals
A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Also handles npm dependencies, devDependencies, peerDependencies and optionalDependencies.

Works in monorepos too!

> ## Breaking changes in version 4
> - In previous versions, the `deps` option (see below) defaulted to `false`.<br>This was practical, but often wrong: when bundling for distribution, you want your own dependencies to be installed by the package manager alongside your package, so they should not be bundled in the code. Therefore, the `deps` option now defaults to `true`.
> - Now requires Node 14 (up from Node 12 for previous versions).
> - Now has a _peer dependency_ on Rollup ^2.60.0.

## Why you need this
<details><summary>(click to expand)</summary>

By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import path from 'path'` in your code generates an `Unresolved dependencies` warning.

The solution here is quite simple: you must tell Rollup that the `path` module is in fact `external`. This way, Rollup won't try to bundle it in and rather leave the `import` statement as is (or translate it to a `require()` call if bundling for CommonJS).

However, this must be done for each and every NodeJS built-in you happen to use in your program: `path`, `os`, `fs`, `url`, etc., which can quicky become cumbersome when done manually.

So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as `external`.

As an added bonus, this plugin will also allow you to declare your dependencies (as per your local or monorepo `package.json` file(s)) as external.
</details>

## Installation
Use your favorite package manager. Mine is [npm](https://www.npmjs.com).
```sh
npm install --save-dev rollup-plugin-node-externals
```

## Usage
- To bundle a package that depends on other packages **at runtime**, the built-in defaults are just what you need:
```js
export default {
  ...
  plugins: [
    externals(),  // Make all Node builtins and all dependencies external
  ]
}
```

- To bundle _a standalone package_:
```js
export default {
  ...
  plugins: [
    externals({
      deps: false,    // Dependencies will be bundled in
    }),
  ]
}
```

- You may also want to bundle some libraries with your code but still `import`/`require` others at runtime. In that case, you could use something like:
```js
export default {
  ...
  plugins: [
    externals({
      deps: true,     // Regular dependencies are external
      devDeps: false  // devDependencies will be bundled in
    }),
  ]
}
```


### Options
All options are, well, optional.

```typescript
import externals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    externals({
      // Make node builtins external. Default: true.
      builtins?: boolean,

      // node: prefix handing for importing Node builtins.
      // Default: 'strip' (will be 'add' in next major).
      builtinsPrefix?: 'add' | 'strip',

      // DEPRECATED. Will be removed in next major.
      // Please use builtinsPrefix instead (see above).
      // Default: 'strip'
      prefixedBuiltins?: boolean | 'strip' | 'add',

      // The path(s) to your package.json. See below for default.
      packagePath?: string | string[],

      // Make pkg.dependencies external. Default: true.
      deps?: boolean,

      // Make pkg.devDependencies external. Default: true.
      devDeps?: boolean,

      // Make pkg.peerDependencies external. Default: true.
      peerDeps?: boolean,

      // Make pkg.optionalDependencies external. Default: true.
      optDeps?: boolean,

      // Modules to force include in externals. Default: [].
      include?: string | RegExp | (string | RegExp)[],

      // Modules to force exclude from externals. Default: [].
      exclude?: string | RegExp | (string | RegExp)[]
    })
  ]
}
```

#### builtins?: boolean = true
Set the `builtins` option to `false` if you'd like to use some shims/polyfills for those. You'll most certainly need [an other plugin](https://github.com/ionic-team/rollup-plugin-node-polyfills) for this.

#### builtinsPrefix?: 'add' | 'strip' = 'strip'
How to handle the `node:` scheme used in recent versions of Node (i.e., `import path from 'node:path'`).
- If `strip` (the default), the import is always resolved unprefixed. In effect, this homogenizes all your imports of node builtins to their unprefixed version.
- If `add`, the `node:` prefix is always added. In effect, this homogenizes all your imports of node builtins to their prefixed version.<br>
_Note: `'add'` will be the default for this option in the next major release of this plugin._

#### [DEPRECATED] prefixedBuiltins?: boolean | 'add' | 'strip' = 'strip'
How to handle the `node:` scheme used in recent versions of Node (i.e., `import path from 'node:path'`).
- If `strip` (the default), the import is always resolved unprefixed. In effect, this homogenizes all your imports of node builtins to their unprefixed version.
- If `add`, the `node:` prefix is always added. In effect, this homogenizes all your imports of node builtins to their prefixed version.<br>
- If `false`, the import is used as-is, meaning that `'node:path'` and `'path'` are considered two distincts imports. **This may cause redundant imports in your final code if you (or your dependencies) are mixing prefixed and unprefixed imports.**<br>
- `true` is the same as `add`.<br>

#### packagePath?: string | string[] = []
If you're working with monorepos, the `packagePath` option is made for you. It can take a path, or an array of paths, to your package.json file(s). If not specified, the default is to start with the current directory's package.json then go up scan for all package.json files in parent directories recursively until either the root git directory is reached or until no other package.json can be found.

#### deps?: boolean = true
#### devDeps?: boolean = true
#### peerDeps?: boolean = true
#### optDeps?: boolean = true
Set the `deps`, `devDeps`, `peerDeps` and `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them with your code.

#### include?: string | RegExp | (string | RegExp)[] = []
#### exclude?: string | RegExp | (string | RegExp)[] = []
Use the `include` option to force certain dependencies into the list of externals:
```js
externals({
  deps: false,                // Deps will be bundled in
  include: /^fsevents/        // Except for fsevents
})
```

Conversely, use the `exclude` option to remove certain dependencies from the list of externals:
```js
externals({
  deps: true,                 // Deps are external
  exclude: 'electron-reload'  // Yet we want `electron-reload` bundled in
})
```

## Notes
### 1/ This plugin is smart
Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like `exclude: process.env.NODE_ENV === 'production' && 'my-prod-only-dep'`.

### 2/ This plugin is not _that_ smart
It uses an exact match against your imports, so if your are using some kind of path substitution in your code, eg.:
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

However, subpath imports are supported with regexes, meaning that `include: /^lodash/` will also externalize `loadash/map`, `lodash/merge`, etc.


### 3/ Order matters
If you're also using `@rollup/plugin-node-resolve`, make sure this plugin comes _before_ it in the `plugins` array:
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


## Licence
MIT
