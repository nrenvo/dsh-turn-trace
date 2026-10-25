/**
 * dsh-turn-trace — copy, in both languages the harness ships.
 *
 * Registered through the host's locale service, so the tab follows the DSH
 * language setting instead of guessing from the browser.
 */
export const NS = 'dsh-turn-trace'

/** Locale id the tab falls back to when the runtime provides no `t`. */
export type Lang = 'en' | 'zh'

export const EN: Record<string, string> = {
  tab: 'Turns',
  turnsCount: '{n} turns',
  cacheSavedTotal: 'cache saved {money}',
  cacheSavedTotalTitle: 'Compared with billing every input token at the cache-miss rate',
  newer: 'Newer',
  older: 'Older',
  loadingOlder: 'Loading older turns…',
  collapse: 'Collapse',
  collapseTitle: 'Collapse every turn',
  currencyTitle: 'Switch display currency (1 USD = {fx} CNY)',
  unpriced: '{n} steps unpriced',
  unpricedTitle: 'Those steps recorded no model id and the session had none to fall back to',
  inferred: '{n} steps priced by their neighbour',
  inferredTitle: 'Those steps carried no model id; the nearest recorded model priced them',
  turn: 'Turn {n}',
  stepsCount: '{n} steps',
  took: 'took {duration}',
  saved: 'saved {money}',
  step: 'Step {index}/{total}',
  priciest: 'priciest',
  cacheMiss: 'cache miss',
  cacheMissTitle: '{tokens} input tokens missed the cache and billed at the input rate',
  perStepSaved: 'saved {money}',
  userInput: 'user input',
  modelOutput: 'model output',
  llm: 'llm',
  statusOk: 'ok',
  statusRunning: 'running…',
  statusFailed: 'failed',
  statusInterrupted: 'interrupted',
  overview: 'Overview',
  position: 'Position',
  eventTime: 'Event time',
  fromTurnStart: '+{duration} into turn',
  duration: 'Duration',
  durationApprox: 'estimated from the neighbouring event',
  model: 'Model',
  modelSource_request: 'from the request config',
  modelSource_provider: 'reported by the provider',
  modelSource_inherited: 'inherited from a neighbouring step',
  modelSource_session: 'from the session model selection',
  modelSource_running: 'step still running',
  modelSource_none: 'not recorded',
  modelPending: 'no model yet',
  tokens: 'Tokens',
  tokensIn: '{n} in',
  tokensOut: '{n} out',
  cost: 'Cost',
  cache: 'Cache',
  cacheHit: 'hit {tokens}',
  cacheSaved: 'saved {money}',
  status: 'Status',
  thinking: 'Thinking',
  args: 'Arguments',
  result: 'Raw result',
  content: 'Content',
  source: 'Source',
  session: 'session',
  node: 'node',
  callId: 'callId',
  noText: '(no text)',
  emptySession: 'This session has no steps yet.',
  missingChat: 'Turns cannot reach the chat snapshot.',
  missingChatHint: 'useChat={useChat} · useConversation={useConversation}',
  failed: 'Turns failed: {error}',
}

export const ZH: Record<string, string> = {
  tab: '轮次',
  turnsCount: '{n} 轮',
  cacheSavedTotal: '缓存省 {money}',
  cacheSavedTotalTitle: '与所有输入 token 都按未命中价计费相比省下的钱',
  newer: '更新',
  older: '更旧',
  loadingOlder: '正在加载更旧的轮次…',
  collapse: '收起',
  collapseTitle: '收起所有轮次',
  currencyTitle: '切换显示货币（1 USD = {fx} CNY）',
  unpriced: '{n} 步未计价',
  unpricedTitle: '这些步没有记录模型 id，会话也没有可用的当前模型',
  inferred: '{n} 步按邻近模型计价',
  inferredTitle: '这些步骤没有记录模型 id，用最近的已记录模型计价',
  turn: '第 {n} 轮',
  stepsCount: '{n} 步',
  took: '耗时 {duration}',
  saved: '省 {money}',
  step: '第 {index}/{total} 步',
  priciest: '最贵',
  cacheMiss: '缓存未命中',
  cacheMissTitle: '{tokens} 输入 token 没命中缓存，按输入价计费',
  perStepSaved: '省 {money}',
  userInput: '用户输入',
  modelOutput: '模型输出',
  llm: 'llm',
  statusOk: '成功',
  statusRunning: '运行中…',
  statusFailed: '失败',
  statusInterrupted: '已中断',
  overview: '概述',
  position: '位置',
  eventTime: '事件时间',
  fromTurnStart: '距轮首 +{duration}',
  duration: '耗时',
  durationApprox: '由相邻事件估算',
  model: '模型',
  modelSource_request: '来自请求配置',
  modelSource_provider: 'provider 回报',
  modelSource_inherited: '继承自邻近步',
  modelSource_session: '来自会话当前选择',
  modelSource_running: '本步尚未结束',
  modelSource_none: '未记录',
  modelPending: '尚无模型',
  tokens: 'Token',
  tokensIn: '输入 {n}',
  tokensOut: '输出 {n}',
  cost: '金额',
  cache: '缓存',
  cacheHit: '命中 {tokens}',
  cacheSaved: '省 {money}',
  status: '状态',
  thinking: '思考',
  args: '参数',
  result: '原始返回',
  content: '内容',
  source: '来源',
  session: 'session',
  node: 'node',
  callId: 'callId',
  noText: '（无文本）',
  emptySession: '这次会话还没有任何步骤。',
  missingChat: '读不到聊天快照。',
  missingChatHint: 'useChat={useChat} · useConversation={useConversation}',
  failed: '轮次视图出错：{error}',
}

/** Substitute `{name}` placeholders in one template. */
export function format(template: string, params?: Record<string, string | number>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  )
}

/**
 * Local translator used only when the harness hands us no `t` (an older
 * runtime, or a host that never registered the locale service).
 * @param language - active language as reported by the browser.
 * @returns a translate function with the same placeholder rules.
 */
export function fallbackTranslate(language: string): (key: string, params?: Record<string, string | number>) => string {
  const dict = /^zh/i.test(language) ? ZH : EN
  return (key, params) => format(dict[key] ?? EN[key] ?? key, params)
}
