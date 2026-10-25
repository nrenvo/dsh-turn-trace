/**
 * dsh-turn-trace — package-owned stylesheet.
 *
 * Only references DSH theme tokens (`--dsw-alias-*`) so the ledger and its
 * inspector adapt to light and dark themes without global overrides.
 */
export const TRACE_CSS = `
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
`
