/**
 * dsh-turn-trace — smoke tests.
 *
 * Run: `pnpm test` (or `tsx tests/smoke.ts`). Plain assertions, non-zero exit
 * on failure. The fold is pure, so these build `chat` snapshots by hand and
 * assert the money: step numbering, per-step cost from the snapshot's model id,
 * the picker fallback, turn totals, tools, and peak/off-peak rates.
 */
import type { ChatNodeLike, ChatSnapshotLike } from '../src/contract.ts'
import { foldChat } from '../src/fold.ts'
import { estimateCost, isPeak, tierForModel } from '../src/pricing.ts'

let failures = 0

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    failures += 1
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Off-peak Thursday: 1970-01-01T00:00Z. Peak: same day 02:00Z. */
const T0 = Date.UTC(1970, 0, 1, 0, 0, 0)
const T_PEAK = Date.UTC(1970, 0, 1, 2, 0, 0)

function assistant(
  key: string,
  turn: number,
  step: number,
  time: number,
  input: number,
  output: number,
  model?: string,
  say?: string,
  modelIn?: 'requestConfig' | 'providerMetadata',
): ChatNodeLike {
  return {
    key,
    kind: 'assistant-step',
    location: { kind: 'step', turn: { turn }, step: { turn, step } },
    data: {
      turn,
      step,
      time,
      usage: { inputTokens: input, outputTokens: output },
      blocks: say === undefined ? [] : [{ kind: 'text', text: say }],
      finalNode: {
        timing: { stepStartTime: time - 1000, completedTime: time },
        ...(model === undefined
          ? {}
          : modelIn === 'providerMetadata'
            ? { providerMetadata: { provider: 'deepseek-official', model } }
            : { requestConfig: { provider: 'deepseek-official', model } }),
      },
    },
  }
}

function tool(key: string, turn: number, step: number, name: string, time: number, failed = false): ChatNodeLike {
  return {
    key,
    kind: 'tool-call',
    location: { kind: 'step', turn: { turn }, step: { turn, step } },
    data: {
      root: {
        kind: 'tool-result',
        time,
        callTime: time - 500,
        call: { name, argsRaw: '{\"cmd\":\"git status\"}' },
        content: [{ type: 'text', text: 'On branch main\nmodified: src/a.ts' }],
        isError: failed,
        error: failed ? { name: 'BashError', code: 'exit-1' } : undefined,
      },
    },
  }
}

function prompt(key: string, turn: number, time: number, text: string): ChatNodeLike {
  return { key, kind: 'user', location: { kind: 'turn', turn: { turn } }, data: { time, content: [{ type: 'text', text }] } }
}

function chat(nodes: ChatNodeLike[]): ChatSnapshotLike {
  const byKey = new Map(nodes.map((node) => [node.key, node]))
  return { order: nodes.map((node) => node.key), nodes: { get: (key) => byKey.get(key) } }
}

