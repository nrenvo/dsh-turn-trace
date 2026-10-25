/**
 * Wraps the CJS client bundle in the DSH module-loader envelope.
 *
 * The client runtime loads a plugin file and then requires that the file called
 * `window.__ModuleLoader__.load({ id, factory })`; a bare ESM/CJS module never
 * registers and is rejected. The factory receives the runtime's `require`
 * (which resolves `react`), so the bundle body stays ordinary CJS.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const packageName = 'dsh-turn-trace'
const file = join(process.cwd(), 'lib', 'client.js')
const body = readFileSync(file, 'utf8')

const wrapped = [
  '// Generated wrapper: do not edit by hand (scripts/wrap-client.mjs).',
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(packageName)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  body,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')

writeFileSync(file, wrapped)
console.log(`wrapped ${file} for __ModuleLoader__`)
