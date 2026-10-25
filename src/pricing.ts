/**
 * dsh-turn-trace — pricing.
 *
 * DeepSeek publishes peak USD rates per 1M tokens and bills every other hour at
 * half price (peak: 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday). The
 * call's own timestamp therefore decides its price, so `estimateCost` takes it.
 *
 * Source: https://api-docs.deepseek.com/quick_start/pricing/
 * Chinese public holidays are not modelled; sessions on those days read high.
 */

/** A model family this view can price. */
export type PriceTier = 'flash' | 'pro'

/** Peak USD per 1M tokens: input (cache miss) / output / input (cache hit). */
const RATES: Record<PriceTier, { input: number; output: number; cacheRead: number }> = {
  flash: { input: 0.3, output: 1.2, cacheRead: 0.006 },
  pro: { input: 1.32, output: 3.96, cacheRead: 0.044 },
}

/** Token counts reported by the provider for one model call. */
export interface TokenUsage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
}

/** Peak pricing applies on weekdays 01:00-04:00 and 06:00-10:00 UTC. */
export function isPeak(at: number): boolean {
  const date = new Date(at)
  const weekday = date.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  const hour = date.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

/** Keep six decimals: a single step is often worth far less than a cent. */
export function roundCost(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/**
 * Estimate the USD cost of one model call.
 *
 * Cache writes bill at the cache-miss input rate, matching DeepSeek's rule.
 * @param tier - model family the session is priced as.
 * @param usage - provider-reported token counts.
 * @param at - unix epoch ms of the call; selects peak or off-peak.
 * @returns USD, six-decimal rounded.
 */
export function estimateCost(tier: PriceTier, usage: TokenUsage, at: number): number {
  const rate = RATES[tier]
  const factor = isPeak(at) ? 1 : 0.5
  const input = usage.input ?? 0
  const output = usage.output ?? 0
  const cacheRead = usage.cacheRead ?? 0
  const cacheWrite = usage.cacheWrite ?? 0
  const cost = ((input * rate.input + cacheRead * rate.cacheRead + cacheWrite * rate.input + output * rate.output) * factor) / 1e6
  return roundCost(cost)
}

/**
 * Map a provider model id to a price tier.
 *
 * Session snapshots carry the model id, so this is the normal path; the picker
 * only covers calls whose model id never made it into the snapshot.
 * @param model - provider model id, e.g. `deepseek-v4-flash`.
 * @returns the matching tier, or null when the id is not a DeepSeek family.
 */
export function tierForModel(model: string | null | undefined): PriceTier | null {
  if (typeof model !== 'string') return null
  const lower = model.toLowerCase()
  if (lower.includes('pro')) return 'pro'
  if (lower.includes('flash') || lower.startsWith('deepseek-chat') || lower.startsWith('deepseek-reasoner')) return 'flash'
  return null
}

/**
 * Money a cache hit saved versus paying the cache-miss input rate.
 * @param tier - model family the session is priced as.
 * @param usage - provider-reported token counts.
 * @param at - unix epoch ms of the call; selects peak or off-peak.
 * @returns USD saved, six-decimal rounded.
 */
export function cacheSavings(tier: PriceTier, usage: TokenUsage, at: number): number {
  const rate = RATES[tier]
  const factor = isPeak(at) ? 1 : 0.5
  const saved = (((usage.cacheRead ?? 0) * (rate.input - rate.cacheRead)) * factor) / 1e6
  return roundCost(saved)
}
