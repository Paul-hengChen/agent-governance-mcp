# Review — T-E319-01

Round 1 — APPROVED — by code-reviewer (opus)

## Summary
- Commit 4883dfa changes `parseDesignMode` (`gates/visual.ts`). It now returns the known mode with the lowest word-boundary match index on the candidate line, where it used to return the first mode in `KNOWN_MODES` list order. It also rewrites the stale "first-match over the enum is safe" comment and rebuilds `dist/gates/visual.*`.
- Candidate-line selection (inline regex first, then H2) and both regexes are unchanged. Neither consumer (`hasDesignModeRequiringVisual`, `checkSourceCredibility`) is touched.
- Verdict: APPROVED.

## AC Completeness
AC-E319-1 — implemented (code) — gates/visual.ts:123-135. Probe through dist: `**Mode** — image (no Figma)` → `"image"`. QA owns the test case in `test/source-credibility-gate.test.mjs`.
AC-E319-2 — implemented (code) — same lines. Probe: `mode: no-design (no Figma)` → `"no-design"`, so `required` is false. QA owns the test case.
AC-E319-3 — implemented (code) — the one function serves both consumers. Probe through `hasDesignModeRequiringVisual`: `## Mode\n\nimage (no Figma)` → `"image"`. QA owns the per-consumer cases.
AC-E319-4 — implemented — :127-133 (lowest `m.index` wins; on a tie the earlier enum entry is kept because the comparison is a strict `<`, but no two known modes can match at the same index). `no-design` cannot lose to a bare `design`, because `design` is not a listed mode.
AC-E319-5 — implemented — probe: `mode: no-design` → no-design; `- **Mode** — figma` → figma; `` **Mode** — `penpot` `` → penpot; `` **Mode** — `pdf` — exported from Figma `` → pdf; `## Mode` with the value on the next line → parsed; `mode: something else` → null. `test/visual-evidence-gate.test.mjs` and `test/source-credibility-gate.test.mjs` pass unmodified (part of the 127/127 run).
AC-E319-6 — implemented — only `gates/visual.ts` and `dist/gates/visual.{js,js.map,d.ts.map}` changed under `gates/` + `dist/gates/`. The stale comment is replaced (:100-105). Dist parity: a fresh `tsc --outDir <scratch>` is byte-identical to the committed `dist/gates/visual.js` / `.d.ts`. The `.map` files differ only in the `sources` path because of the different outDir, and all other map fields are equal. No other dist file drifts.

## Correctness
No findings. The behaviour change is limited to lines that mention more than one known mode. Such a line now resolves to the leftmost mode. For example, `mode: Figma export, delivered as image` gives `figma` (before the change: `figma`), and `mode: paper / figma` gives `paper` (before: `figma`). This is the rule the spec chose in AC-E319-4.

## Quality
- Comment check (SOP 4b): `agc check` raises two warnings on this file that the diff introduced:
  - `gates/visual.ts:98` long-block 8 lines (limit 7; base was 5). **Kept:** the extra lines state the selection rule and the E319 reason it exists, which is exactly the contract the stale comment got wrong.
  - `gates/visual.ts` high-ratio 30.3% (limit 30%). **Kept:** the margin is 0.3 pp and comes from the same block plus the 2-line inline note at :125-126. (optional) Dropping the inline note, which repeats the block comment's `no-design` point, would bring the file back under the limit.
- The variable `best` and the `{ mode, index }` shape are clear and match the file's style.

## Architecture
There is no architecture spec. The fix is in the shared parser, so both call sites (:88 and the source-credibility call) are fixed without consumer-side edits, as AC-E319-6 requires.

## Security
No findings. The regex sources are built from the constant `KNOWN_MODES` (only `-` is escaped, and no other metacharacters appear in the enum). There is no new untrusted input, and the regex has no backtracking risk.

## Performance
No findings. At most 8 regex execs per candidate (2 candidates at most), and only on gate evaluation. Before, the scan could short-circuit, so this is negligible.

## Verdict
APPROVED. AC-E319-4..6 are implemented, AC-E319-1..3 hold by probe (QA writes the resident tests), and dist matches source.

Note: this review ran on the same model tier (opus) as sr-engineer, so same-model bias is possible.
