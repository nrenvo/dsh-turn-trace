import { readFileSync } from 'node:fs'

globalThis.window = globalThis
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ setAttribute() {}, textContent: '' }),
  head: { appendChild() {} },
}
const modules = []
globalThis.__ModuleLoader__ = { load: (handoff) => modules.push(handoff) }

new Function('window', 'document', readFileSync('lib/client.js', 'utf8'))(globalThis.window, globalThis.document)
const handoff = modules[0]
class FakeComponent {}
const fakeReact = {
  Component: FakeComponent,
  createElement: () => null,
  useMemo: (fn) => fn(),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useSyncExternalStore: (_sub, get) => get(),
  Fragment: 'fragment',
}
const mod = handoff.factory((spec) => (spec === 'react' ? fakeReact : Promise.reject(new Error(`unexpected ${spec}`))))

// 1. hostile context: every unknown property access throws, like cordis without inject
const hostile = new Proxy({}, { get() { throw new Error('cannot access service without inject') } })
let threw = false
try { mod.apply(hostile) } catch { threw = true }
console.log('hostile context  :', threw ? 'THREW (bad)' : 'contained (good)')

// 2. context whose get() throws
let threw2 = false
try { mod.apply({ get() { throw new Error('no such service') } }) } catch { threw2 = true }
console.log('throwing get()   :', threw2 ? 'THREW (bad)' : 'contained (good)')

// 3. normal context: registers the view
let registered = null
mod.apply({
  get(name) {
    if (name === 'slots') return { inject: (_s, run) => run(), register: (spec) => { registered = spec } }
    if (name === 'locale') return { register: () => () => {}, bind: () => (k) => k }
    return undefined
  },
})
console.log('normal context   :', registered === null ? 'DID NOT REGISTER (bad)' : `registered ${registered.id} (good)`)

// 4. no locale service at all: must still register, with fallback copy
let registered2 = null
mod.apply({
  get(name) {
    if (name === 'slots') return { inject: (_s, run) => run(), register: (spec) => { registered2 = spec } }
    return undefined
  },
})
console.log('no locale service:', registered2 === null ? 'DID NOT REGISTER (bad)' : `registered ${registered2.id} (good)`)
