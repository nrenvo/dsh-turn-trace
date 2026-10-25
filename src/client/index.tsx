/**
 * dsh-turn-trace — client view.
 *
 * A client-only `conversation.view` entry: it reads the `chat` view target the
 * shell already materialises (`useChat`, or `conversation.views.get('chat')`),
 * folds it into turns and steps, and prices each step. No host half, no RPC,
 * no polling.
 *
 * Layout mirrors the shipped Trajectory tab: a scrolling ledger on the left and
 * a detail inspector on the right. Clicking any row (prompt, model call, tool
 * call) selects it; the inspector shows overview, arguments, result text, and
 * provenance.
 */
import type { Context } from '@deepseek-ai/cordis'
import * as React from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChatSnapshotLike, ConversationViewPropsLike, ModelDirectoriesLike } from '../contract.ts'
import { describeChat, foldChat, type CallRow, type StepRollup, type TurnRollup } from '../fold.ts'
import { fallbackTranslate, EN, NS, ZH } from '../locale.ts'
import { TRACE_CSS } from './styles.ts'

type Currency = 'USD' | 'CNY'
type Translate = (key: string, params?: Record<string, string | number>) => string

/** Bumped by hand so a stale bundle is obvious in the UI. */
const BUILD_MARKER = '1.4.8'

const FX_KEY = 'dsh-turn-trace:fx'
const CUR_KEY = 'dsh-turn-trace:currency'
const DEFAULT_FX = 7.2

function readString(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode / storage disabled: the preference simply does not persist.
  }
}

function readCurrency(): Currency {
  return readString(CUR_KEY, 'USD') === 'CNY' ? 'CNY' : 'USD'
}

function readFx(): number {
  const value = Number(readString(FX_KEY, String(DEFAULT_FX)))
  return Number.isFinite(value) && value > 0 && value < 1000 ? value : DEFAULT_FX
}

function fmtTime(ms: number | null | undefined): string {
  if (ms == null) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function fmtDuration(ms: number | null | undefined, approx = false): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const value = ((): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60_000)
    const seconds = Math.floor((ms % 60_000) / 1000)
    return `${minutes}m ${seconds}s`
  })()
  return approx ? `~${value}` : value
}

function fmtTokens(n: number | undefined | null): string {
  if (n == null || n === 0) return '0'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

/** USD → display currency. */
function money(usd: number | null | undefined, currency: Currency, fx: number): string {
  if (usd == null) return '—'
  const value = currency === 'CNY' ? usd * fx : usd
  const symbol = currency === 'CNY' ? '¥' : '$'
  if (value === 0) return `${symbol}0`
  if (value < 0.01) return `${symbol}${value.toFixed(4)}`
  if (value < 1) return `${symbol}${value.toFixed(3)}`
  return `${symbol}${value.toFixed(2)}`
}

function stepTokens(step: StepRollup): string {
  return `${fmtTokens(step.input + step.cacheRead + step.cacheWrite)} in → ${fmtTokens(step.output)} out`
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

/** Parse a tool argument string when it is JSON. */
function parseArgs(args: string | undefined): unknown {
  if (args === undefined || args === '') return undefined
  try {
    return JSON.parse(args) as unknown
  } catch {
    return undefined
  }
}

/** Inspector form: pretty JSON when possible, raw text otherwise. */
function prettyArgs(args: string | undefined): string {
  if (args === undefined || args === '') return ''
  const parsed = parseArgs(args)
  if (parsed === undefined) return args
  try {
    return JSON.stringify(parsed, null, 2)
  } catch {
    return args
  }
}

/** Row form: the one field a human recognizes, else a short raw slice. */
function summarizeArgs(args: string | undefined): string {
  if (args === undefined || args === '') return ''
  const parsed = parseArgs(args)
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>
    for (const key of ['command', 'cmd', 'path', 'file_path', 'pattern', 'query', 'url', 'name', 'description']) {
      const value = record[key]
      if (typeof value === 'string' && value !== '') return `${key}: ${truncate(value, 80)}`
      if (Array.isArray(value)) return `${key}: ${truncate(value.join(' '), 80)}`
    }
  }
  return truncate(args, 80)
}

function cacheRate(totals: { cacheRead: number; input: number; cacheWrite: number }): number {
  const input = totals.input + totals.cacheRead + totals.cacheWrite
  return input === 0 ? 0 : Math.round((totals.cacheRead / input) * 100)
}

/**
 * Cache hits are the norm, so a hit is not worth a badge. A miss is: the same
 * tokens suddenly cost the input rate, which is how a bill spikes.
 * @param totals - step or turn totals.
 * @returns whether a meaningful share of input missed the cache.
 */
function cacheBreak(totals: { cacheRead: number; input: number; cacheWrite: number }): boolean {
  const input = totals.input + totals.cacheRead + totals.cacheWrite
  return input >= 1000 && cacheRate(totals) < 90
}

function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  } catch {
    return 'local'
  }
}

