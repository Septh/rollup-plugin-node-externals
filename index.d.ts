import { Plugin } from 'rollup'

export interface ExternalOptions {
    deps?: boolean;
    devDeps?: boolean;
    peerDeps?: boolean;
    optDeps?: boolean;
    except?: string | RegExp | (string | RegExp)[];
}

export default function externals(options?: ExternalOptions): Plugin
