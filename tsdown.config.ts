import { defineConfig } from 'tsdown'

// Two halves with different contracts:
//  - the host entry is a normal ESM plugin (it contributes nothing);
//  - the client entry must be CJS inside the runtime's `__ModuleLoader__`
//    envelope, with `react` left to the runtime's `require`.
// `build` runs scripts/wrap-client.mjs afterwards to add that envelope.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    dts: true,
    clean: true,
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    external: ['react'],
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    clean: false,
  },
])
