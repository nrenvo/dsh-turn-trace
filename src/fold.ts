/**
 * dsh-turn-trace — the fold.
 *
 * Pure: takes the `chat` view target snapshot the browser already holds and
 * returns rows plus per-step and per-turn money. No RPC, no session log
 * parsing, no polling — the view re-folds whenever the snapshot changes.
 */
import type {
  AssistantDataLike,
  ChatNodeLike,
  ChatSnapshotLike,
  NodeLocation,
  RunningToolLike,
  ToolDataLike,
  ToolResultLike,
  UserDataLike,
} from './contract.ts'
import { cacheSavings, estimateCost, roundCost, tierForModel } from './pricing.ts'

export type CallKind = 'llm' | 'tool' | 'user' | 'output'
export type CallStatus = 'ok' | 'failed' | 'running'

/** One line inside a step. */
export interface CallRow {
  key: string
  kind: CallKind
  time: number
  turn: number | null
  step: number | null
  name?: string
  /** Tool call id, when the snapshot carries one. */
  callId?: string
  /** Duration is derived from the neighbouring row, not from recorded timing. */
  approx?: boolean
  /** Provider model id when the snapshot carries one, else the pricing tier label. */
  model?: string
  duration?: number | null
  status?: CallStatus
  error?: string | null
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  /** Estimated USD; absent for tools and prompts. */
  cost?: number
  /** USD this call saved by hitting the cache instead of the input rate. */
  cacheSaved?: number
  /** True when this step's model id was missing and a neighbour supplied it. */
  modelInferred?: boolean
  /** Where the model id came from: the call's own records, a neighbour, or nowhere. */
  modelSource?: 'request' | 'provider' | 'inherited' | 'session' | 'running' | 'none'
  /** The provider-reported model when it differs from the requested one. */
  modelAlt?: string
  text?: string
  /** Raw tool arguments, when the call carried them. */
  args?: string
  /** Tool result text, truncated for display. */
  result?: string
  /** Assistant text for this step, truncated for display. */
  say?: string
  /** Assistant reasoning for this step, truncated for display. */
  thinking?: string
}

/** Token and money totals shared by step and turn rollups. */
export interface TokenTotals {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
  /** USD saved by cache hits, summed over the same calls. */
  cacheSaved: number
}

/** One step: the model call plus the tools it dispatched. */
export interface StepRollup extends TokenTotals {
  step: number
  index: number
  total: number
  startTime: number
  endTime: number
  duration: number
  llmCalls: number
  toolCalls: number
  /** Model id seen in this step, when the snapshot carried one. */
  model?: string
}

/** One turn: the prompt plus every step the agent ran for it. */
export interface TurnRollup extends TokenTotals {
  turn: number
  index: number
  startTime: number
  endTime: number
  duration: number
  steps: StepRollup[]
  llmCalls: number
  toolCalls: number
  failedTools: number
  running: boolean
}

/** Everything the view renders, computed in one pass. */
export interface FoldResult {
  turns: TurnRollup[]
  rows: CallRow[]
  /** Priced model calls whose model id came from the snapshot. */
  detected: number
  /** Calls priced with a model inferred from a neighbouring step. */
  inferred: number
  /** Calls left unpriced because the session recorded no model at all. */
  unpriced: number
  /** Short explanation for an empty result, rendered by the view's diagnostic. */
  note?: string
}

const EMPTY_TOTALS: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, cacheSaved: 0 }

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

/** Join the text (or reasoning) blocks of one assistant step. */
function blocksText(blocks: unknown, kind: 'text' | 'reasoning', cap: number): string {
  if (!Array.isArray(blocks)) return ''
  const parts: string[] = []
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    const record = block as { kind?: string; text?: unknown }
    if (record.kind === kind && typeof record.text === 'string') parts.push(record.text)
  }
  const text = parts.join('\n').trim()
  return text.length > cap ? `${text.slice(0, cap)}…` : text
}

function promptText(data: UserDataLike): string {
  if (!Array.isArray(data.content)) return ''
  const parts: string[] = []
  for (const block of data.content) {
    if (block !== null && typeof block === 'object' && typeof block.text === 'string') parts.push(block.text)
  }
  return truncate(parts.join('\n'), 240)
}