console.log('turn and step rollups')
{
  const nodes = [
    prompt('u0', 0, T0, 'first question'),
    assistant('a0-0', 0, 0, T0 + 2000, 1_000_000, 0, 'deepseek-v4-flash', '先看一下仓库状态'),
    tool('t0-0', 0, 0, 'bash', T0 + 3000),
    assistant('a0-1', 0, 1, T0 + 5000, 0, 1_000_000, 'deepseek-v4-flash'),
    assistant('a1-0', 1, 0, T0 + 12_000, 1000, 500, 'deepseek-v4-pro'),
  ]
  const fold = foldChat(chat(nodes))

  check('two turns rolled up', fold.turns.length === 2, String(fold.turns.length))
  const shifted = foldChat(chat([assistant('a', 7, 0, T0 + 1000, 10, 10, 'deepseek-v4-flash')]))
  check('a window starting late keeps the session turn number', shifted.turns[0]!.index === 8, String(shifted.turns[0]!.index))
  check('turn numbers follow the session, not the window', fold.turns[0]!.index === 1 && fold.turns[1]!.index === 2)
  check('turn 1 has two steps', fold.turns[0]!.steps.length === 2, String(fold.turns[0]!.steps.length))
  check(
    'step indexes are 1-based with in-turn totals',
    fold.turns[0]!.steps.map((s) => `${s.index}/${s.total}`).join(',') === '1/2,2/2',
    fold.turns[0]!.steps.map((s) => `${s.index}/${s.total}`).join(','),
  )
  check('flash step cost = $0.15 (1M input, off-peak)', Math.abs(fold.turns[0]!.steps[0]!.cost - 0.15) < 1e-9, String(fold.turns[0]!.steps[0]!.cost))
  check('flash step cost = $0.60 (1M output, off-peak)', Math.abs(fold.turns[0]!.steps[1]!.cost - 0.6) < 1e-9, String(fold.turns[0]!.steps[1]!.cost))
  check('turn 1 cost = $0.75', Math.abs(fold.turns[0]!.cost - 0.75) < 1e-9, String(fold.turns[0]!.cost))
  check(
    'turn cost equals the sum of its steps',
    Math.abs(fold.turns[0]!.cost - fold.turns[0]!.steps.reduce((sum, step) => sum + step.cost, 0)) < 1e-9,
  )
  check('turn 1 counts 2 LLM and 1 tool', fold.turns[0]!.llmCalls === 2 && fold.turns[0]!.toolCalls === 1)
  check('tool sits in step 0', fold.rows.find((row) => row.kind === 'tool')!.step === 0)
  check('tool duration = result - call', fold.rows.find((row) => row.kind === 'tool')!.duration === 500)
  check('tool row keeps its arguments', fold.rows.find((row) => row.kind === 'tool')!.args?.includes('git status') === true)
  check('tool row carries the result text', fold.rows.find((row) => row.kind === 'tool')!.result?.includes('On branch main') === true)
  check('prompt row is turn-scoped', fold.rows.find((row) => row.kind === 'user')!.step === null)
  check('assistant text is captured', fold.rows.find((row) => row.kind === 'llm')!.say === '先看一下仓库状态')
  check('every model id came from the snapshot', fold.detected === 3 && fold.inferred === 0, `detected=${fold.detected}`)
}

console.log('per-step model pricing')
{
  const flash = foldChat(chat([assistant('a', 0, 0, T0 + 1000, 1_000_000, 0, 'deepseek-v4-flash')]))
  check('a recorded flash step costs the flash rate', Math.abs(flash.turns[0]!.cost - 0.15) < 1e-9, String(flash.turns[0]!.cost))
  const pro = foldChat(chat([assistant('a', 0, 0, T_PEAK + 1000, 1_000_000, 0, 'deepseek-v4-pro')]))
  check('a recorded pro step costs the pro rate at peak', Math.abs(pro.turns[0]!.cost - 1.32) < 1e-9, String(pro.turns[0]!.cost))

  // A step that lost its model id inherits the nearest recorded model.
  const inherited = foldChat(
    chat([
      assistant('a0', 0, 0, T0 + 1000, 1_000_000, 0, 'deepseek-v4-pro'),
      assistant('a1', 0, 1, T0 + 2000, 1_000_000, 0),
    ]),
  )
  check('a missing model inherits the neighbour', Math.abs(inherited.turns[0]!.cost - 1.32) < 1e-9, String(inherited.turns[0]!.cost))
  check('inheritance is counted', inherited.inferred === 1 && inherited.detected === 1)

  // With no recorded model anywhere, the session selection prices it and says so.
  const viaSession = foldChat(chat([assistant('a', 0, 0, T_PEAK + 1000, 1_000_000, 0)]), 'deepseek-v4-pro')
  check('the session selection prices an unrecorded step', Math.abs(viaSession.turns[0]!.cost - 1.32) < 1e-9, String(viaSession.turns[0]!.cost))
  check('that source is reported as the session', viaSession.rows[0]!.modelSource === 'session')

  // With nothing at all, the step stays unpriced rather than guessed.
  const unknown = foldChat(chat([assistant('a', 0, 0, T_PEAK + 1000, 1_000_000, 0)]))
  check('no model anywhere leaves the step unpriced', unknown.turns[0]!.cost === 0 && unknown.unpriced === 1)
  check('tierForModel reads the family', tierForModel('deepseek-v4-pro') === 'pro' && tierForModel('deepseek-v4-flash') === 'flash')
  check('tierForModel rejects unknown providers', tierForModel('gpt-4o') === null && tierForModel(undefined) === null)
}