function fmtClock(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function isoTitle(ms: number | null | undefined): string {
  return ms == null ? '' : new Date(ms).toISOString()
}

function statusText(row: CallRow, t: Translate): string {
  if (row.status === 'failed') return `${t('statusFailed')}${row.error ? ` · ${row.error}` : ''}`
  if (row.status === 'running') return t('statusRunning')
  return row.status === 'ok' ? t('statusOk') : ''
}

/** Where a row sits, described with the same numbering the ledger shows. */
function describeLocation(row: CallRow, turns: readonly TurnRollup[]): string {
  const turn = turns.find((candidate) => candidate.turn === row.turn)
  if (turn === undefined) return 'turn —'
  const step = row.step === null ? undefined : turn.steps.find((candidate) => candidate.step === row.step)
  const parts = [`Turn ${turn.index}`]
  if (step !== undefined) parts.push(`Step ${step.index}/${step.total}`)
  return parts.join(' · ')
}

/** Catches a render failure and shows it instead of an empty panel. */
class TurnsBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[dsh-turn-trace] view failed', error)
  }

  render(): React.ReactNode {
    const error = this.state.error
    if (error !== null) {
      const t = fallbackTranslate(typeof navigator === 'undefined' ? 'en' : navigator.language)
      return (
        <pre className="dsh-trace__diag">{t('failed', { error: String(error.stack ?? error.message ?? error) })}</pre>
      )
    }
    return this.props.children
  }
}

const noopSubscribe = (): (() => void) => () => {}
const localTranslators = new Map<string, Translate>()

function localFor(active: string): Translate {
  const cached = localTranslators.get(active)
  if (cached !== undefined) return cached
  const created = fallbackTranslate(active)
  localTranslators.set(active, created)
  return created
}

function guessLanguage(): string {
  return typeof navigator === 'undefined' ? 'en' : navigator.language
}

/** Build a translator over one locale runtime instance (or the local dictionary). */
function makeTranslate(locale: LocaleLike | undefined): Translate {
  if (locale === undefined) return localFor(guessLanguage())
  let bound: Translate
  try {
    bound = locale.bind(NS)
  } catch {
    return localFor(guessLanguage())
  }
  const active = (): string => {
    try {
      return locale.getSnapshot().active
    } catch {
      return guessLanguage()
    }
  }
  return (key, params) => {
    try {
      const value = bound(key, params)
      if (value !== key) return value
    } catch {
      // fall through
    }
    return localFor(active())(key, params)
  }
}

/**
 * Translate through the host registry, falling back to the built-in dictionary
 * for the *currently active* locale — not the locale that happened to be active
 * when the plugin activated.
 */
function useTranslate(props: ConversationViewPropsLike): Translate {
  // Registering here covers a locale runtime that appeared after activation.
  props.ensureDictionaries?.()
  const locale = props.getLocale?.() ?? props.locale
  // Bound to the instance: the locale runtime's subscribe reads `this.listeners`,
  // so passing the bare method throws "Cannot read properties of undefined".
  const subscribe = React.useMemo(
    () => (locale === undefined ? noopSubscribe : (fn: () => void) => locale.subscribe(fn)),
    [locale],
  )
  const getRevision = React.useCallback(() => {
    try {
      return locale?.getSnapshot().revision ?? 0
    } catch {
      return 0
    }
  }, [locale])
  const revision = React.useSyncExternalStore(subscribe, getRevision)
  // The slot seat re-renders us with a new `t` on a language switch, so it is
  // the most reliable signal; our own binding and the built-in dictionary are
  // only fallbacks for a missing seat.
  const seat = props.t
  return useMemo(() => {
    const active = (() => {
      try {
        return locale?.getSnapshot().active ?? (typeof navigator === 'undefined' ? 'en' : navigator.language)
      } catch {
        return typeof navigator === 'undefined' ? 'en' : navigator.language
      }
    })()
    const local = localFor(active)
    const bound = locale?.bind(NS)
    const attempts = [seat, typeof seat === 'function' ? undefined : props.t, bound].filter(
      (fn): fn is Translate => typeof fn === 'function',
    )
    return (key, params) => {
      for (const fn of attempts) {
        try {
          const value = fn(key, params)
          if (value !== key) return value
        } catch {
          // try the next translator
        }
      }
      return local(key, params)
    }
    // revision is the locale change signal
  }, [locale, revision, seat, props.t])
}