function locationOf(node: ChatNodeLike): { turn: number | null; step: number | null } {
  const location = node.location as NodeLocation | undefined
  if (location === undefined || location === null) return { turn: null, step: null }
  if (location.kind === 'step') return { turn: location.step.turn, step: location.step.step }
  if (location.kind === 'turn') return { turn: location.turn.turn, step: null }
  return { turn: null, step: null }
}

function addTotals(target: TokenTotals, row: CallRow): void {
  target.input += row.input ?? 0
  target.output += row.output ?? 0
  target.cacheRead += row.cacheRead ?? 0
  target.cacheWrite += row.cacheWrite ?? 0
  target.cost += row.cost ?? 0
  target.cacheSaved += row.cacheSaved ?? 0
}

function isToolResult(root: ToolResultLike | RunningToolLike): root is ToolResultLike {
  return (root as { kind?: string }).kind === 'tool-result'
}

/** Flatten a result's content blocks into a bounded preview string. */
export function resultText(content: readonly unknown[] | undefined, cap = 2000): string {
  const parts: string[] = []
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      parts.push(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (value !== null && typeof value === 'object') {
      const record = value as { text?: unknown; content?: unknown }
      if (typeof record.text === 'string') parts.push(record.text)
      if (record.content !== undefined) walk(record.content)
    }
  }
  walk(content)
  const text = parts.join('\n').trim()
  return text.length > cap ? `${text.slice(0, cap)}…` : text
}

function toolRowFrom(
  root: ToolResultLike | RunningToolLike,
  key: string,
  fallback: { turn: number | null; step: number | null },
): CallRow {
  if (isToolResult(root)) {
    const name = root.name ?? root.call?.name ?? 'tool'
    const duration = root.callTime === null || root.callTime === undefined ? null : Math.max(0, root.time - root.callTime)
    return {
      key,
      kind: 'tool',
      time: root.time,
      turn: fallback.turn,
      step: fallback.step,
      name,
      callId: root.callId,
      duration,
      status: root.isError ? 'failed' : 'ok',
      error: root.error?.code ?? root.error?.reason ?? null,
      args: root.call?.argsRaw ?? undefined,
      result: resultText(root.content),
    }
  }
  return {
    key,
    kind: 'tool',
    time: root.time,
    turn: fallback.turn,
    step: fallback.step,
    name: root.name,
    callId: root.callId,
    duration: null,
    status: 'running',
    error: null,
    args: root.argsRaw,
  }
}

/** One-line description of a chat snapshot, used by the view's self-diagnostic. */
export function describeChat(chat: ChatSnapshotLike | null | undefined): string {
  if (chat === null || chat === undefined) return 'chat: undefined'
  const order = Array.isArray(chat.order) ? chat.order : []
  const kinds = new Map<string, number>()
  let nodes = 0
  for (const key of order) {
    const node = chat.nodes?.get?.(key)
    if (node === undefined || node === null) continue
    nodes += 1
    kinds.set(node.kind, (kinds.get(node.kind) ?? 0) + 1)
  }
  const summary = [...kinds.entries()].map(([kind, count]) => `${kind}×${count}`).join(', ') || 'none'
  return `order=${order.length} nodes=${nodes} kinds=[${summary}]`
}

/**
 * Fold the chat target into turns, steps, and rows.
 * @param chat - chat snapshot slice from `useChat` (or the conversation view store).
 * @param fallbackTier - pricing family for steps whose model id is missing.
 * @returns rollups plus the flat row list, ready to render.
 */