console.log('tools, failures, and running steps')
{
  const nodes: ChatNodeLike[] = [
    prompt('u0', 0, T0, 'go'),
    assistant('a0', 0, 0, T0 + 1000, 10, 10, 'deepseek-v4-flash'),
    tool('t0', 0, 0, 'bash', T0 + 2000, true),
    {
      key: 't1',
      kind: 'tool-call',
      location: { kind: 'step', turn: { turn: 0 }, step: { turn: 0, step: 0 } },
      data: { root: { callId: 'c9', name: 'read', turn: 0, step: 0, time: T0 + 2500 } },
    },
  ]
  const fold = foldChat(chat(nodes))
  check('failed tool is flagged', fold.rows.some((row) => row.kind === 'tool' && row.status === 'failed'))
  check('failed tool carries its code', fold.rows.find((row) => row.status === 'failed')!.error === 'exit-1')
  check('running tool comes from the tool-call node', fold.rows.some((row) => row.status === 'running' && row.name === 'read'))
  const running = foldChat(chat([assistant('a', 0, 0, T0 + 1000, 1, 1, 'deepseek-v4-flash')]))
  check('settled assistant leaves the turn not running', running.turns[0]!.running === false)
}

console.log('duration fallback')
{
  const nodes: ChatNodeLike[] = [
    assistant('a', 0, 0, T0 + 3000, 10, 10, 'deepseek-v4-flash'),
    {
      key: 't',
      kind: 'tool-call',
      location: { kind: 'step', turn: { turn: 0 }, step: { turn: 0, step: 0 } },
      data: { root: { kind: 'tool-result', time: T0 + 9000, callTime: null, call: { name: 'bash', argsRaw: '{}' }, isError: false } },
    },
  ]
  const fold = foldChat(chat(nodes))
  const tool = fold.rows.find((row) => row.kind === 'tool')!
  check('missing callTime falls back to the previous event', tool.duration === 6000 && tool.approx === true, `${tool.duration}`)
}

console.log('model detection sources')
{
  const viaConfig = foldChat(chat([assistant('a', 0, 0, T_PEAK + 1000, 1_000_000, 0, 'deepseek-v4-pro')]))
  check('requestConfig.model prices the step', viaConfig.detected === 1 && viaConfig.inferred === 0)
  check('a detected pro step is not priced as flash', Math.abs(viaConfig.turns[0]!.cost - 1.32) < 1e-9, String(viaConfig.turns[0]!.cost))
  const viaMetadata = foldChat(
    chat([assistant('a', 0, 0, T0 + 1000, 1_000_000, 0, 'deepseek-v4-pro', undefined, 'providerMetadata')]),
  )
  check('providerMetadata.model is used too', viaMetadata.detected === 1 && viaMetadata.inferred === 0)
  const both = foldChat(
    chat([
      {
        key: 'a',
        kind: 'assistant-step',
        location: { kind: 'step', turn: { turn: 0 }, step: { turn: 0, step: 0 } },
        data: {
          turn: 0,
          step: 0,
          time: T0 + 1000,
          usage: { inputTokens: 10, outputTokens: 10 },
          finalNode: {
            timing: { stepStartTime: T0, completedTime: T0 + 1000 },
            requestConfig: { model: 'deepseek-v4-flash' },
            providerMetadata: { model: 'deepseek-v4.1-flash' },
          },
        },
      },
    ]),
  )
  const row = both.rows.find((candidate) => candidate.kind === 'llm')!
  check('requested and reported models are both kept when they differ', row.model === 'deepseek-v4-flash' && row.modelAlt === 'deepseek-v4.1-flash')
  check('the requested model prices the call', both.rows[0]!.modelSource === 'request')
}

console.log('peak and off-peak pricing')
{
  check('weekday 02:00 UTC is peak', isPeak(T_PEAK) === true)
  check('weekday 00:00 UTC is off-peak', isPeak(T0) === false)
  check('weekend is never peak', isPeak(Date.UTC(1970, 0, 3, 2, 0, 0)) === false)
  const peak = estimateCost('flash', { input: 1_000_000 }, T_PEAK)
  const offPeak = estimateCost('flash', { input: 1_000_000 }, T0)
  check('peak input price is $0.30', Math.abs(peak - 0.3) < 1e-9, String(peak))
  check('off-peak halves it to $0.15', Math.abs(offPeak - 0.15) < 1e-9, String(offPeak))
  check('pro costs more than flash', estimateCost('pro', { input: 1_000_000 }, T_PEAK) > peak)
  check('cache reads are almost free', estimateCost('flash', { cacheRead: 1_000_000 }, T_PEAK) < 0.01)
}

console.log('empty session')
{
  const fold = foldChat(chat([]))
  check('no nodes yields no turns', fold.turns.length === 0 && fold.rows.length === 0)
  check('empty result explains itself', typeof fold.note === 'string' && fold.note.includes('order=0'))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
