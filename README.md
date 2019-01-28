# rollup-plugin-node-externals

A Rollup plugin that automatically declares NodeJS built-in modules
and npm dependencies as 'external'.

Useful when building a NodeJS or an Electron app and you don't want to bundle
npm modules with your own code but rather `require()` them at runtime.

## Why?

Because I was getting tired of writing:

```js
external: [
    'path', 'fs', 'fs-jetpack', 'electron-settings' /* and many more */
]
```

in my `rollup.config.js` file each time I begin working on an Electron app. :)

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
        deps: true,     // include pkg.dependencies (default: true)
        devDeps: true,  // include pkg.devDependencies (default: true)
        peerDeps: true, // include pkg.peerDependencies (default: true)
        optDeps: true,  // include pkg.optionalDependencies (default: true)
        except: []      // exceptions
    })
  ],
  external: [          // Rollup's `external` option has precedence -- see below
    'electron'
  ]
}
```

### Options

By default, the plugin will mark Node built-in modules and _all_ your dependencies as external.

- Node built-in modules (eg, `path`, `fs`, etc.) are always external. The list of built-ins is obtained via [the `builtin-modules` package](https://github.com/sindresorhus/builtin-modules), by Sindre Sorhus.
- Set the `deps`, `devDeps`, `peerDeps` and/or `optDeps` options to `false` to prevent the corresponding dependencies in your `package.json` file from being marked as external, therefore letting Rollup bundle them with your code.
- Use the `except` option to filter out the dependencies you want bundled with your code. It can be an array of names or regexes, for example:

```js
externals({
    deps: true,             // Mark all dependencies as external...
    except: [
        'electron-reload',  // ... except `electron-reload`
        /^vuex?/            // and the VueJS family
    ]
})
```

- Rollup's `external` option is always honored, no matter what:
```js
plugins: [
    externals({
        deps: false         // Keep all dependencies in the bundle
    })
],
external: [
    'electron'              // But `electron` stays external
]
```

## Licence

MIT
