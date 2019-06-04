# rollup-plugin-node-externals

A Rollup plugin that automatically declares NodeJS built-in modules as `external`. Can also handle npm dependencies, devDependencies, peerDependencies and optionalDependencies.

## Why?

Because I was getting tired of writing:

```js
external: [
    'path', 'fs', 'os'    /* and many more */
]
```

in my `rollup.config.js`.


## Install

```sh
npm install --save-dev rollup-plugin-node-externals
```


## Usage

```js
import externals from 'rollup-plugin-node-externals'

export default {
  input: 'src/renderer/index.ts',
  output: {
    file: 'dist/renderer/bundle.js',
    format: 'cjs'
  },
  plugins: [
    externals({
        builtins: true, // make node builtins external (default: true)
        deps: false,    // make pkg.dependencies external (default: false)
        devDeps: true,  // make pkg.devDependencies external (default: true)
        peerDeps: true, // make pkg.peerDependencies external (default: true)
        optDeps: true,  // make pkg.optionalDependencies external (default: true)
        exclude: [],    // deps to exclude from externals (default: [])
        include: [],    // deps to include in externals (default: [])
        except: []      // deprecated -- see below
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
    externals(),        // Bundle deps in; make Node, devDeps, peerDeps and optDeps external
  ]
}
```

&nbsp;
> Note: if you use `rollup-plugin-node-resolve`, make sure that this plugin comes first in the plugins array:
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

&nbsp;
> Note: the list of builtins is obtained via [the `builtin-modules` package](https://github.com/sindresorhus/builtin-modules), by Sindre Sorhus and should be up-to-date with your current NodeJS version.


### Options

By default, the plugin will mark all Node built-in modules and _all_ your `dev-`, `peer-` and `optionalDependencies` as external. Normal `dependencies` are left unmarked so Rollup will still bundle them within your code as expected in most situations.

- Set the `deps`, `devDeps`, `peerDeps` and/or `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them within your code. Set them to `true` for Rollup to treat the corresponding dependencies as external.
- Use the `exclude` option to remove certain dependencies from the list of externals. `exclude` can be a string, a regex, or an array of those, for example:
```js
externals({
    deps: true,             // Don't bundle dependencies, we'll require()'em at runtime
    exclude: [
        'electron-reload',  // Yet we want `electron-reload` bundled in
        /^vuex?/            // as well as the VueJS family (vue, vuex, vue-router, etc.)
    ]
})
```
- Use the `include` option to force certain dependencies into the list of externals, for example:
```js
externals({
    deps: true,             // Don't bundle dependencies, we'll require()'em at runtime
    include: /^lodash/      // Since we're using the namespaced version of lodash (eg. import get from "lodash/get"),
                            // we must use this RegEx to make sure all of lodash is correctly externalized
})
```
Just like `exclude`, the `include` option can be a string, a regex or an array of those.

&nbsp;
> Note: this plugin uses an exact match against your imports, so if your are using some path substitution in your code, eg.:
```js
// in your code:
import something from '@/mylib'   // Say '@/' is mapped to some directory outside your project
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