/**
 * The session's current model selection, from the model-selection plugin's
 * per-session directory. Used only when a step records no model of its own.
 */
function useSessionModel(props: ConversationViewPropsLike): string | undefined {
  // Resolved on every render: the model-selection service is often registered
  // after this plugin, so capturing it once at apply() time yields undefined and
  // every step ends up unpriced. Cached by service identity, so a late
  // registration flips the memo from undefined to the live store.
  const directories = props.modelDirectories?.()
  const store = useMemo(() => {
    if (directories === undefined) return undefined
    try {
      return directories.directoryFor(String(props.sessionId))?.store
    } catch {
      return undefined
    }
  }, [directories, props.sessionId])

  const getSnapshot = React.useCallback(() => store?.getSnapshot()?.current?.model, [store])
  return React.useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot)
}

/** Prefer the chat plugin's own target hook; fall back to the standard view store. */
function useChatSnapshot(props: ConversationViewPropsLike): ChatSnapshotLike | null {
  if (typeof props.useChat === 'function') return props.useChat((snapshot) => snapshot) ?? null
  if (typeof props.useConversation === 'function') {
    const chat = props.useConversation((snapshot) => snapshot.views.get('chat'))
    return (chat as ChatSnapshotLike | undefined) ?? null
  }
  return null
}

/** One line per call; clicking it selects the row into the inspector. */
function callRow(props: {
  row: CallRow
  selected: boolean
  onSelect: (key: string) => void
  t: Translate
}): React.ReactElement {
  const { row, selected, onSelect, t } = props
  const select = (): void => onSelect(row.key)
  const className = `dsh-trace__call dsh-trace__call--${row.kind}${selected ? ' dsh-trace__call--selected' : ''}${
    row.status === 'failed' ? ' dsh-trace__call--err' : ''
  }`

  if (row.kind === 'user') {
    return (
      <button type="button" className={className} onClick={select} aria-pressed={selected}>
        <span className="dsh-trace__prompt-label">{t('userInput')}</span>
        <span className="dsh-trace__prompt-time" title={isoTitle(row.time)}>
          {fmtTime(row.time)}
        </span>
        <span className="dsh-trace__prompt-text" title={row.text}>
          {row.text === undefined || row.text === '' ? t('noText') : row.text}
        </span>
      </button>
    )
  }

  if (row.kind === 'output') {
    return (
      <button type="button" className={className} onClick={select} aria-pressed={selected}>
        <span className="dsh-trace__prompt-label dsh-trace__prompt-label--out">{t('modelOutput')}</span>
        <span className="dsh-trace__call-preview">{truncate((row.text ?? '').replace(/\s+/g, ' '), 110)}</span>
      </button>
    )
  }

  if (row.kind === 'tool') {
    return (
      <button type="button" className={className} onClick={select} aria-pressed={selected}>
        <span className="dsh-trace__call-name">{row.name ?? 'tool'}</span>
        <span className={`dsh-trace__call-status${row.status === 'failed' ? ' dsh-trace__call-status--err' : ''}`}>
          {statusText(row, t)}
        </span>
        <span className="dsh-trace__call-meta">{fmtDuration(row.duration, row.approx === true)}</span>
        {summarizeArgs(row.args) !== '' ? <span className="dsh-trace__call-preview">{summarizeArgs(row.args)}</span> : null}
      </button>
    )
  }

  return (
    <button type="button" className={className} onClick={select} aria-pressed={selected}>
      <span className="dsh-trace__call-name">{t('llm')}</span>
      <span className="dsh-trace__call-meta" title={t(`modelSource_${row.modelSource ?? 'none'}`)}>
        {row.model ?? t('modelPending')}
        {row.modelSource === 'inherited' ? ' ~' : ''}
      </span>
      <span className="dsh-trace__call-meta">{fmtDuration(row.duration)}</span>
      {row.say !== undefined && row.say !== '' ? (
        <span className="dsh-trace__call-preview">{truncate(row.say.replace(/\s+/g, ' '), 90)}</span>
      ) : null}
    </button>
  )
}

