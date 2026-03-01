// ─────────────────────────────────────────────────────────────────────────────
// trust.js — shared trust score badge utility
//
// Score tiers:
//   0–10   → gray  (default, no modifier)
//   11–50  → green
//   51–100 → blue
//   101+   → gold  (with CSS glow)
// ─────────────────────────────────────────────────────────────────────────────

export function trustClass(score) {
  if (score >= 101) return 'trust-badge--gold'
  if (score >= 51)  return 'trust-badge--blue'
  if (score >= 11)  return 'trust-badge--green'
  return ''  // 0–10: gray default
}
