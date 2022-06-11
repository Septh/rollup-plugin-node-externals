# rollup-plugin-node-externals
A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Also handles npm dependencies, devDependencies, peerDependencies and optionalDependencies. Works in monorepos too!

> ## Breaking changes in version 4
> - In previous versions, the `deps` option (see below) defaulted to `false`.<br>This was practical, but often wrong: when bundling for distribution, you want your own dependencies to be installed by the package manager alongside your package, so they should not be bundled in the code. Therefore, the `deps` option now defaults to `true`.
> - Now requires Node 14 (up from Node 12 for previous versions).
> - Now has a _peer dependency_ on Rollup 2.60.0.

## Why do you need this?
<details><summary>(click to expand)</summary>
By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import * as path from 'path'` in your code generates an `Unresolved dependencies` warning.

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

- To bundle _a package that depends on other packages **at runtime**_ (e.g., a libray or a NodeJS CLI), the built-in defaults are just what you need:
```typescript
export default {
  ...
  plugins: [
    externals(),  // Make all Node builtins and all dependencies external
  ]
}
```

- To bundle _a standalone app_ (such as a browser app):
```typescript
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
```typescript
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

```typescript
import externals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    externals({
      // Make node builtins external. Optional. Default: true.
      builtins?: boolean,

      // Treat prefixed builtins as their unprefixed counterpart. Optional. Default: 'strip' (will be 'add' in next major).
      prefixedBuiltins?: boolean | 'strip' | 'add',

      // The path(s) to your package.json. Optional. See below for default.
      packagePath?: string | string[],

      // Make pkg.dependencies external. Optional. Default: true.
      deps?: boolean,

      // Make pkg.devDependencies external. Optional. Default: true.
      devDeps?: boolean,

      // Make pkg.peerDependencies external. Optional. Default: true.
      peerDeps?: boolean,

      // Make pkg.optionalDependencies external. Optional. Default: true.
      optDeps?: boolean,

      // Modules to force include in externals. Optional. Default: [].
      include?: string | RegExp | (string | RegExp)[],

      // Modules to force exclude from externals. Optional. Default: [].
      exclude?: string | RegExp | (string | RegExp)[]
    })
  ]
}
```

#### builtins?: boolean = true
Set the `builtins` option to `false` if you'd like to use some shims for those. You'll most certainly need [an other plugin](https://github.com/rollup/plugins/tree/master/packages/node-resolve/#resolving-built-ins-like-fs) for this.

#### prefixedBuiltins?: boolean | 'strip' | 'add' = 'strip'
How to handle the `node:` (or the legacy `nodejs:`) prefix some authors use in their code (i.e., `import path from 'node:path'`).
- If `false`, the import is used as-is, meaning that `'node:path'` and `'path'` are considered two distincts imports. **This may cause redundant imports in your final code if you (or your dependencies's) are mixing prefixed and unprefixed imports.**
- If `true`, prefixed builtins are simply treated as their unprefixed equivalent. _Note: This value is now deprecated and will be removed in the next major release of this plugin._
- If `strip` (the default), the import is resolved unprefixed. In effect, this homogenizes all your node imports to their unprefixed version.
- If `add`, the `node:` prefix is added. In effect, this homogenizes all your node imports to their prefixed version. _Note: `'add'` will be the default for this option in the next major release of this plugin._

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
```typescript
externals({
  deps: false,                // Deps will be bundled in
  include: /^fsevents/        // Except for fsevents
})
```

Conversely, use the `exclude` option to remove certain dependencies from the list of externals:
```typescript
externals({
  deps: true,                 // Deps are external
  exclude: 'electron-reload'  // Yet we want `electron-reload` bundled in
})
```

## Notes
### 1/ This plugin is smart
Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like so: `exclude: process.env.NODE_ENV === 'production' && 'my-prod-only-dep'`.

### 2/ This plugin is not _that_ smart
It uses an exact match against your imports, so if your are using some kind of path substitution in your code, eg.:
```typescript
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
```typescript
import externals from 'rollup-plugin-node-externals'
import resolve from '@rollup/plugin-node-resolve'

...

export default {
  ...
  plugins: [
    externals(),
    resolve(),
    ...
  ]
}
```
As a general rule of thumb, you might want to always make this plugin the first one in the `plugins` array.

### 4/ Rollup rules
Rollup's own `external` configuration option always takes precedence over this plugin. This is intentional.


## Licence
MIT
