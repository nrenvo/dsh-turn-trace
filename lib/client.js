// Generated wrapper: do not edit by hand (scripts/wrap-client.mjs).
window.__ModuleLoader__.load({
  id: "dsh-turn-trace",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let react = require("react");
react = __toESM(react, 1);
// src/pricing.ts
/** Peak USD per 1M tokens: input (cache miss) / output / input (cache hit). */
const RATES = {
	flash: {
		input: .3,
		output: 1.2,
		cacheRead: .006
	},
	pro: {
		input: 1.32,
		output: 3.96,
		cacheRead: .044
	}
};
/** Peak pricing applies on weekdays 01:00-04:00 and 06:00-10:00 UTC. */
function isPeak(at) {
	const date = new Date(at);
	const weekday = date.getUTCDay();
	if (weekday === 0 || weekday === 6) return false;
	const hour = date.getUTCHours();
	return hour >= 1 && hour < 4 || hour >= 6 && hour < 10;
}
/** Keep six decimals: a single step is often worth far less than a cent. */
function roundCost(value) {
	return Math.round(value * 1e6) / 1e6;
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
function estimateCost(tier, usage, at) {
	const rate = RATES[tier];
	const factor = isPeak(at) ? 1 : .5;
	const input = usage.input ?? 0;
	const output = usage.output ?? 0;
	const cacheRead = usage.cacheRead ?? 0;
	const cacheWrite = usage.cacheWrite ?? 0;
	return roundCost((input * rate.input + cacheRead * rate.cacheRead + cacheWrite * rate.input + output * rate.output) * factor / 1e6);
}
/**
* Map a provider model id to a price tier.
*
* Session snapshots carry the model id, so this is the normal path; the picker
* only covers calls whose model id never made it into the snapshot.
* @param model - provider model id, e.g. `deepseek-v4-flash`.
* @returns the matching tier, or null when the id is not a DeepSeek family.
*/
function tierForModel(model) {
	if (typeof model !== "string") return null;
	const lower = model.toLowerCase();
	if (lower.includes("pro")) return "pro";
	if (lower.includes("flash") || lower.startsWith("deepseek-chat") || lower.startsWith("deepseek-reasoner")) return "flash";
	return null;
}
/**
* Money a cache hit saved versus paying the cache-miss input rate.
* @param tier - model family the session is priced as.
* @param usage - provider-reported token counts.
* @param at - unix epoch ms of the call; selects peak or off-peak.
* @returns USD saved, six-decimal rounded.
*/
function cacheSavings(tier, usage, at) {
	const rate = RATES[tier];
	const factor = isPeak(at) ? 1 : .5;
	return roundCost((usage.cacheRead ?? 0) * (rate.input - rate.cacheRead) * factor / 1e6);
}
// src/fold.ts
const EMPTY_TOTALS = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	cost: 0,
	cacheSaved: 0
};
function truncate$1(value, max) {
	return value.length <= max ? value : `${value.slice(0, max)}…`;
}
/** Join the text (or reasoning) blocks of one assistant step. */
function blocksText(blocks, kind, cap) {
	if (!Array.isArray(blocks)) return "";
	const parts = [];
	for (const block of blocks) {
		if (block === null || typeof block !== "object") continue;
		const record = block;
		if (record.kind === kind && typeof record.text === "string") parts.push(record.text);
	}
	const text = parts.join("\n").trim();
	return text.length > cap ? `${text.slice(0, cap)}…` : text;
}
function promptText(data) {
	if (!Array.isArray(data.content)) return "";
	const parts = [];
	for (const block of data.content) if (block !== null && typeof block === "object" && typeof block.text === "string") parts.push(block.text);
	return truncate$1(parts.join("\n"), 240);
}
function locationOf(node) {
	const location = node.location;
	if (location === void 0 || location === null) return {
		turn: null,
		step: null
	};
	if (location.kind === "step") return {
		turn: location.step.turn,
		step: location.step.step
	};
	if (location.kind === "turn") return {
		turn: location.turn.turn,
		step: null
	};
	return {
		turn: null,
		step: null
	};
}
function addTotals(target, row) {
	target.input += row.input ?? 0;
	target.output += row.output ?? 0;
	target.cacheRead += row.cacheRead ?? 0;
	target.cacheWrite += row.cacheWrite ?? 0;
	target.cost += row.cost ?? 0;
	target.cacheSaved += row.cacheSaved ?? 0;
}
function isToolResult(root) {
	return root.kind === "tool-result";
}
/** Flatten a result's content blocks into a bounded preview string. */
function resultText(content, cap = 2e3) {
	const parts = [];
	const walk = (value) => {
		if (typeof value === "string") {
			parts.push(value);
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) walk(item);
			return;
		}
		if (value !== null && typeof value === "object") {
			const record = value;
			if (typeof record.text === "string") parts.push(record.text);
			if (record.content !== void 0) walk(record.content);
		}
	};
	walk(content);
	const text = parts.join("\n").trim();
	return text.length > cap ? `${text.slice(0, cap)}…` : text;
}
function toolRowFrom(root, key, fallback) {
	if (isToolResult(root)) {
		const name = root.name ?? root.call?.name ?? "tool";
		const duration = root.callTime === null || root.callTime === void 0 ? null : Math.max(0, root.time - root.callTime);
		return {
			key,
			kind: "tool",
			time: root.time,
			turn: fallback.turn,
			step: fallback.step,
			name,
			callId: root.callId,
			duration,
			status: root.isError ? "failed" : "ok",
			error: root.error?.code ?? root.error?.reason ?? null,
			args: root.call?.argsRaw ?? void 0,
			result: resultText(root.content)
		};
	}
	return {
		key,
		kind: "tool",
		time: root.time,
		turn: fallback.turn,
		step: fallback.step,
		name: root.name,
		callId: root.callId,
		duration: null,
		status: "running",
		error: null,
		args: root.argsRaw
	};
}
/** One-line description of a chat snapshot, used by the view's self-diagnostic. */
function describeChat(chat) {
	if (chat === null || chat === void 0) return "chat: undefined";
	const order = Array.isArray(chat.order) ? chat.order : [];
	const kinds = /* @__PURE__ */ new Map();
	let nodes = 0;
	for (const key of order) {
		const node = chat.nodes?.get?.(key);
		if (node === void 0 || node === null) continue;
		nodes += 1;
		kinds.set(node.kind, (kinds.get(node.kind) ?? 0) + 1);
	}
	const summary = [...kinds.entries()].map(([kind, count]) => `${kind}×${count}`).join(", ") || "none";
	return `order=${order.length} nodes=${nodes} kinds=[${summary}]`;
}
/**
* Fold the chat target into turns, steps, and rows.
* @param chat - chat snapshot slice from `useChat` (or the conversation view store).
* @param fallbackTier - pricing family for steps whose model id is missing.
* @returns rollups plus the flat row list, ready to render.
*/
function foldChat(chat, sessionModel) {
	const order = Array.isArray(chat?.order) ? chat.order : [];
	const rows = [];
	let detected = 0;
	let sawRunningAssistant = false;
	for (const key of order) {
		const node = chat.nodes?.get?.(key);
		if (node === void 0 || node === null) continue;
		const where = locationOf(node);
		if (node.kind === "assistant-step") {
			const data = node.data;
			if (data === null || typeof data !== "object") continue;
			const final = data.finalNode;
			const usage = data.usage ?? final?.usage;
			const tokens = {
				input: usage?.inputTokens ?? 0,
				output: usage?.outputTokens ?? 0,
				cacheRead: usage?.cacheReadTokens ?? 0,
				cacheWrite: usage?.cacheWriteTokens ?? 0
			};
			const requested = final?.requestConfig?.model;
			const reported = final?.providerMetadata?.model ?? final?.provenance?.model;
			const model = requested ?? reported;
			const modelSource = requested !== void 0 ? "request" : reported !== void 0 ? "provider" : "none";
			const modelAlt = requested !== void 0 && reported !== void 0 && requested !== reported ? reported : void 0;
			if (tierForModel(model) !== null) detected += 1;
			const started = final?.timing?.stepStartTime ?? null;
			const ended = final?.timing?.completedTime ?? data.time;
			if (data.status === "running") sawRunningAssistant = true;
			const say = blocksText(data.blocks, "text", 4e3);
			const thinking = blocksText(data.blocks, "reasoning", 4e3);
			rows.push({
				key,
				kind: "llm",
				say: say === "" ? void 0 : say,
				...modelSource === "none" && data.status === "running" ? { modelSource: "running" } : {},
				thinking: thinking === "" ? void 0 : thinking,
				time: ended,
				turn: data.turn ?? where.turn,
				step: data.step ?? where.step,
				model,
				modelAlt,
				modelSource,
				duration: started === null ? null : Math.max(0, ended - started),
				status: "ok",
				...tokens
			});
			continue;
		}
		if (node.kind === "tool-call") {
			const data = node.data;
			if (data?.root === void 0) continue;
			rows.push(toolRowFrom(data.root, key, where));
			continue;
		}
		if (node.kind === "user") {
			const data = node.data;
			rows.push({
				key,
				kind: "user",
				time: typeof data?.time === "number" ? data.time : 0,
				turn: where.turn,
				step: null,
				text: data === void 0 ? "" : promptText(data),
				status: "ok"
			});
		}
	}
	rows.sort((left, right) => left.time - right.time);
	const counts = /* @__PURE__ */ new Map();
	for (const row of rows) if (row.kind === "llm" && row.model !== void 0 && tierForModel(row.model) !== null) counts.set(row.model, (counts.get(row.model) ?? 0) + 1);
	const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
	let carried;
	let inferred = 0;
	let unpriced = 0;
	for (const row of rows) {
		if (row.kind !== "llm") continue;
		if (row.model !== void 0 && tierForModel(row.model) !== null) carried = row.model;
		else {
			const inherited = carried ?? dominant ?? (sessionModel !== void 0 && tierForModel(sessionModel) !== null ? sessionModel : void 0);
			if (inherited === void 0) {
				if (row.modelSource !== "running") row.modelSource = "none";
				unpriced += 1;
				continue;
			}
			row.model = inherited;
			if (carried === void 0 && dominant === void 0) row.modelSource = "session";
			else {
				row.modelInferred = true;
				row.modelSource = "inherited";
			}
			inferred += 1;
		}
		const tier = tierForModel(row.model);
		if (tier === null) {
			unpriced += 1;
			row.model = void 0;
			continue;
		}
		row.cost = estimateCost(tier, row, row.time);
		row.cacheSaved = cacheSavings(tier, row, row.time);
	}
	const lastTime = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const slot = `${row.turn ?? "x"}:${row.step ?? "x"}`;
		if (row.duration == null) {
			const previous = lastTime.get(slot);
			if (previous !== void 0 && row.time > previous) {
				row.duration = row.time - previous;
				row.approx = true;
			}
		}
		lastTime.set(slot, row.time);
	}
	const turnNumbers = /* @__PURE__ */ new Set();
	for (const row of rows) if (row.turn !== null) turnNumbers.add(row.turn);
	const turns = [...turnNumbers].sort((a, b) => a - b).map((turn, turnIndex) => {
		const turnRows = rows.filter((row) => row.turn === turn);
		const timed = turnRows.filter((row) => row.time > 0);
		const startTime = timed.reduce((min, row) => Math.min(min, row.time), Number.POSITIVE_INFINITY);
		const endTime = timed.reduce((max, row) => Math.max(max, row.time), 0);
		const stepNumbers = [...new Set(turnRows.filter((row) => row.step !== null).map((row) => row.step))].sort((a, b) => a - b);
		const totals = { ...EMPTY_TOTALS };
		let llmCalls = 0;
		let toolCalls = 0;
		let failedTools = 0;
		const steps = stepNumbers.map((step, stepIndex) => {
			const stepRows = turnRows.filter((row) => row.step === step);
			const stepTotals = { ...EMPTY_TOTALS };
			let stepLlm = 0;
			let stepTools = 0;
			let stepModel;
			for (const row of stepRows) if (row.kind === "llm") {
				stepLlm += 1;
				llmCalls += 1;
				addTotals(stepTotals, row);
				addTotals(totals, row);
				stepModel ??= row.model;
			} else if (row.kind === "tool") {
				stepTools += 1;
				toolCalls += 1;
				if (row.status === "failed") failedTools += 1;
			}
			const stepStart = stepRows.reduce((min, row) => Math.min(min, row.time), Number.POSITIVE_INFINITY);
			const stepEnd = stepRows.reduce((max, row) => Math.max(max, row.time), 0);
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
				model: stepModel
			};
		});
		return {
			turn,
			index: (typeof turn === "number" ? turn : turnIndex) + 1,
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
			cacheSaved: roundCost(totals.cacheSaved)
		};
	});
	if (sawRunningAssistant && turns.length > 0) turns[turns.length - 1].running = true;
	const result = {
		turns,
		rows,
		detected,
		inferred,
		unpriced
	};
	if (turns.length === 0) result.note = describeChat(chat);
	return result;
}
// src/locale.ts
/**
* dsh-turn-trace — copy, in both languages the harness ships.
*
* Registered through the host's locale service, so the tab follows the DSH
* language setting instead of guessing from the browser.
*/
const NS = "dsh-turn-trace";
const EN = {
	tab: "Turns",
	turnsCount: "{n} turns",
	cacheSavedTotal: "cache saved {money}",
	cacheSavedTotalTitle: "Compared with billing every input token at the cache-miss rate",
	newer: "Newer",
	older: "Older",
	loadingOlder: "Loading older turns…",
	collapse: "Collapse",
	collapseTitle: "Collapse every turn",
	currencyTitle: "Switch display currency (1 USD = {fx} CNY)",
	unpriced: "{n} steps unpriced",
	unpricedTitle: "Those steps recorded no model id and the session had none to fall back to",
	inferred: "{n} steps priced by their neighbour",
	inferredTitle: "Those steps carried no model id; the nearest recorded model priced them",
	turn: "Turn {n}",
	stepsCount: "{n} steps",
	took: "took {duration}",
	saved: "saved {money}",
	step: "Step {index}/{total}",
	priciest: "priciest",
	cacheMiss: "cache miss",
	cacheMissTitle: "{tokens} input tokens missed the cache and billed at the input rate",
	perStepSaved: "saved {money}",
	userInput: "user input",
	modelOutput: "model output",
	llm: "llm",
	statusOk: "ok",
	statusRunning: "running…",
	statusFailed: "failed",
	statusInterrupted: "interrupted",
	overview: "Overview",
	position: "Position",
	eventTime: "Event time",
	fromTurnStart: "+{duration} into turn",
	duration: "Duration",
	durationApprox: "estimated from the neighbouring event",
	model: "Model",
	modelSource_request: "from the request config",
	modelSource_provider: "reported by the provider",
	modelSource_inherited: "inherited from a neighbouring step",
	modelSource_session: "from the session model selection",
	modelSource_running: "step still running",
	modelSource_none: "not recorded",
	modelPending: "no model yet",
	tokens: "Tokens",
	tokensIn: "{n} in",
	tokensOut: "{n} out",
	cost: "Cost",
	cache: "Cache",
	cacheHit: "hit {tokens}",
	cacheSaved: "saved {money}",
	status: "Status",
	thinking: "Thinking",
	args: "Arguments",
	result: "Raw result",
	content: "Content",
	source: "Source",
	session: "session",
	node: "node",
	callId: "callId",
	noText: "(no text)",
	emptySession: "This session has no steps yet.",
	missingChat: "Turns cannot reach the chat snapshot.",
	missingChatHint: "useChat={useChat} · useConversation={useConversation}",
	failed: "Turns failed: {error}"
};
const ZH = {
	tab: "轮次",
	turnsCount: "{n} 轮",
	cacheSavedTotal: "缓存省 {money}",
	cacheSavedTotalTitle: "与所有输入 token 都按未命中价计费相比省下的钱",
	newer: "更新",
	older: "更旧",
	loadingOlder: "正在加载更旧的轮次…",
	collapse: "收起",
	collapseTitle: "收起所有轮次",
	currencyTitle: "切换显示货币（1 USD = {fx} CNY）",
	unpriced: "{n} 步未计价",
	unpricedTitle: "这些步没有记录模型 id，会话也没有可用的当前模型",
	inferred: "{n} 步按邻近模型计价",
	inferredTitle: "这些步骤没有记录模型 id，用最近的已记录模型计价",
	turn: "第 {n} 轮",
	stepsCount: "{n} 步",
	took: "耗时 {duration}",
	saved: "省 {money}",
	step: "第 {index}/{total} 步",
	priciest: "最贵",
	cacheMiss: "缓存未命中",
	cacheMissTitle: "{tokens} 输入 token 没命中缓存，按输入价计费",
	perStepSaved: "省 {money}",
	userInput: "用户输入",
	modelOutput: "模型输出",
	llm: "llm",
	statusOk: "成功",
	statusRunning: "运行中…",
	statusFailed: "失败",
	statusInterrupted: "已中断",
	overview: "概述",
	position: "位置",
	eventTime: "事件时间",
	fromTurnStart: "距轮首 +{duration}",
	duration: "耗时",
	durationApprox: "由相邻事件估算",
	model: "模型",
	modelSource_request: "来自请求配置",
	modelSource_provider: "provider 回报",
	modelSource_inherited: "继承自邻近步",
	modelSource_session: "来自会话当前选择",
	modelSource_running: "本步尚未结束",
	modelSource_none: "未记录",
	modelPending: "尚无模型",
	tokens: "Token",
	tokensIn: "输入 {n}",
	tokensOut: "输出 {n}",
	cost: "金额",
	cache: "缓存",
	cacheHit: "命中 {tokens}",
	cacheSaved: "省 {money}",
	status: "状态",
	thinking: "思考",
	args: "参数",
	result: "原始返回",
	content: "内容",
	source: "来源",
	session: "session",
	node: "node",
	callId: "callId",
	noText: "（无文本）",
	emptySession: "这次会话还没有任何步骤。",
	missingChat: "读不到聊天快照。",
	missingChatHint: "useChat={useChat} · useConversation={useConversation}",
	failed: "轮次视图出错：{error}"
};
/** Substitute `{name}` placeholders in one template. */
function format(template, params) {
	if (params === void 0) return template;
	return template.replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
}
/**
* Local translator used only when the harness hands us no `t` (an older
* runtime, or a host that never registered the locale service).
* @param language - active language as reported by the browser.
* @returns a translate function with the same placeholder rules.
*/
function fallbackTranslate(language) {
	const dict = /^zh/i.test(language) ? ZH : EN;
	return (key, params) => format(dict[key] ?? EN[key] ?? key, params);
}
// src/client/styles.ts
/**
* dsh-turn-trace — package-owned stylesheet.
*
* Only references DSH theme tokens (`--dsw-alias-*`) so the ledger and its
* inspector adapt to light and dark themes without global overrides.
*/
const TRACE_CSS = `
.dsh-trace {
  display: flex; flex-direction: column; gap: 8px;
  box-sizing: border-box;
  height: 100%; min-height: 0; overflow: hidden;
  padding: 12px; font-size: 13px; line-height: 1.45;
  color: var(--dsw-alias-label-primary);
}
.dsh-trace__bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  flex: none;
  position: sticky; top: 0; z-index: 2;
  padding-bottom: 6px;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__total { font-size: 13px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dsh-trace__total-cost { font-size: 15px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.dsh-trace__hint { font-size: 11px; color: var(--dsw-alias-state-warn-primary); }
.dsh-trace__spacer { flex: 1; }
.dsh-trace__live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  animation: dshTracePulse 1.2s ease-in-out infinite;
}
@keyframes dshTracePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.dsh-trace__btn {
  padding: 3px 10px; border-radius: 6px; cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dsh-trace__btn:disabled { opacity: 0.5; cursor: default; }
.dsh-trace__select {
  padding: 3px 6px; border-radius: 6px; cursor: pointer;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__fx {
  width: 56px; padding: 3px 6px; border-radius: 6px;
  font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__body {
  display: flex; gap: 10px;
  flex: 1 1 auto; min-height: 0;
}
.dsh-trace__main {
  display: flex; flex-direction: column; gap: 6px;
  flex: 1 1 auto; min-width: 0; min-height: 0;
}
.dsh-trace__list {
  display: flex; flex-direction: column; gap: 6px;
  flex: 1 1 auto; min-width: 0; min-height: 0;
  overflow-y: auto; overscroll-behavior: auto;
  padding-right: 4px;
  /* Keep the last rows reachable above the floating composer. */
  padding-bottom: 24px;
}
.dsh-trace__turn {
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  overflow: hidden;
}
.dsh-trace__turn-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  width: 100%; padding: 8px 12px; cursor: pointer; text-align: left;
  font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  background: transparent; border: 0;
}
.dsh-trace__turn-head:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-trace__chev { width: 10px; }
.dsh-trace__turn-title { font-size: 13px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.dsh-trace__turn-meta { font-size: 11px; }
.dsh-trace__turn-saved, .dsh-trace__total-saved { font-size: 11px; font-weight: 500; color: var(--dsw-alias-state-success-primary); }
.dsh-trace__step-warn {
  padding: 0 6px; border-radius: 4px;
  font-size: 10px; font-weight: 700;
  color: var(--dsw-alias-state-warn-primary);
  border: 1px solid currentColor;
}
.dsh-trace__step-top {
  padding: 0 6px; border-radius: 999px;
  font-size: 10px; font-weight: 700;
  color: var(--dsw-alias-bg-base);
  background: var(--dsw-alias-state-warn-primary);
}
.dsh-trace__block {
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__block-summary {
  padding: 5px 10px; cursor: pointer;
  font-size: 11px; font-weight: 700; letter-spacing: 0.03em;
  color: var(--dsw-alias-label-secondary);
}
.dsh-trace__block[open] > .dsh-trace__block-summary { border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-trace__turn-cost {
  margin-left: auto;
  font-size: 13px; font-weight: 700;
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
}
.dsh-trace__turn-body {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 12px 10px 24px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__step {
  display: flex; flex-direction: column; gap: 3px;
  padding: 6px 10px; border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__step-head {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  font-size: 11px; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.dsh-trace__step-badge {
  padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
  color: var(--dsw-alias-bg-base);
  background: var(--dsw-alias-brand-primary);
}
.dsh-trace__step-cost { font-size: 12px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.dsh-trace__step-meta { font-size: 11px; }
.dsh-trace__call {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  width: 100%; text-align: left; cursor: pointer;
  padding: 3px 6px;
  font: inherit; font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0; border-left: 2px solid var(--dsw-alias-border-l1);
}
.dsh-trace__call:hover { background: var(--dsw-alias-bg-layer-1); }
.dsh-trace__call--user { border-left-color: var(--dsw-alias-state-warn-primary); }
.dsh-trace__call--llm { border-left-color: var(--dsw-alias-brand-primary); }
.dsh-trace__call--tool { border-left-color: var(--dsw-alias-state-success-primary); }
.dsh-trace__call--output { border-left-color: var(--dsw-alias-brand-primary); }
.dsh-trace__call--err { border-left-color: var(--dsw-alias-state-error-primary); }
.dsh-trace__call--selected {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary);
}
.dsh-trace__call-name { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dsh-trace__call-meta { font-size: 11px; }
.dsh-trace__call-status { font-size: 11px; font-weight: 600; color: var(--dsw-alias-state-success-primary); }
.dsh-trace__call-status--err { color: var(--dsw-alias-state-error-primary); }
.dsh-trace__call-preview {
  flex: 1; min-width: 0; max-width: 520px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: var(--dsw-alias-label-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-trace__prompt-label {
  flex: none; padding: 0 6px; border-radius: 4px;
  font-size: 10px; font-weight: 700; line-height: 16px;
  color: var(--dsw-alias-state-warn-primary);
  background: transparent;
  border: 1px solid currentColor;
}
.dsh-trace__prompt-label--out {
  color: var(--dsw-alias-brand-primary);
  background: transparent;
  border-color: currentColor;
}
.dsh-trace__prompt-time { flex: none; font-size: 11px; font-variant-numeric: tabular-nums; }
.dsh-trace__prompt-text {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-trace__inspector {
  display: flex; flex-direction: column; gap: 10px;
  flex: 0 0 320px; min-width: 0;
  overflow-y: auto; overscroll-behavior: contain;
  padding: 10px 10px 96px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
@media (max-width: 760px) {
  .dsh-trace__inspector { display: none; }
}
.dsh-trace__insp-head { display: flex; align-items: center; gap: 8px; }
.dsh-trace__insp-title {
  flex: 1; min-width: 0;
  font-size: 13px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-trace__insp-section { display: flex; flex-direction: column; gap: 4px; }
.dsh-trace__insp-h {
  margin: 0; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--dsw-alias-label-secondary);
}
.dsh-trace__insp-grid {
  display: grid; grid-template-columns: 64px 1fr; gap: 3px 8px;
  margin: 0; font-size: 11px;
}
.dsh-trace__insp-grid dt { color: var(--dsw-alias-label-secondary); }
.dsh-trace__insp-grid dd { margin: 0; color: var(--dsw-alias-label-primary); word-break: break-word; }
.dsh-trace__insp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
.dsh-trace__insp-pre {
  margin: 0; padding: 6px 8px; border-radius: 6px;
  white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.45;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__insp-pre--out { color: var(--dsw-alias-label-primary); }
.dsh-trace__badge {
  flex: none;
  padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
}
.dsh-trace__badge--user { background: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-bg-base); }
.dsh-trace__badge--llm { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.dsh-trace__badge--tool { background: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-bg-base); }
.dsh-trace__diag {
  margin: 0; padding: 10px; border-radius: 8px;
  font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  color: var(--dsw-alias-state-warn-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}
.dsh-trace__empty { padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary); }
.dsh-trace__version {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
}
`;
// src/client/index.tsx
/** Bumped by hand so a stale bundle is obvious in the UI. */
const BUILD_MARKER = "1.4.8";
const FX_KEY = "dsh-turn-trace:fx";
const CUR_KEY = "dsh-turn-trace:currency";
const DEFAULT_FX = 7.2;
function readString(key, fallback) {
	try {
		return window.localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
}
function store(key, value) {
	try {
		window.localStorage.setItem(key, value);
	} catch {}
}
function readCurrency() {
	return readString(CUR_KEY, "USD") === "CNY" ? "CNY" : "USD";
}
function readFx() {
	const value = Number(readString(FX_KEY, String(DEFAULT_FX)));
	return Number.isFinite(value) && value > 0 && value < 1e3 ? value : DEFAULT_FX;
}
function fmtTime(ms) {
	if (ms == null) return "";
	const date = new Date(ms);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function fmtDuration(ms, approx = false) {
	if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
	const value = (() => {
		if (ms < 1e3) return `${Math.round(ms)}ms`;
		if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
		return `${Math.floor(ms / 6e4)}m ${Math.floor(ms % 6e4 / 1e3)}s`;
	})();
	return approx ? `~${value}` : value;
}
function fmtTokens(n) {
	if (n == null || n === 0) return "0";
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
	return String(n);
}
/** USD → display currency. */
function money(usd, currency, fx) {
	if (usd == null) return "—";
	const value = currency === "CNY" ? usd * fx : usd;
	const symbol = currency === "CNY" ? "¥" : "$";
	if (value === 0) return `${symbol}0`;
	if (value < .01) return `${symbol}${value.toFixed(4)}`;
	if (value < 1) return `${symbol}${value.toFixed(3)}`;
	return `${symbol}${value.toFixed(2)}`;
}
function stepTokens(step) {
	return `${fmtTokens(step.input + step.cacheRead + step.cacheWrite)} in → ${fmtTokens(step.output)} out`;
}
function truncate(value, max) {
	return value.length <= max ? value : `${value.slice(0, max)}…`;
}
/** Parse a tool argument string when it is JSON. */
function parseArgs(args) {
	if (args === void 0 || args === "") return void 0;
	try {
		return JSON.parse(args);
	} catch {
		return;
	}
}
/** Inspector form: pretty JSON when possible, raw text otherwise. */
function prettyArgs(args) {
	if (args === void 0 || args === "") return "";
	const parsed = parseArgs(args);
	if (parsed === void 0) return args;
	try {
		return JSON.stringify(parsed, null, 2);
	} catch {
		return args;
	}
}
/** Row form: the one field a human recognizes, else a short raw slice. */
function summarizeArgs(args) {
	if (args === void 0 || args === "") return "";
	const parsed = parseArgs(args);
	if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
		const record = parsed;
		for (const key of [
			"command",
			"cmd",
			"path",
			"file_path",
			"pattern",
			"query",
			"url",
			"name",
			"description"
		]) {
			const value = record[key];
			if (typeof value === "string" && value !== "") return `${key}: ${truncate(value, 80)}`;
			if (Array.isArray(value)) return `${key}: ${truncate(value.join(" "), 80)}`;
		}
	}
	return truncate(args, 80);
}
function cacheRate(totals) {
	const input = totals.input + totals.cacheRead + totals.cacheWrite;
	return input === 0 ? 0 : Math.round(totals.cacheRead / input * 100);
}
/**
* Cache hits are the norm, so a hit is not worth a badge. A miss is: the same
* tokens suddenly cost the input rate, which is how a bill spikes.
* @param totals - step or turn totals.
* @returns whether a meaningful share of input missed the cache.
*/
function cacheBreak(totals) {
	return totals.input + totals.cacheRead + totals.cacheWrite >= 1e3 && cacheRate(totals) < 90;
}
function localZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
	} catch {
		return "local";
	}
}
function fmtClock(ms) {
	if (ms == null) return "—";
	const date = new Date(ms);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function isoTitle(ms) {
	return ms == null ? "" : new Date(ms).toISOString();
}
function statusText(row, t) {
	if (row.status === "failed") return `${t("statusFailed")}${row.error ? ` · ${row.error}` : ""}`;
	if (row.status === "running") return t("statusRunning");
	return row.status === "ok" ? t("statusOk") : "";
}
/** Where a row sits, described with the same numbering the ledger shows. */
function describeLocation(row, turns) {
	const turn = turns.find((candidate) => candidate.turn === row.turn);
	if (turn === void 0) return "turn —";
	const step = row.step === null ? void 0 : turn.steps.find((candidate) => candidate.step === row.step);
	const parts = [`Turn ${turn.index}`];
	if (step !== void 0) parts.push(`Step ${step.index}/${step.total}`);
	return parts.join(" · ");
}
/** Catches a render failure and shows it instead of an empty panel. */
var TurnsBoundary = class extends react.Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error) {
		console.error("[dsh-turn-trace] view failed", error);
	}
	render() {
		const error = this.state.error;
		if (error !== null) {
			const t = fallbackTranslate(typeof navigator === "undefined" ? "en" : navigator.language);
			return /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__diag" }, t("failed", { error: String(error.stack ?? error.message ?? error) }));
		}
		return this.props.children;
	}
};
const noopSubscribe = () => () => {};
const localTranslators = /* @__PURE__ */ new Map();
function localFor(active) {
	const cached = localTranslators.get(active);
	if (cached !== void 0) return cached;
	const created = fallbackTranslate(active);
	localTranslators.set(active, created);
	return created;
}
function guessLanguage() {
	return typeof navigator === "undefined" ? "en" : navigator.language;
}
/** Build a translator over one locale runtime instance (or the local dictionary). */
function makeTranslate(locale) {
	if (locale === void 0) return localFor(guessLanguage());
	let bound;
	try {
		bound = locale.bind(NS);
	} catch {
		return localFor(guessLanguage());
	}
	const active = () => {
		try {
			return locale.getSnapshot().active;
		} catch {
			return guessLanguage();
		}
	};
	return (key, params) => {
		try {
			const value = bound(key, params);
			if (value !== key) return value;
		} catch {}
		return localFor(active())(key, params);
	};
}
/**
* Translate through the host registry, falling back to the built-in dictionary
* for the *currently active* locale — not the locale that happened to be active
* when the plugin activated.
*/
function useTranslate(props) {
	props.ensureDictionaries?.();
	const locale = props.getLocale?.() ?? props.locale;
	const subscribe = react.useMemo(() => locale === void 0 ? noopSubscribe : (fn) => locale.subscribe(fn), [locale]);
	const getRevision = react.useCallback(() => {
		try {
			return locale?.getSnapshot().revision ?? 0;
		} catch {
			return 0;
		}
	}, [locale]);
	const revision = react.useSyncExternalStore(subscribe, getRevision);
	const seat = props.t;
	return (0, react.useMemo)(() => {
		const local = localFor((() => {
			try {
				return locale?.getSnapshot().active ?? (typeof navigator === "undefined" ? "en" : navigator.language);
			} catch {
				return typeof navigator === "undefined" ? "en" : navigator.language;
			}
		})());
		const bound = locale?.bind(NS);
		const attempts = [
			seat,
			typeof seat === "function" ? void 0 : props.t,
			bound
		].filter((fn) => typeof fn === "function");
		return (key, params) => {
			for (const fn of attempts) try {
				const value = fn(key, params);
				if (value !== key) return value;
			} catch {}
			return local(key, params);
		};
	}, [
		locale,
		revision,
		seat,
		props.t
	]);
}
/**
* The session's current model selection, from the model-selection plugin's
* per-session directory. Used only when a step records no model of its own.
*/
function useSessionModel(props) {
	const directories = props.modelDirectories?.();
	const store = (0, react.useMemo)(() => {
		if (directories === void 0) return void 0;
		try {
			return directories.directoryFor(String(props.sessionId))?.store;
		} catch {
			return;
		}
	}, [directories, props.sessionId]);
	const getSnapshot = react.useCallback(() => store?.getSnapshot()?.current?.model, [store]);
	return react.useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot);
}
/** Prefer the chat plugin's own target hook; fall back to the standard view store. */
function useChatSnapshot(props) {
	if (typeof props.useChat === "function") return props.useChat((snapshot) => snapshot) ?? null;
	if (typeof props.useConversation === "function") return props.useConversation((snapshot) => snapshot.views.get("chat")) ?? null;
	return null;
}
/** One line per call; clicking it selects the row into the inspector. */
function callRow(props) {
	const { row, selected, onSelect, t } = props;
	const select = () => onSelect(row.key);
	const className = `dsh-trace__call dsh-trace__call--${row.kind}${selected ? " dsh-trace__call--selected" : ""}${row.status === "failed" ? " dsh-trace__call--err" : ""}`;
	if (row.kind === "user") return /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className,
		onClick: select,
		"aria-pressed": selected
	}, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__prompt-label" }, t("userInput")), /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__prompt-time",
		title: isoTitle(row.time)
	}, fmtTime(row.time)), /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__prompt-text",
		title: row.text
	}, row.text === void 0 || row.text === "" ? t("noText") : row.text));
	if (row.kind === "output") return /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className,
		onClick: select,
		"aria-pressed": selected
	}, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__prompt-label dsh-trace__prompt-label--out" }, t("modelOutput")), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-preview" }, truncate((row.text ?? "").replace(/\s+/g, " "), 110)));
	if (row.kind === "tool") return /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className,
		onClick: select,
		"aria-pressed": selected
	}, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-name" }, row.name ?? "tool"), /* @__PURE__ */ react.createElement("span", { className: `dsh-trace__call-status${row.status === "failed" ? " dsh-trace__call-status--err" : ""}` }, statusText(row, t)), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-meta" }, fmtDuration(row.duration, row.approx === true)), summarizeArgs(row.args) !== "" ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-preview" }, summarizeArgs(row.args)) : null);
	return /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className,
		onClick: select,
		"aria-pressed": selected
	}, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-name" }, t("llm")), /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__call-meta",
		title: t(`modelSource_${row.modelSource ?? "none"}`)
	}, row.model ?? t("modelPending"), row.modelSource === "inherited" ? " ~" : ""), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-meta" }, fmtDuration(row.duration)), row.say !== void 0 && row.say !== "" ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__call-preview" }, truncate(row.say.replace(/\s+/g, " "), 90)) : null);
}
/** Right-hand inspector: overview, arguments, result, provenance. */
function Inspector(props) {
	const { row, turns, sessionId, currency, fx, t, onClose } = props;
	if (row === null) return null;
	const tokens = (row.input ?? 0) + (row.cacheRead ?? 0) + (row.cacheWrite ?? 0);
	const anchor = turns.find((turn) => turn.turn === row.turn)?.startTime ?? null;
	return /* @__PURE__ */ react.createElement("aside", { className: "dsh-trace__inspector" }, /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__insp-head" }, /* @__PURE__ */ react.createElement("span", { className: `dsh-trace__badge dsh-trace__badge--${row.kind}` }, row.kind), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-title" }, row.name ?? row.model ?? "detail"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "dsh-trace__btn",
		onClick: onClose,
		title: "Close"
	}, "✕")), /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("overview")), /* @__PURE__ */ react.createElement("dl", { className: "dsh-trace__insp-grid" }, /* @__PURE__ */ react.createElement("dt", null, t("position")), /* @__PURE__ */ react.createElement("dd", null, describeLocation(row, turns)), /* @__PURE__ */ react.createElement("dt", null, t("eventTime")), /* @__PURE__ */ react.createElement("dd", { title: isoTitle(row.time) }, fmtClock(row.time), " ", /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-mono" }, localZone()), anchor !== null ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-mono" }, " · ", t("fromTurnStart", { duration: fmtDuration(row.time - anchor) })) : null), row.duration != null ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("dt", null, t("duration")), /* @__PURE__ */ react.createElement("dd", null, fmtDuration(row.duration, row.approx === true), row.approx === true ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-mono" }, " (", t("durationApprox"), ")") : null)) : null, row.kind === "llm" ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("dt", null, t("model")), /* @__PURE__ */ react.createElement("dd", null, row.model ?? "—", row.modelAlt !== void 0 ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-mono" }, " → ", row.modelAlt) : null, " ", /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__insp-mono" }, "(", t(`modelSource_${row.modelSource ?? "none"}`), ")")), /* @__PURE__ */ react.createElement("dt", null, t("tokens")), /* @__PURE__ */ react.createElement("dd", null, t("tokensIn", { n: fmtTokens(tokens) }), " · ", t("tokensOut", { n: fmtTokens(row.output) })), /* @__PURE__ */ react.createElement("dt", null, t("cost")), /* @__PURE__ */ react.createElement("dd", null, money(row.cost, currency, fx)), row.cacheRead !== void 0 && row.cacheRead > 0 ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("dt", null, t("cache")), /* @__PURE__ */ react.createElement("dd", null, t("cacheHit", { tokens: fmtTokens(row.cacheRead) }), " ·", " ", t("cacheSaved", { money: money(row.cacheSaved ?? 0, currency, fx) }))) : null) : null, row.kind === "tool" ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("dt", null, t("status")), /* @__PURE__ */ react.createElement("dd", null, statusText(row, t))) : null)), row.text !== void 0 && row.text !== "" ? /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, row.kind === "user" ? t("userInput") : t("modelOutput")), /* @__PURE__ */ react.createElement("pre", { className: `dsh-trace__insp-pre${row.kind === "user" ? "" : " dsh-trace__insp-pre--out"}` }, row.text)) : null, row.say !== void 0 && row.say !== "" ? /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("modelOutput")), /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__insp-pre dsh-trace__insp-pre--out" }, row.say)) : null, row.thinking !== void 0 && row.thinking !== "" ? /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("thinking")), /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__insp-pre" }, row.thinking)) : null, row.args !== void 0 && row.args !== "" ? /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("args")), /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__insp-pre" }, prettyArgs(row.args))) : null, row.result !== void 0 && row.result !== "" ? /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("result")), /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__insp-pre dsh-trace__insp-pre--out" }, row.result)) : null, /* @__PURE__ */ react.createElement("section", { className: "dsh-trace__insp-section" }, /* @__PURE__ */ react.createElement("h4", { className: "dsh-trace__insp-h" }, t("source")), /* @__PURE__ */ react.createElement("dl", { className: "dsh-trace__insp-grid" }, /* @__PURE__ */ react.createElement("dt", null, t("session")), /* @__PURE__ */ react.createElement("dd", { className: "dsh-trace__insp-mono" }, sessionId), /* @__PURE__ */ react.createElement("dt", null, t("node")), /* @__PURE__ */ react.createElement("dd", { className: "dsh-trace__insp-mono" }, row.key), row.callId !== void 0 ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("dt", null, t("callId")), /* @__PURE__ */ react.createElement("dd", { className: "dsh-trace__insp-mono" }, row.callId)) : null)));
}
/** One turn: collapsed row, then its steps when open. */
function TurnSection(props) {
	const { turn, rows, currency, fx, open, selectedKey, outputRow, t, onToggle, onSelect } = props;
	const topCost = turn.steps.reduce((max, step) => Math.max(max, step.cost), 0);
	const span = turn.endTime - turn.startTime;
	const spanValid = turn.endTime > turn.startTime && span < 864e5;
	const stepSum = turn.steps.reduce((sum, step) => sum + step.duration, 0);
	const durationLabel = spanValid ? t("took", { duration: fmtDuration(span) }) : stepSum > 0 ? `~${t("took", { duration: fmtDuration(stepSum) })}` : `${t("took", { duration: "—" })}`;
	const stepRows = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (row.kind !== "llm" && row.kind !== "tool") continue;
		if (row.step === null) continue;
		const list = stepRows.get(row.step) ?? [];
		list.push(row);
		stepRows.set(row.step, list);
	}
	return /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__turn" }, /* @__PURE__ */ react.createElement("button", {
		className: "dsh-trace__turn-head",
		onClick: onToggle,
		"aria-expanded": open
	}, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__chev" }, open ? "▾" : "▸"), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__turn-title" }, t("turn", { n: turn.index })), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__turn-meta" }, t("stepsCount", { n: turn.steps.length })), /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__turn-meta",
		title: `${fmtClock(turn.startTime)} → ${fmtClock(turn.endTime)}`
	}, durationLabel), /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__turn-cost" }, money(turn.cost, currency, fx), turn.cacheSaved > 0 ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__turn-saved" }, " · ", t("saved", { money: money(turn.cacheSaved, currency, fx) })) : null), turn.running ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__live-dot" }) : null), open ? /* @__PURE__ */ react.createElement("div", {
		className: "dsh-trace__turn-body",
		style: TURN_BODY_STYLE
	}, rows.filter((row) => row.kind === "user").map((row) => callRow({
		row,
		selected: row.key === selectedKey,
		onSelect,
		t
	})), outputRow !== null ? callRow({
		row: outputRow,
		selected: outputRow.key === selectedKey,
		onSelect,
		t
	}) : null, turn.steps.map((step) => /* @__PURE__ */ react.createElement("div", {
		key: `${turn.turn}-${step.step}`,
		className: "dsh-trace__step"
	}, /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__step-head" }, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__step-badge" }, t("step", {
		index: step.index,
		total: step.total
	})), step.cost === topCost && topCost > 0 ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__step-top" }, t("priciest")) : null, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__step-cost" }, money(step.cost, currency, fx)), step.llmCalls > 0 ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__step-meta" }, stepTokens(step)) : null, cacheBreak(step) ? /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__step-warn",
		title: t("cacheMissTitle", { tokens: fmtTokens(step.input) })
	}, t("cacheMiss")) : null, step.cacheSaved > 0 ? /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__step-meta" }, t("perStepSaved", { money: money(step.cacheSaved, currency, fx) })) : null), (stepRows.get(step.step) ?? []).map((row) => callRow({
		row,
		selected: row.key === selectedKey,
		onSelect,
		t
	}))))) : null);
}
/** The registered `conversation.view` entry. */
/** Critical layout, inline: a cached or blocked stylesheet must not break scrolling. */
const ROOT_STYLE = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
	minHeight: 0,
	overflow: "hidden"
};
const BODY_STYLE = {
	display: "flex",
	gap: 10,
	flex: "1 1 auto",
	minHeight: 0
};
const LIST_STYLE = {
	flex: "1 1 auto",
	minHeight: 0,
	overflowY: "auto",
	paddingRight: 4,
	paddingBottom: 24
};
/** One scroll container only: the ledger. A turn body just grows. */
const TURN_BODY_STYLE = {
	display: "flex",
	flexDirection: "column",
	gap: 6
};
function TurnsView(props) {
	return /* @__PURE__ */ react.createElement(TurnsBoundary, null, /* @__PURE__ */ react.createElement(TurnsBody, { props }));
}
function TurnsBody({ props }) {
	const chat = useChatSnapshot(props);
	const t = useTranslate(props);
	const [currency, setCurrency] = (0, react.useState)(readCurrency);
	const [fx] = (0, react.useState)(readFx);
	const [expanded, setExpanded] = (0, react.useState)({});
	const [selectedKey, setSelectedKey] = (0, react.useState)(null);
	const [pageState, setPageState] = (0, react.useState)(0);
	const rootRef = (0, react.useRef)(null);
	const listRef = (0, react.useRef)(null);
	react.useEffect(() => {
		const list = listRef.current;
		const element = rootRef.current;
		if (list === null || element === null) return;
		const onWheel = (event) => {
			const target = event.target;
			if (!(target instanceof Node) || !element.contains(target)) return;
			if (Math.abs(event.deltaY) < 1) return;
			const before = list.scrollTop;
			window.requestAnimationFrame(() => {
				if (list.scrollTop !== before) return;
				const max = list.scrollHeight - list.clientHeight;
				if (max <= 0) return;
				const next = before + event.deltaY;
				if (next < 0 || next > max) return;
				list.scrollTop = next;
			});
		};
		window.addEventListener("wheel", onWheel, {
			capture: true,
			passive: true
		});
		return () => window.removeEventListener("wheel", onWheel, { capture: true });
	}, []);
	const PAGE_SIZE = 10;
	const historyWindow = typeof props.useSession === "function" ? props.useSession((snapshot) => ({
		hasMore: snapshot.hasMore,
		loadingOlder: snapshot.loadingOlder
	})) : {
		hasMore: false,
		loadingOlder: false
	};
	const sessionModel = useSessionModel(props);
	const fold = (0, react.useMemo)(() => chat === null ? null : foldChat(chat, sessionModel), [chat, sessionModel]);
	if (fold === null) return /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__diag" }, t("missingChat"), "\n", t("missingChatHint", {
		useChat: typeof props.useChat,
		useConversation: typeof props.useConversation
	}), "\n", "props=[", Object.keys(props).join(", "), "]", "\n", "build=", BUILD_MARKER);
	const newestFirst = [...fold.turns].reverse();
	const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
	const page = Math.min(pageState, pageCount - 1);
	const pageTurns = newestFirst.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
	const total = fold.turns.reduce((sum, turn) => sum + turn.cost, 0);
	const totalSaved = fold.turns.reduce((sum, turn) => sum + turn.cacheSaved, 0);
	const rowsByTurn = /* @__PURE__ */ new Map();
	for (const row of fold.rows) {
		if (row.turn === null) continue;
		const list = rowsByTurn.get(row.turn) ?? [];
		list.push(row);
		rowsByTurn.set(row.turn, list);
	}
	const outputRows = fold.turns.map((turn) => {
		const says = fold.rows.filter((row) => row.turn === turn.turn && row.kind === "llm" && (row.say ?? "") !== "");
		if (says.length === 0) return null;
		const time = says.reduce((max, row) => Math.max(max, row.time), 0);
		return {
			key: `out:${turn.turn}`,
			kind: "output",
			time,
			turn: turn.turn,
			step: null,
			text: says.map((row) => row.say ?? "").join("\n\n"),
			status: "ok"
		};
	}).filter((row) => row !== null);
	const outputsByTurn = new Map(outputRows.map((row) => [row.turn, row]));
	const selectedRow = selectedKey === null ? null : fold.rows.find((row) => row.key === selectedKey) ?? outputRows.find((row) => row.key === selectedKey) ?? null;
	const goto = (target) => {
		if (target < 0) return;
		const move = (next) => {
			setPageState(next);
			if (listRef.current !== null) listRef.current.scrollTop = 0;
		};
		if (target < pageCount) {
			move(target);
			return;
		}
		props.loadOlder?.().then(() => move(target));
	};
	const toggleCurrency = () => {
		const next = currency === "USD" ? "CNY" : "USD";
		setCurrency(next);
		store(CUR_KEY, next);
	};
	return /* @__PURE__ */ react.createElement("div", {
		className: "dsh-trace",
		ref: rootRef,
		style: ROOT_STYLE
	}, /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__bar" }, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__total" }, t("turnsCount", { n: fold.turns.length }), " · ", /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__total-cost" }, money(total, currency, fx)), totalSaved > 0 ? /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__total-saved",
		title: t("cacheSavedTotalTitle")
	}, " ", "· ", t("cacheSavedTotal", { money: money(totalSaved, currency, fx) })) : null), fold.unpriced > 0 ? /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__hint",
		title: t("unpricedTitle")
	}, t("unpriced", { n: fold.unpriced })) : null, fold.inferred > 0 ? /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__hint",
		title: t("inferredTitle")
	}, t("inferred", { n: fold.inferred })) : null, /* @__PURE__ */ react.createElement("span", { className: "dsh-trace__spacer" }), /* @__PURE__ */ react.createElement("span", {
		className: "dsh-trace__version",
		title: "bundle version"
	}, "v", BUILD_MARKER), /* @__PURE__ */ react.createElement("button", {
		className: "dsh-trace__btn",
		onClick: () => {
			setExpanded({});
			setSelectedKey(null);
		},
		disabled: Object.keys(expanded).length === 0,
		title: t("collapseTitle")
	}, t("collapse")), /* @__PURE__ */ react.createElement("button", {
		className: "dsh-trace__btn",
		onClick: toggleCurrency,
		title: t("currencyTitle", { fx })
	}, currency)), /* @__PURE__ */ react.createElement("div", {
		className: "dsh-trace__body",
		style: BODY_STYLE
	}, /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__main" }, fold.turns.length > 0 ? /* @__PURE__ */ react.createElement("div", { className: "dsh-trace__pager" }, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "dsh-trace__page-btn",
		disabled: page <= 0 || historyWindow.loadingOlder,
		onClick: () => goto(page - 1)
	}, "< ", t("newer")), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "dsh-trace__page-btn",
		disabled: historyWindow.loadingOlder || page >= pageCount - 1 && !historyWindow.hasMore,
		onClick: () => goto(page + 1)
	}, t("older"), " >")) : null, fold.turns.length === 0 ? /* @__PURE__ */ react.createElement("pre", { className: "dsh-trace__diag" }, t("emptySession"), "\n", fold.note ?? describeChat(chat), "\n", "useChat=", typeof props.useChat, " · useConversation=", typeof props.useConversation, " · sessionId=", String(props.sessionId), "\n", "build=", BUILD_MARKER) : /* @__PURE__ */ react.createElement("div", {
		className: "dsh-trace__list",
		ref: listRef,
		style: LIST_STYLE
	}, pageTurns.map((turn) => /* @__PURE__ */ react.createElement(TurnSection, {
		key: turn.turn,
		turn,
		rows: rowsByTurn.get(turn.turn) ?? [],
		currency,
		fx,
		open: expanded[turn.turn] === true,
		selectedKey,
		outputRow: outputsByTurn.get(turn.turn) ?? null,
		t,
		onToggle: () => setExpanded((prev) => prev[turn.turn] === true ? {} : { [turn.turn]: true }),
		onSelect: (key) => setSelectedKey((prev) => prev === key ? null : key)
	})))), /* @__PURE__ */ react.createElement(Inspector, {
		row: selectedRow,
		turns: fold.turns,
		sessionId: String(props.sessionId),
		currency,
		fx,
		t,
		onClose: () => setSelectedKey(null)
	})));
}
/**
* Hard dependency: the slot ring. Locale and model directories are read
* defensively through `ctx.get`, because a missing injected service makes the
* entry fail to activate — and the shell treats that as a boot error.
*/
const inject = ["slots"];
let stylesInstalled = false;
/** Inject the stylesheet once per page (a bundle may be rematerialized). */
function ensureStyles() {
	if (stylesInstalled) return;
	stylesInstalled = true;
	if (typeof document === "undefined") return;
	if (document.querySelector("style[data-dsh-turn-trace]") !== null) return;
	const style = document.createElement("style");
	style.setAttribute("data-dsh-turn-trace", "");
	style.textContent = TRACE_CSS;
	document.head.appendChild(style);
}
/**
* Register the Turns tab.
* @param ctx - client plugin context carrying the slot service.
*/
function apply(ctx) {
	try {
		activate(ctx);
	} catch (error) {
		console.error("[dsh-turn-trace] activation failed; the Turns tab stays off", error);
	}
}
function activate(ctx) {
	ensureStyles();
	const host = ctx;
	const getService = (name) => {
		try {
			return typeof host.get === "function" ? host.get(name) : void 0;
		} catch {
			return;
		}
	};
	const slots = getService("slots");
	if (slots === void 0) {
		console.warn("[dsh-turn-trace] slot service unavailable; the Turns tab stays off");
		return;
	}
	const getLocale = () => getService("locale");
	let registered = false;
	const ensureDictionaries = () => {
		if (registered) return;
		const locale = getLocale();
		if (locale === void 0) return;
		registered = true;
		try {
			locale.register(NS, {
				en: EN,
				zh: ZH
			});
		} catch (error) {
			console.warn("[dsh-turn-trace] dictionary registration skipped", error);
		}
	};
	ensureDictionaries();
	const modelDirectories = () => getService("modelDirectories");
	const loadOlder = async (sessionId) => {
		try {
			await getService("sessions")?.binding?.(sessionId)?.session?.loadOlder?.();
		} catch (error) {
			console.warn("[dsh-turn-trace] loadOlder failed", error);
		}
	};
	slots.inject("conversation.view", () => slots.register({
		name: "conversation.view",
		id: "turns",
		order: 20,
		locale: NS,
		label: () => {
			try {
				ensureDictionaries();
				return makeTranslate(getLocale())("tab");
			} catch {
				return "Turns";
			}
		}
	}, (props) => react.createElement(TurnsView, {
		...props,
		modelDirectories,
		getLocale,
		ensureDictionaries,
		loadOlder: () => loadOlder(String(props.sessionId))
	})));
}
exports.TurnsView = TurnsView;
exports.apply = apply;
exports.inject = inject;

    return module.exports;
  },
});