/** Right-hand inspector: overview, arguments, result, provenance. */
function Inspector(props: {
  row: CallRow | null
  turns: readonly TurnRollup[]
  sessionId: string
  currency: Currency
  fx: number
  t: Translate
  onClose: () => void
}): React.ReactElement | null {
  const { row, turns, sessionId, currency, fx, t, onClose } = props
  if (row === null) return null
  const tokens = (row.input ?? 0) + (row.cacheRead ?? 0) + (row.cacheWrite ?? 0)
  const anchor = turns.find((turn) => turn.turn === row.turn)?.startTime ?? null
  return (
    <aside className="dsh-trace__inspector">
      <div className="dsh-trace__insp-head">
        <span className={`dsh-trace__badge dsh-trace__badge--${row.kind}`}>{row.kind}</span>
        <span className="dsh-trace__insp-title">{row.name ?? row.model ?? 'detail'}</span>
        <button type="button" className="dsh-trace__btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <section className="dsh-trace__insp-section">
        <h4 className="dsh-trace__insp-h">{t('overview')}</h4>
        <dl className="dsh-trace__insp-grid">
          <dt>{t('position')}</dt>
          <dd>{describeLocation(row, turns)}</dd>
          <dt>{t('eventTime')}</dt>
          <dd title={isoTitle(row.time)}>
            {fmtClock(row.time)} <span className="dsh-trace__insp-mono">{localZone()}</span>
            {anchor !== null ? <span className="dsh-trace__insp-mono"> · {t('fromTurnStart', { duration: fmtDuration(row.time - anchor) })}</span> : null}
          </dd>
          {/* Prompts and model output carry no measurable duration — omit the row
              rather than print an em dash for it. */}
          {row.duration != null ? (
            <>
              <dt>{t('duration')}</dt>
              <dd>
                {fmtDuration(row.duration, row.approx === true)}
                {row.approx === true ? <span className="dsh-trace__insp-mono"> ({t('durationApprox')})</span> : null}
              </dd>
            </>
          ) : null}
          {row.kind === 'llm' ? (
            <>
              <dt>{t('model')}</dt>
              <dd>
                {row.model ?? '—'}
                {row.modelAlt !== undefined ? <span className="dsh-trace__insp-mono"> → {row.modelAlt}</span> : null}{' '}
                <span className="dsh-trace__insp-mono">({t(`modelSource_${row.modelSource ?? 'none'}`)})</span>
              </dd>
              <dt>{t('tokens')}</dt>
              <dd>
                {t('tokensIn', { n: fmtTokens(tokens) })} · {t('tokensOut', { n: fmtTokens(row.output) })}
              </dd>
              <dt>{t('cost')}</dt>
              <dd>{money(row.cost, currency, fx)}</dd>
              {row.cacheRead !== undefined && row.cacheRead > 0 ? (
                <>
                  <dt>{t('cache')}</dt>
                  <dd>
                    {t('cacheHit', { tokens: fmtTokens(row.cacheRead) })} ·{' '}
                    {t('cacheSaved', { money: money(row.cacheSaved ?? 0, currency, fx) })}
                  </dd>
                </>
              ) : null}
            </>
          ) : null}
          {row.kind === 'tool' ? (
            <>
              <dt>{t('status')}</dt>
              <dd>{statusText(row, t)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {row.text !== undefined && row.text !== '' ? (
        <section className="dsh-trace__insp-section">
          <h4 className="dsh-trace__insp-h">{row.kind === 'user' ? t('userInput') : t('modelOutput')}</h4>
          <pre className={`dsh-trace__insp-pre${row.kind === 'user' ? '' : ' dsh-trace__insp-pre--out'}`}>{row.text}</pre>
        </section>
      ) : null}

      {row.say !== undefined && row.say !== '' ? (
        <section className="dsh-trace__insp-section">
          <h4 className="dsh-trace__insp-h">{t('modelOutput')}</h4>
          <pre className="dsh-trace__insp-pre dsh-trace__insp-pre--out">{row.say}</pre>
        </section>
      ) : null}

      {row.thinking !== undefined && row.thinking !== '' ? (
        <section className="dsh-trace__insp-section">
          <h4 className="dsh-trace__insp-h">{t('thinking')}</h4>
          <pre className="dsh-trace__insp-pre">{row.thinking}</pre>
        </section>
      ) : null}

      {row.args !== undefined && row.args !== '' ? (
        <section className="dsh-trace__insp-section">
          <h4 className="dsh-trace__insp-h">{t('args')}</h4>
          <pre className="dsh-trace__insp-pre">{prettyArgs(row.args)}</pre>
        </section>
      ) : null}

      {row.result !== undefined && row.result !== '' ? (
        <section className="dsh-trace__insp-section">
          <h4 className="dsh-trace__insp-h">{t('result')}</h4>
          <pre className="dsh-trace__insp-pre dsh-trace__insp-pre--out">{row.result}</pre>
        </section>
      ) : null}

      <section className="dsh-trace__insp-section">
        <h4 className="dsh-trace__insp-h">{t('source')}</h4>
        <dl className="dsh-trace__insp-grid">
          <dt>{t('session')}</dt>
          <dd className="dsh-trace__insp-mono">{sessionId}</dd>
          <dt>{t('node')}</dt>
          <dd className="dsh-trace__insp-mono">{row.key}</dd>
          {row.callId !== undefined ? (
            <>
              <dt>{t('callId')}</dt>
              <dd className="dsh-trace__insp-mono">{row.callId}</dd>
            </>
          ) : null}
        </dl>
      </section>
    </aside>
  )
}

/** One turn: collapsed row, then its steps when open. */
function TurnSection(props: {
  turn: TurnRollup
  rows: CallRow[]
  currency: Currency
  fx: number
  open: boolean
  selectedKey: string | null
  outputRow: CallRow | null
  t: Translate
  onToggle: () => void
  onSelect: (key: string) => void
}): React.ReactElement {
  const { turn, rows, currency, fx, open, selectedKey, outputRow, t, onToggle, onSelect } = props
  const topCost = turn.steps.reduce((max, step) => Math.max(max, step.cost), 0)
  const span = turn.endTime - turn.startTime
  const spanValid = turn.endTime > turn.startTime && span < 24 * 3600 * 1000
  const stepSum = turn.steps.reduce((sum, step) => sum + step.duration, 0)
  const durationLabel = spanValid
    ? t('took', { duration: fmtDuration(span) })
    : stepSum > 0
      ? `~${t('took', { duration: fmtDuration(stepSum) })}`
      : `${t('took', { duration: '—' })}`
  const stepRows = new Map<number, CallRow[]>()
  for (const row of rows) {
    if (row.kind !== 'llm' && row.kind !== 'tool') continue
    if (row.step === null) continue
    const list = stepRows.get(row.step) ?? []
    list.push(row)
    stepRows.set(row.step, list)
  }

  return (
    <div className="dsh-trace__turn">
      <button className="dsh-trace__turn-head" onClick={onToggle} aria-expanded={open}>
        <span className="dsh-trace__chev">{open ? '▾' : '▸'}</span>
        <span className="dsh-trace__turn-title">{t('turn', { n: turn.index })}</span>
        <span className="dsh-trace__turn-meta">{t('stepsCount', { n: turn.steps.length })}</span>
        <span
          className="dsh-trace__turn-meta"
          title={`${fmtClock(turn.startTime)} → ${fmtClock(turn.endTime)}`}
        >
          {durationLabel}
        </span>
        <span className="dsh-trace__turn-cost">
          {money(turn.cost, currency, fx)}
          {turn.cacheSaved > 0 ? (
            <span className="dsh-trace__turn-saved"> · {t('saved', { money: money(turn.cacheSaved, currency, fx) })}</span>
          ) : null}
        </span>
        {turn.running ? <span className="dsh-trace__live-dot" /> : null}
      </button>
      {open ? (
        <div className="dsh-trace__turn-body" style={TURN_BODY_STYLE}>
          {rows
            .filter((row) => row.kind === 'user')
            .map((row) => callRow({ row, selected: row.key === selectedKey, onSelect, t }))}
          {outputRow !== null
            ? callRow({ row: outputRow, selected: outputRow.key === selectedKey, onSelect, t })
            : null}
          {turn.steps.map((step) => (
            <div key={`${turn.turn}-${step.step}`} className="dsh-trace__step">
              <div className="dsh-trace__step-head">
                <span className="dsh-trace__step-badge">
                  {t('step', { index: step.index, total: step.total })}
                </span>
                {step.cost === topCost && topCost > 0 ? <span className="dsh-trace__step-top">{t('priciest')}</span> : null}
                <span className="dsh-trace__step-cost">{money(step.cost, currency, fx)}</span>
                {step.llmCalls > 0 ? <span className="dsh-trace__step-meta">{stepTokens(step)}</span> : null}
                {cacheBreak(step) ? (
                  <span
                    className="dsh-trace__step-warn"
                    title={t('cacheMissTitle', { tokens: fmtTokens(step.input) })}
                  >
                    {t('cacheMiss')}
                  </span>
                ) : null}
                {step.cacheSaved > 0 ? (
                  <span className="dsh-trace__step-meta">{t('perStepSaved', { money: money(step.cacheSaved, currency, fx) })}</span>
                ) : null}
              </div>
              {(stepRows.get(step.step) ?? []).map((row) => callRow({ row, selected: row.key === selectedKey, onSelect, t }))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The registered `conversation.view` entry. */
/** Critical layout, inline: a cached or blocked stylesheet must not break scrolling. */
const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 0,
  overflow: 'hidden',
}
const BODY_STYLE: React.CSSProperties = { display: 'flex', gap: 10, flex: '1 1 auto', minHeight: 0 }
const LIST_STYLE: React.CSSProperties = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: 4, paddingBottom: 24 }
/** One scroll container only: the ledger. A turn body just grows. */
const TURN_BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

export function TurnsView(props: ConversationViewPropsLike): React.ReactElement {
  return (
    <TurnsBoundary>
      <TurnsBody props={props} />
    </TurnsBoundary>
  )
}

function TurnsBody({ props }: { props: ConversationViewPropsLike }): React.ReactElement {
  const chat = useChatSnapshot(props)
  const t = useTranslate(props)
  const [currency, setCurrency] = useState<Currency>(readCurrency)
  const [fx] = useState<number>(readFx)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [pageState, setPageState] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // The shell sits between us and the window and swallows wheel events
  // (dragging our scrollbar still works, the wheel does not). Watch wheel in the
  // capture phase so no ancestor can hide it from us, then scroll by hand when
  // the default action did not move the list.
  React.useEffect(() => {
    const list = listRef.current
    const element = rootRef.current
    if (list === null || element === null) return
    const onWheel = (event: WheelEvent): void => {
      const target = event.target
      // The whole panel is a wheel surface for the ledger: the pointer may sit
      // on the header or the empty area beside a row.
      if (!(target instanceof Node) || !element.contains(target)) return
      if (Math.abs(event.deltaY) < 1) return
      const before = list.scrollTop
      window.requestAnimationFrame(() => {
        if (list.scrollTop !== before) return
        const max = list.scrollHeight - list.clientHeight
        if (max <= 0) return
        const next = before + event.deltaY
        if (next < 0 || next > max) return // let the shell scroll at the edges
        list.scrollTop = next
      })
    }
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  const PAGE_SIZE = 10
  const historyWindow =
    typeof props.useSession === 'function'
      ? props.useSession((snapshot) => ({ hasMore: snapshot.hasMore, loadingOlder: snapshot.loadingOlder }))
      : { hasMore: false, loadingOlder: false }
  const sessionModel = useSessionModel(props)
  const fold = useMemo(() => (chat === null ? null : foldChat(chat, sessionModel)), [chat, sessionModel])

  if (fold === null) {
    return (
      <pre className="dsh-trace__diag">
        {t('missingChat')}{'\n'}
        {t('missingChatHint', { useChat: typeof props.useChat, useConversation: typeof props.useConversation })}
        {'\n'}props=[{Object.keys(props).join(', ')}]
        {'\n'}build={BUILD_MARKER}
      </pre>
    )
  }

  const newestFirst = [...fold.turns].reverse()
  const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE))
  const page = Math.min(pageState, pageCount - 1)
  const pageTurns = newestFirst.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const total = fold.turns.reduce((sum, turn) => sum + turn.cost, 0)
  const totalSaved = fold.turns.reduce((sum, turn) => sum + turn.cacheSaved, 0)
  const rowsByTurn = new Map<number, CallRow[]>()
  for (const row of fold.rows) {
    if (row.turn === null) continue
    const list = rowsByTurn.get(row.turn) ?? []
    list.push(row)
    rowsByTurn.set(row.turn, list)
  }
  const outputRows = fold.turns
    .map((turn) => {
      const says = fold.rows.filter((row) => row.turn === turn.turn && row.kind === 'llm' && (row.say ?? '') !== '')
      if (says.length === 0) return null
      const time = says.reduce((max, row) => Math.max(max, row.time), 0)
      const row: CallRow = {
        key: `out:${turn.turn}`,
        kind: 'output',
        time,
        turn: turn.turn,
        step: null,
        text: says.map((row) => row.say ?? '').join('\n\n'),
        status: 'ok',
      }
      return row
    })
    .filter((row): row is CallRow => row !== null)
  const outputsByTurn = new Map(outputRows.map((row) => [row.turn, row]))
  const selectedRow =
    selectedKey === null
      ? null
      : (fold.rows.find((row) => row.key === selectedKey) ?? outputRows.find((row) => row.key === selectedKey) ?? null)

  const goto = (target: number): void => {
    if (target < 0) return
    const move = (next: number): void => {
      setPageState(next)
      if (listRef.current !== null) listRef.current.scrollTop = 0
    }
    if (target < pageCount) {
      move(target)
      return
    }
    // Beyond the loaded window: pull one more page of history, then move.
    void props.loadOlder?.().then(() => move(target))
  }

  const toggleCurrency = (): void => {
    const next: Currency = currency === 'USD' ? 'CNY' : 'USD'
    setCurrency(next)
    store(CUR_KEY, next)
  }

  return (
    <div className="dsh-trace" ref={rootRef} style={ROOT_STYLE}>
      <div className="dsh-trace__bar">
        <span className="dsh-trace__total">
          {t('turnsCount', { n: fold.turns.length })} · <span className="dsh-trace__total-cost">{money(total, currency, fx)}</span>
          {totalSaved > 0 ? (
            <span
              className="dsh-trace__total-saved"
              title={t('cacheSavedTotalTitle')}
            >
              {' '}· {t('cacheSavedTotal', { money: money(totalSaved, currency, fx) })}
            </span>
          ) : null}
        </span>
        {fold.unpriced > 0 ? (
          <span className="dsh-trace__hint" title={t('unpricedTitle')}>
            {t('unpriced', { n: fold.unpriced })}
          </span>
        ) : null}
        {fold.inferred > 0 ? (
          <span className="dsh-trace__hint" title={t('inferredTitle')}>
            {t('inferred', { n: fold.inferred })}
          </span>
        ) : null}
        <span className="dsh-trace__spacer" />
        <span
          className="dsh-trace__version"
          title="bundle version"
        >
          v{BUILD_MARKER}
        </span>
        <button
          className="dsh-trace__btn"
          onClick={() => {
            setExpanded({})
            setSelectedKey(null)
          }}
          disabled={Object.keys(expanded).length === 0}
          title={t('collapseTitle')}
        >
          {t('collapse')}
        </button>
        <button className="dsh-trace__btn" onClick={toggleCurrency} title={t('currencyTitle', { fx })}>
          {currency}
        </button>
      </div>

      <div className="dsh-trace__body" style={BODY_STYLE}>
        <div className="dsh-trace__main">
          {fold.turns.length > 0 ? (
            <div className="dsh-trace__pager">
              <button
                type="button"
                className="dsh-trace__page-btn"
                disabled={page <= 0 || historyWindow.loadingOlder}
                onClick={() => goto(page - 1)}
              >
                {'< '}
                {t('newer')}
              </button>
              <button
                type="button"
                className="dsh-trace__page-btn"
                disabled={historyWindow.loadingOlder || (page >= pageCount - 1 && !historyWindow.hasMore)}
                onClick={() => goto(page + 1)}
              >
                {t('older')}
                {' >'}
              </button>
            </div>
          ) : null}

          {fold.turns.length === 0 ? (
            <pre className="dsh-trace__diag">
              {t('emptySession')}{'\n'}
              {fold.note ?? describeChat(chat)}
              {'\n'}useChat={typeof props.useChat} · useConversation={typeof props.useConversation} · sessionId=
              {String(props.sessionId)}
              {'\n'}build={BUILD_MARKER}
            </pre>
          ) : (
            <div className="dsh-trace__list" ref={listRef} style={LIST_STYLE}>
              {pageTurns.map((turn) => (
                <TurnSection
                  key={turn.turn}
                  turn={turn}
                  rows={rowsByTurn.get(turn.turn) ?? []}
                  currency={currency}
                  fx={fx}
                  open={expanded[turn.turn] === true}
                  selectedKey={selectedKey}
                  outputRow={outputsByTurn.get(turn.turn) ?? null}
                  t={t}
                  onToggle={() => setExpanded((prev) => (prev[turn.turn] === true ? {} : { [turn.turn]: true }))}
                  onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
                />
              ))}
            </div>
          )}
        </div>
        <Inspector
          row={selectedRow}
          turns={fold.turns}
          sessionId={String(props.sessionId)}
          currency={currency}
          fx={fx}
          t={t}
          onClose={() => setSelectedKey(null)}
        />
      </div>

    </div>
  )
}

interface SlotsLike {
  inject: (slot: string, register: () => unknown) => void
  register: (
    spec: { name: string; id: string; order: number; locale?: string; label: () => string },
    component: unknown,
  ) => unknown
}

interface LocaleLike {
  register: (ns: string, dicts: Record<string, Record<string, string>>) => () => void
  bind: (ns: string) => Translate
  getSnapshot: () => { active: string; revision: number }
  subscribe: (fn: () => void) => () => void
}

interface SessionsLike {
  binding?: (id: string) => { session?: { loadOlder?: () => Promise<boolean | void> } } | undefined
}

interface ContextLike {
  slots?: SlotsLike
  locale?: LocaleLike
  sessions?: SessionsLike
  modelDirectories?: ModelDirectoriesLike
  get?: (name: string) => unknown
  effect?: (run: () => () => void, label?: string) => void
}

/**
 * Hard dependency: the slot ring. Locale and model directories are read
 * defensively through `ctx.get`, because a missing injected service makes the
 * entry fail to activate — and the shell treats that as a boot error.
 */
export const inject = ['slots']

let stylesInstalled = false

/** Inject the stylesheet once per page (a bundle may be rematerialized). */
function ensureStyles(): void {
  if (stylesInstalled) return
  stylesInstalled = true
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-dsh-turn-trace]') !== null) return
  const style = document.createElement('style')
  style.setAttribute('data-dsh-turn-trace', '')
  style.textContent = TRACE_CSS
  document.head.appendChild(style)
}

/**
 * Register the Turns tab.
 * @param ctx - client plugin context carrying the slot service.
 */
export function apply(ctx: Context): void {
  // The shell refuses to boot when a client entry fails to activate, so this
  // function may degrade — never throw.
  try {
    activate(ctx)
  } catch (error) {
    console.error('[dsh-turn-trace] activation failed; the Turns tab stays off', error)
  }
}

function activate(ctx: Context): void {
  ensureStyles()
  const host = ctx as unknown as ContextLike
  const getService = (name: string): unknown => {
    try {
      return typeof host.get === 'function' ? host.get(name) : undefined
    } catch {
      return undefined
    }
  }

  const slots = getService('slots') as SlotsLike | undefined
  if (slots === undefined) {
    console.warn('[dsh-turn-trace] slot service unavailable; the Turns tab stays off')
    return
  }

  const getLocale = (): LocaleLike | undefined => getService('locale') as LocaleLike | undefined

  // The locale runtime may register after this plugin, so registration is
  // deferred to the first moment the service exists (idempotent).
  let registered = false
  const ensureDictionaries = (): void => {
    if (registered) return
    const locale = getLocale()
    if (locale === undefined) return
    registered = true
    try {
      locale.register(NS, { en: EN, zh: ZH })
    } catch (error) {
      // A second materialization registering the same dictionary is harmless.
      console.warn('[dsh-turn-trace] dictionary registration skipped', error)
    }
  }
  ensureDictionaries()

  // Pass a getter, not the service: it may not exist yet when we activate.
  const modelDirectories = (): ModelDirectoriesLike | undefined =>
    getService('modelDirectories') as ModelDirectoriesLike | undefined
  const loadOlder = async (sessionId: string): Promise<void> => {
    try {
      const sessions = getService('sessions') as SessionsLike | undefined
      await sessions?.binding?.(sessionId)?.session?.loadOlder?.()
    } catch (error) {
      console.warn('[dsh-turn-trace] loadOlder failed', error)
    }
  }

  slots.inject('conversation.view', () =>
    slots.register(
      {
        name: 'conversation.view',
        id: 'turns',
        order: 20,
        locale: NS,
        label: () => {
          // The roster projects labels at boot; a throw here would drop the tab.
          try {
            ensureDictionaries()
            return makeTranslate(getLocale())('tab')
          } catch {
            return 'Turns'
          }
        },
      },
      (props: ConversationViewPropsLike) =>
        React.createElement(TurnsView, {
          ...props,
          modelDirectories,
          getLocale,
          ensureDictionaries,
          loadOlder: () => loadOlder(String(props.sessionId)),
        }),
    ),
  )
}
