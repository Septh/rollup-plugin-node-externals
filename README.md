<p>

![NPM Version](https://img.shields.io/npm/v/rollup-plugin-node-externals?label=latest)
![Rollup 4.0](https://img.shields.io/badge/Rollup-%3E%3D4.0.0-orange)
![Vite 5.0](https://img.shields.io/badge/Vite-%3E%3D5.0.0-purple)
![NPM Downloads](https://img.shields.io/npm/dm/rollup-plugin-node-externals)
![NPM License](https://img.shields.io/npm/l/rollup-plugin-node-externals)

</p>

# rollup-plugin-node-externals
A Rollup/Vite plugin that automatically declares NodeJS built-in modules and npm dependencies as `external`.
- Ultra-lightweight: less than 10 kB download, less than 25 kB unpacked.
- Zero runtime dependencies.
- Works in monorepos.
- Works with all package managers.


## Why you need this
<details><summary>(click to read if you're wondering)</summary>

By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import path from 'node:path'` in your code results in an `Unresolved dependencies` warning.

The solution here is quite simple: you must tell Rollup that the `node:path` module is in fact _external_. This way, Rollup won't try to bundle it in and rather leave the `import` statement as is (or translate it to a `require()` call if bundling for CommonJS).

However, this must be done for each and every NodeJS built-in you happen to use in your program: `node:path`, `node:os`, `node:fs`, `node:url`, etc., which can quickly become cumbersome when done manually.

So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as external. As an added bonus, this plugin will also declare your dependencies (as per your local or monorepo `package.json` file(s)) as external.
</details>

## Requirements
- Rollup >= 4 or Vite >= 5
- NodeJS >= 24


## Installation
Use your favorite package manager. Mine is [npm](https://www.npmjs.com):

```sh
npm install --save-dev rollup-plugin-node-externals
```


## Usage

### Import
The plugin is available both as the default export and as a named export:

```js
import nodeExternals from 'rollup-plugin-node-externals'
```

and

```js
import { nodeExternals } from 'rollup-plugin-node-externals'
```

will both work.


### Options
You generally want to have your _runtime dependencies_ (those that will be imported/required at runtime) listed under `dependencies` in `package.json`, and your _development dependencies_ (those that should be bundled in by Rollup/Vite) listed under `devDependencies`.

If you follow this simple rule, then the default settings are just what you need:

```js
// rollup.config.js / vite.config.js

export default {
  ...
  plugins: [
    nodeExternals(),
  ]
}
```

This will bundle your `devDependencies` in while leaving your `dependencies`, `peerDependencies` and `optionalDependencies` external.

Should the defaults not suit your case, here is the full list of options.

```typescript
import nodeExternals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    nodeExternals({

      // Mark NodeJS builtins external. Default: true.
      builtins?: boolean

      // node: prefix handing for importing NodeJS builtins. Default: 'add'.
      builtinsPrefix?: 'add' | 'strip' | 'ignore'

      // The path(s) to your package.json. Default: read below.
      packagePath?: string | string[]

      // Mark dependencies external? Default: true.
      deps?: boolean

      // Mark devDependencies external? Default: false.
      devDeps?: boolean

      // Mark peerDependencies external? Default: true.
      peerDeps?: boolean

      // Mark optionalDependencies external? Default: true.
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
Set the `builtins` option to `false` if you'd like to use some shims/polyfills for those. You'll most certainly need [an other plugin](https://www.npmjs.com/package/rollup-plugin-node-polyfills) as well.

#### builtinsPrefix?: 'add' | 'strip' | 'ignore' = 'add'
How to handle the `node:` scheme when importing builtins (i.e., `import path from 'node:path'`).
- If `add` (the default, recommended), the `node:` scheme is always added if missing, so `path` becomes `node:path`. In effect, this dedupes your imports of Node builtins by homogenizing their names to their schemed version.
- If `strip`, the scheme is always removed, so `node:path` becomes `path`. In effect, this dedupes your imports of Node builtins by homogenizing their names to their scheme-less version. Schemed-only builtins like `node:test` or `node:sqlite` are never stripped.
- `ignore` will simply leave all builtins imports as written in your code. Caveat: if you write `node:path` but one of your bundled dependencies uses `path` (or the other way around), your bundle will end up with both `node:path` and `path` imports.

>[!NOTE]
> Scheme handling is always applied, regardless of the `builtins` options being enabled or not.

#### packagePath?: string | string[] = []
This option allows you to specify which `package.json` file(s) should be scanned for dependencies.

If not specified, the default is to start with the current directory's `package.json` then go up scan for all `package.json` files in parent directories recursively until either the root git directory is reached, the root of the monorepo is reached, or no other `package.json` can be found.

#### deps?: boolean = true<br>devDeps?: boolean = false<br>peerDeps?: boolean = true<br>optDeps?: boolean = true
Set the `deps`, `devDeps`, `peerDeps` and `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup/Vite bundle them with your code.

#### include?: string | RegExp | (string | RegExp)[] = []
Use the `include` option to force include certain dependencies into the list of externals regardless of other settings:

```js
nodeExternals({
  deps: false,          // Deps will be bundled in
  include: 'some-dep'   // Except for 'some-dep'
})
```

#### exclude?: string | RegExp | (string | RegExp)[] = []
Conversely, use the `exclude` option to remove certain dependencies from the list of externals regardless of other settings:

```js
nodeExternals({
  deps: true,           // Keep deps external
  exclude: /^this-dep/  // Yet we want `this-dep` (and all its sub-paths) bundled in
})
```


## Notes

### 1/ This plugin is smart
- Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like `exclude: process.env.NODE_ENV === 'production' && 'my-prod-only-dep'`.
- Subpath imports are supported with regexes, meaning that `include: /^lodash/` will externalize `lodash` and also `lodash/map`, `lodash/merge`, etc.

### 2/ This plugin is not _that_ smart
It uses an exact match against your imports _as written in your code_. No resolving of path aliases or substitutions is made.

### 3/ Order matters
If you're also using [`@rollup/plugin-node-resolve`](https://github.com/rollup/plugins/tree/master/packages/node-resolve/#readme), make sure this plugin comes _before_ it in the `plugins` array:

```js
import nodeExternals from 'rollup-plugin-node-externals'
import nodeResolve from '@rollup/plugin-node-resolve'

export default {
  ...
  plugins: [
    nodeExternals(),
    nodeResolve(),
  ]
}
```

Note that as of version 7.1, this plugin has a `enforce: 'pre'` property that will make Rollup and Vite call it very early in the module resolution process. Nevertheless, it is best to always make this plugin the first one in the `plugins` array.

### 4/ Rollup rules
Rollup's own `external` configuration option always takes precedence over this plugin. This is intentional.

### 5/ Using with Vite
This plugin has been compatible with Vite out-of-the-box since version 7.1. If you found an old tutorial on the Internet telling you to use some special trick to make it work with Vite… just don't. Here's how you should write your `vite.config.js`:

```js
import { defineConfig } from 'vite'
import nodeExternals from 'rollup-plugin-node-externals'

export default defineConfig({
  ...
  plugins: [
    nodeExternals()
    // other plugins follow
  ]
})
```

> [!IMPORTANT]
> Make sure you use the _top-level plugins array_ in `vite.config.js` as shown above. __Using `build.rollupOptions.plugins` will probably not work__. See [#35](https://github.com/Septh/rollup-plugin-node-externals/issues/35) for details.


## What's new in v9

This version mainly enhances performance when used in watch mode. This was achieved by ensuring that the `buildStart` hook builds the full dependencies list only when necessary.

### Breaking changes
- As initiated with v7, each major update requires at least the **Active LTS** [version of NodeJS](https://github.com/nodejs/Release#release-schedule) at the time of publishing. With v9, this means NodeJS v24+ (up from v8's 20+).

See [Github releases](https://github.com/Septh/rollup-plugin-node-externals/releases) for full change log.


## License
MIT