export function foldChat(
  chat: ChatSnapshotLike,
  /**
   * The session's current model selection. The chat target never carries a
   * model per step, so this is the honest fallback when a step has no recorded
   * id of its own.
   */
  sessionModel?: string,
): FoldResult {
  const order = Array.isArray(chat?.order) ? chat.order : []
  const rows: CallRow[] = []
  let detected = 0
  let sawRunningAssistant = false

  for (const key of order) {
    const node = chat.nodes?.get?.(key)
    if (node === undefined || node === null) continue
    const where = locationOf(node)

    if (node.kind === 'assistant-step') {
      const data = node.data as AssistantDataLike
      if (data === null || typeof data !== 'object') continue
      const final = data.finalNode
      const usage = data.usage ?? final?.usage
      const tokens = {
        input: usage?.inputTokens ?? 0,
        output: usage?.outputTokens ?? 0,
        cacheRead: usage?.cacheReadTokens ?? 0,
        cacheWrite: usage?.cacheWriteTokens ?? 0,
      }
      // The recorded model id lives in either the request config or the provider
      // metadata; both are per-call facts, not session settings.
      const requested = final?.requestConfig?.model
      const reported = final?.providerMetadata?.model ?? final?.provenance?.model
      const model = requested ?? reported
      const modelSource: 'request' | 'provider' | 'none' =
        requested !== undefined ? 'request' : reported !== undefined ? 'provider' : 'none'
      const modelAlt = requested !== undefined && reported !== undefined && requested !== reported ? reported : undefined
      if (tierForModel(model) !== null) detected += 1
      const started = final?.timing?.stepStartTime ?? null
      const ended = final?.timing?.completedTime ?? data.time
      if (data.status === 'running') sawRunningAssistant = true
      const say = blocksText((data as { blocks?: unknown }).blocks, 'text', 4000)
      const thinking = blocksText((data as { blocks?: unknown }).blocks, 'reasoning', 4000)
      rows.push({
        key,
        kind: 'llm',
        say: say === '' ? undefined : say,
        // A running step has no settled message yet, so no model was recorded.
        ...(modelSource === 'none' && data.status === 'running' ? { modelSource: 'running' as const } : {}),
        thinking: thinking === '' ? undefined : thinking,
        time: ended,
        turn: data.turn ?? where.turn,
        step: data.step ?? where.step,
        model,
        modelAlt,
        modelSource,
        duration: started === null ? null : Math.max(0, ended - started),
        status: 'ok',
        ...tokens,
      })
      continue
    }

    if (node.kind === 'tool-call') {
      const data = node.data as ToolDataLike
      if (data?.root === undefined) continue
      rows.push(toolRowFrom(data.root, key, where))
      continue
    }

    if (node.kind === 'user') {
      const data = node.data as UserDataLike
      rows.push({
        key,
        kind: 'user',
        time: typeof data?.time === 'number' ? data.time : 0,
        turn: where.turn,
        step: null,
        text: data === undefined ? '' : promptText(data),
        status: 'ok',
      })
    }
  }

  rows.sort((left, right) => left.time - right.time)

  // Resolve a model for every priced call. Sessions almost always run one
  // model, and the recorded steps say which; a step that lost its id inherits
  // the nearest earlier model, then the session's most frequent one.
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.kind === 'llm' && row.model !== undefined && tierForModel(row.model) !== null) {
      counts.set(row.model, (counts.get(row.model) ?? 0) + 1)
    }
  }
  const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
  let carried: string | undefined
  let inferred = 0
  let unpriced = 0
  for (const row of rows) {
    if (row.kind !== 'llm') continue
    if (row.model !== undefined && tierForModel(row.model) !== null) {
      carried = row.model
    } else {
      const inherited = carried ?? dominant ?? (sessionModel !== undefined && tierForModel(sessionModel) !== null ? sessionModel : undefined)
      if (inherited === undefined) {
        // Keep `running` so the inspector can say why it is blank.
        if (row.modelSource !== 'running') row.modelSource = 'none'
        unpriced += 1
        continue
      }
      row.model = inherited
      // A session-level model is a weaker claim than a neighbour's recorded id.
      if (carried === undefined && dominant === undefined) row.modelSource = 'session'
      else {
        row.modelInferred = true
        row.modelSource = 'inherited'
      }
      inferred += 1
    }
    const tier = tierForModel(row.model)
    if (tier === null) {
      unpriced += 1
      row.model = undefined
      continue
    }
    row.cost = estimateCost(tier, row, row.time)
    row.cacheSaved = cacheSavings(tier, row, row.time)
  }

  // Recorded timings can be missing (a call whose `tool/call` left the loaded
  // window, an unfinished assistant step). Approximate those from the previous
  // row in the same step so the column is never blank.
  const lastTime = new Map<string, number>()
  for (const row of rows) {
    const slot = `${row.turn ?? 'x'}:${row.step ?? 'x'}`
    if (row.duration == null) {
      const previous = lastTime.get(slot)
      if (previous !== undefined && row.time > previous) {
        row.duration = row.time - previous
        row.approx = true
      }
    }
    lastTime.set(slot, row.time)
  }

  const turnNumbers = new Set<number>()
  for (const row of rows) if (row.turn !== null) turnNumbers.add(row.turn)
  const orderedTurns = [...turnNumbers].sort((a, b) => a - b)

  const turns: TurnRollup[] = orderedTurns.map((turn, turnIndex) => {
    const turnRows = rows.filter((row) => row.turn === turn)
    const timed = turnRows.filter((row) => row.time > 0)
    const startTime = timed.reduce((min, row) => Math.min(min, row.time), Number.POSITIVE_INFINITY)
    const endTime = timed.reduce((max, row) => Math.max(max, row.time), 0)

    const stepNumbers = [...new Set(turnRows.filter((row) => row.step !== null).map((row) => row.step as number))].sort((a, b) => a - b)
    const totals: TokenTotals = { ...EMPTY_TOTALS }
    let llmCalls = 0
    let toolCalls = 0
    let failedTools = 0

    const steps: StepRollup[] = stepNumbers.map((step, stepIndex) => {
      const stepRows = turnRows.filter((row) => row.step === step)
      const stepTotals: TokenTotals = { ...EMPTY_TOTALS }
      let stepLlm = 0
      let stepTools = 0
      let stepModel: string | undefined
      for (const row of stepRows) {
        if (row.kind === 'llm') {
          stepLlm += 1
          llmCalls += 1
          addTotals(stepTotals, row)
          addTotals(totals, row)
          stepModel ??= row.model
        } else if (row.kind === 'tool') {
          stepTools += 1
          toolCalls += 1
          if (row.status === 'failed') failedTools += 1
        }
      }
      const stepStart = stepRows.reduce((min, row) => Math.min(min, row.time), Number.POSITIVE_INFINITY)
      const stepEnd = stepRows.reduce((max, row) => Math.max(max, row.time), 0)
      return {
        step,
        index: stepIndex + 1,
        total: stepNumbers.length,
        startTime: Number.isFinite(stepStart) ? stepStart : 0,
        endTime: stepEnd,
        duration: Math.max(0, stepEnd - (Number.isFinite(stepStart) ? stepStart : stepEnd)),
        llmCalls: stepLlm,
        toolCalls: stepTools,
        input: stepTotals.input,
        output: stepTotals.output,
        cacheRead: stepTotals.cacheRead,
        cacheWrite: stepTotals.cacheWrite,
        cost: roundCost(stepTotals.cost),
        cacheSaved: roundCost(stepTotals.cacheSaved),
        model: stepModel,
      }
    })

    return {
      turn,
      // Event turn numbers are 0-based; display the session's own numbering so a
      // window that starts mid-session does not renumber turns as 1..n.
      index: (typeof turn === 'number' ? turn : turnIndex) + 1,
      startTime: Number.isFinite(startTime) ? startTime : 0,
      endTime,
      duration: Math.max(0, endTime - (Number.isFinite(startTime) ? startTime : endTime)),
      steps,
      llmCalls,
      toolCalls,
      failedTools,
      running: false,
      input: totals.input,
      output: totals.output,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      cost: roundCost(totals.cost),
      cacheSaved: roundCost(totals.cacheSaved),
    }
  })

  if (sawRunningAssistant && turns.length > 0) turns[turns.length - 1]!.running = true

  const result: FoldResult = { turns, rows, detected, inferred, unpriced }
  if (turns.length === 0) result.note = describeChat(chat)
  return result
}
