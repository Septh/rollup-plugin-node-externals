# rollup-plugin-node-externals
A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Can also handle npm dependencies, devDependencies, peerDependencies and optionalDependencies. Works in monorepos too!

## Why?
By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import * as path from 'path'` in your code generates an `Unresolved dependencies` warning.

The solution here is quite simple: you must tell Rollup that the `path` module is in fact `external`. This way, Rollup won't try to bundle it in and rather leave the `import` statement as is (or translate it to a `require()` call if bundling for CommonJS).

However, this must be done for each and every NodeJS built-in you happen to use in your program: `path`, `os`, `fs`, `url`, etc., which can quicky become cumbersome when done manually.

So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as `external`.

As an added bonus, this plugin will also allow you to declare your dependencies (as per in your local or monorepo `package.json` file) as external.


## Installation
Use your favorite package manager. Mine is [npm](https://www.npmjs.com).
```sh
npm install --save-dev rollup-plugin-node-externals
```


## Usage
```typescript
import externals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    externals({
      // The path(s) to your package.json. Optional. See below for default.
      packagePath?: string | string[],

      // Make node builtins external. Optional. Default: true
      builtins?: boolean,

      // Treat prefixed builtins as their unprefixed counterpart. Optional. Default: true
      prefixedBuiltins?: boolean | 'strip',

      // Make pkg.dependencies external. Optional. Default: false
      deps?: boolean,

      // Make pkg.devDependencies external. Optional. Default: true
      devDeps?: boolean,

      // Make pkg.peerDependencies external. Optional. Default: true
      peerDeps?: boolean,

      // Make pkg.optionalDependencies external. Optional. Default: true
      optDeps?: boolean,

      // Modules to force include in externals. Optional. Default: []
      include?: string | RegExp | (string | RegExp)[],

      // Modules to force exclude from externals. Optional. Default: []
      exclude?: string | RegExp | (string | RegExp)[]
    })
  ]
}
```

### Options
Most of the time, the built-in defaults are just what you need:
```typescript
import externals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    externals(),  // Bundle deps in; make all Node builtins, devDeps, peerDeps and optDeps external
  ]
}
```

#### packagePath?: string | string[] = []
If you're working with monorepos, the `packagePath` is made for you. It can take a path, or an array of paths, to your package.json file(s). If not specified, the default is to start with the current directory's package.json then go up scan for all package.json files in parent directories recursively until either the root git directory is reached or until no other package.json can be found.

#### builtins?: boolean = true
Set the `builtins` option to `false` if you'd like to use some shims for those. You'll most certainly need an other plugin for this.

#### prefixedBuiltins?: boolean | 'strip' = true
How to handle the `node:` (or sometimes `nodejs:`) prefix some authors use in their code (i.e., `import path from 'node:path'`). If `true` (default), prefixed builtins are treated as their unprefixed equivalent. If `strip`, the prefix is removed from the name and other plugins will never know it was there.

#### deps?: boolean = false
Set the `deps` option to `true` to externalize your normal dependencies, therefore preventing Rollup from bundling them with your code.

#### devDeps?: boolean = true
#### peerDeps?: boolean = true
#### optDeps?: boolean = true
Set the `devDeps`, `peerDeps` and `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them with your code. Note that bundling these dependencies is quite meaningless but it might be useful as a transitional step before migrating them to `dependencies`.

#### include?: string | RegExp | (string | RegExp)[] = []
#### exclude?: string | RegExp | (string | RegExp)[] = []
Use the `include` option to force certain dependencies into the list of externals:
```typescript
externals({
  deps: false,          // Deps will be bundled in
  include: /^fsevents/  // Except for fsevents
})
```

Conversely, use the `exclude` option to remove certain dependencies from the list of externals:
```typescript
externals({
  deps: true,           // Deps are external
  exclude: [
    'electron-reload'   // Yet we want `electron-reload` bundled in
  ]
})
```

## Notes
### 1/ This plugin is smart
Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like so: `exclude: process.env.NODE_ENV === 'production' && /my-prod-only-dep/`.

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


## Migrating from version 1.x
- In 1.x, normal dependencies were externalized by default. This is no more true since 2.0, so you'll need to change:
```typescript
externals()
```
to:
```typescript
externals({ deps: true })
```
if you want the same behavior.

- The `except` option from 1.x has been deprecated in 2.0 and removed in 3.0. Use the Rollup-friendlier `exclude` option instead.


## Licence
MIT
