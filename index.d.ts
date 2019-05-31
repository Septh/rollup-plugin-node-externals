/**
 * A Rollup plugin that automatically declares NodeJS built-in modules
 * and npm dependencies as 'external'.
 *
 * Useful when bundling a NodeJS or an Electron app and you don't want to bundle
 * node/npm modules with your own code but rather require() them at runtime.
 */
import { Plugin } from 'rollup';
export interface ExternalsOptions {
    deps?: boolean;
    devDeps?: boolean;
    peerDeps?: boolean;
    optDeps?: boolean;
    except?: string | RegExp | (string | RegExp)[];
}
/** For backward compatibility. Use `ExternalsOptions` instead. */
export declare type ExternalOptions = ExternalsOptions;
export default function externals(options?: ExternalsOptions): Plugin;
