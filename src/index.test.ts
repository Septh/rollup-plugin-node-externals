import test from 'ava'
import { testProp, fc } from 'ava-fast-check'
import { Arbitrary } from 'fast-check'
import { PluginContext, Plugin } from 'rollup'
import externals, { ExternalsOptions } from './index'

// Returns an arbitrary for generating externals options objects
const externalsOptionsArbitrary = (): Arbitrary<ExternalsOptions> =>
    fc.record({
        packagePath: fc.string(),
        builtins: fc.boolean(),
        deps: fc.boolean(),
        devDeps: fc.boolean(),
        peerDeps: fc.boolean(),
        optDeps: fc.boolean(),
        include: fc.oneof(fc.string(), fc.array(fc.string())),
        exclude: fc.oneof(fc.string(), fc.array(fc.string())),
        except: fc.oneof(fc.string(), fc.array(fc.string()))
    }, { withDeletedKeys: true })

testProp(
    'does not throw on constructing plugin object for valid input',
    [externalsOptionsArbitrary()],
    options => {
        try {
            externals(options)
            return true
        } catch {
            return false
        }
    }
)

test('does not mark "dependencies" dependency as external by default', t => {
    const source = 'example'
    const importer = 'me'
    const plugin = externals({ packagePath: './fixtures/test.json' }) as Plugin & PluginContext

    t.is(plugin.resolveId(source, importer), null)
})
