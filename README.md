# rollup-plugin-node-externals

A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Can also handle npm dependencies, devDependencies, peerDependencies and optionalDependencies.

## Why?

By default, Rollup doesn't know a thing about NodeJS, so using simple things like `require('path')` or `import * as path from 'path'` in your code generates an `Unresolved dependencies` error. The solution here is to tell Rollup that the `path` module is in fact `external`: this way, Rollup won't try to bundle the `path` module in but simply leave the `require()` or `import` statement as is.

However, this must be done for each and every NodeJS built-in modules: `path`, `os`, `fs`, etc., which can quicky become cumbersome when done manually. So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as `external`.

This plugin will also allow you, should you need it, to declare your dependencies (as declared in your `package.json` file) as `external` so they are not bundled in but will be required or imported at runtime.


## Install

```sh
npm install --save-dev rollup-plugin-node-externals
```


## Usage

```js
import externals from 'rollup-plugin-node-externals'

const packagePath = 'path/to/package.json'  // Optional, useful in monorepos

export default {
  // ...
  plugins: [
    externals({
        packagePath,      // The path to your package.json (default: process.cwd() which is usally the same dir where rollup.config.js stands)
        builtins: true,   // make node builtins external (default: true)
        deps: true,       // make pkg.dependencies external (default: false)
        devDeps: true,    // make pkg.devDependencies external (default: true)
        peerDeps: true,   // make pkg.peerDependencies external (default: true)
        optDeps: true,    // make pkg.optionalDependencies external (default: true)
        exclude: [],      // deps to exclude from externals (default: [])
        include: [],      // deps to include in externals (default: [])
        except: []        // deprecated -- see below
    })
  ]
}
```

Most of the time, the built-in defaults are just what you need:
```js
import externals from 'rollup-plugin-node-externals'
// ...

export default {
  // ...
  plugins: [
    externals(),        // Bundle deps in; make Node builtins, devDeps, peerDeps and optDeps external
  ]
}
```

> Note: the list of builtins is obtained via [the builtin-modules package](https://github.com/sindresorhus/builtin-modules), by Sindre Sorhus and should be up-to-date with your current NodeJS version.

> Note: if you're also using `rollup-plugin-node-resolve`, make sure this plugin comes before it in the `plugins` array:
```js
import externals from 'rollup-plugin-node-externals'
import resolve from 'rollup-plugin-node-resolve'
// ...

export default {
  // ...
  plugins: [
    externals(),
    resolve(),
    // other plugins
  ]
}
```


### Options

By default, the plugin will mark all Node built-in modules and _all_ your `dev-`, `peer-` and `optionalDependencies` as external. Normal `dependencies` are left unmarked so Rollup will still bundle them within your code as expected in most situations.

- Set the `deps`, `devDeps`, `peerDeps` and/or `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them within your code. Set them to `true` for Rollup to treat the corresponding dependencies as external.

- Use the `exclude` option to remove certain dependencies from the list of externals. `exclude` can be a string, a regex, or an array of those, for example:
```js
externals({
    deps: true,             // Don't bundle dependencies, we'll require() them at runtime instead
    exclude: [
        'electron-reload',  // Yet we want `electron-reload` bundled in
        /^vuex?/            // as well as the VueJS family (vue, vuex, vue-router, etc.)
    ]
})
```

- Use the `include` option to force certain dependencies into the list of externals, for example:
```js
externals({
    peerDeps: false,          // Bundle peerDependencies in
    include: /^lodash(\/.+)?/ // Except for Lodash (this regex accounts for the namespaced version of lodash, ie. loadash/map)
})
```
Just like `exclude`, the `include` option can be a string, a regex or an array of those.

> Note: this plugin uses an exact match against your imports, so if your are using some path substitution in your code, eg.:
```js
// in your code:
import something from '@/mylib'   // Say '@/' is mapped to some directory
...
```
and you don't want `mylib` bundled in, then write:
```js
// in rollup.config.js:
externals({
    include: '@/mylib'            // or include: /^@\//
})
```

### Migrating from version 1.x

- In 1.x, normal dependencies were externalized by default. This is no more true, so you'll need to change:
```js
externals()
```
to:
```js
externals({ deps: true })
```
if you want the same behavior.
- For consistency with all other Rollup plugins out there, the `except` option from 1.x is now deprecated in favor of the Rollup-friendly `exclude` option.
`except` is still accepted for backward compatibility and works exactly the same as `exclude` but it will issue a warning if used. To suppress this warning, just replace `except` with `include`.


## Licence

MIT
