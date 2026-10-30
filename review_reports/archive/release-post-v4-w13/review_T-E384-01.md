# Review — T-E384-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- `gates/visual.ts` `parseDesignMode` now reads the declared token of each candidate line first: a known token returns itself, `<known>-…` returns that mode (`no-design` tried first), any other token makes the candidate yield nothing and the next candidate is tried, and a line with no token keeps the pre-E384 earliest-known-mode scan (E319).
- The diff touches only the doc comment above `KNOWN_MODES` and the body of `parseDesignMode` (`git diff 35f20e2...HEAD -- gates/visual.ts`); `KNOWN_MODES`, both regexes and every other function are unchanged. `dist/gates/visual.js` is byte-identical to a fresh `tsc` build of HEAD.
- Containment: `git diff --quiet 35f20e2...HEAD -- tools/fanout-manifest.ts gates/registry.ts schema content package.json test` exits 0. `fanout check … e384 --base 35f20e2` exits 0 (0 out of bounds).
- Regression suites `source-credibility-gate` and `visual-evidence-gate` pass unmodified (part of the 131/131 run below).
- Verdict: APPROVED. One recommended and two optional findings, none blocking.
- Same-model note: this review ran on opus, the same tier sr-engineer was pinned to. Same-model bias is possible; the 28 ad-hoc grammar probes below were chosen to offset it.

## AC Completeness
AC-E384-1 — implemented — gates/visual.ts:136-143 (`code (not from Figma)` and the inline `mode: code — screenshots, not Figma` both give mode null, required false; probe confirmed).
AC-E384-2 — implemented — gates/visual.ts:134-143 (H2 `## Mode` / `code (no Figma export)` gives null; probe confirmed).
AC-E384-3 — implemented — gates/visual.ts:136-142 (strip set `` \s ` * _ " ' ( [ ``, token regex and whole-token compare match the spec; `` `figma` ``, `**sketch**`, `MODE: SKETCH`, `(xd)`, `"pdf"`, `figma-export`, `no-design-v2` resolve as specified; `code`, `code-figma`, `freehand`, `figmaexport` give null; probe confirmed).
AC-E384-4 — implemented — existing suites pass unmodified; E319 cases (`image (no Figma)`, `no-design (no Figma)`, `paper / figma`, `` `pdf` — exported from Figma ``, `freehand`) re-probed and still resolve as before.
AC-E384-5 — implemented — gates/visual.ts:144-153 (`mode: <figma> (see board)` has no token, so the earliest-known scan gives figma; probe confirmed).
AC-E384-6 — implemented — gates/visual.ts:142 `continue` (H2 `figma` plus a later `- mode: dark` gives figma; also `- mode: dark (not figma)` before `## Mode` / `no-design` now gives no-design).
AC-E384-7 — implemented — hunks confined to the doc comment above `KNOWN_MODES` and `parseDesignMode`; no registry, schema or content change.

The new test file (`test/e384-design-mode-declared.test.mjs`) is QA scope (T-E384-02) and is not part of this diff. The ACs above were verified with an ad-hoc probe through `hasDesignModeRequiringVisual` in a temp workspace (28/28 cases as expected).

## Correctness
No required findings.
- Behaviour shift, accepted: a declared value written as prose that does not start with a known mode (for example `mode: Design from Figma`) used to resolve to figma and now gives null, so the visual and source-credibility gates no longer arm for it. The spec Decisions table accepts this (an unknown declared value means undeclared), and the integrator's prefix amendment covers the main fail-open risk (`figma-export`).
- `mode: Figma_export` gives figma, because `_` ends the token. That follows the AC-E384-3 grammar and matches the base result.
- [optional] gates/visual.ts:132: the `no-design`-first `prefixOrder` currently has no effect, because no other known mode can be a prefix of a `no-design-…` token. Kept: the spec requires the order, and it protects future modes.

## Quality
- [recommended] gates/visual.ts:99-112: the doc comment grew from 6 to 14 lines and now triggers a new `agc check — comments` long-block warning (limit 7). Most of it restates the AC-E384-3 grammar, which is HOW-level text under Constitution §6. Kept for this round because it is the parser's input contract for callers and design-auditor authors, and the cut asked for the doc comment update. On the next touch, trim it to a summary plus a one-line pointer to `specs/e384-design-mode-and-handoff-target.md` AC-E384-3. The file-level high-ratio warning was already present at base (about 30.4% then, 30.8% now).
- [optional] gates/visual.ts:116-119: the unchanged in-body comment still says the parser "pull[s] the first known-mode token" from the Mode line. That no longer describes the declared-token rule. Reword it, or drop it in favour of the doc comment.
- The two added in-body comments (lines 130-131 and 141) are one-liners that state WHY. Acceptable.

## Architecture
There is no `specs/<feature>-architecture.md`. The fix stays inside the private parser, both exported entry points (`checkSourceCredibility`, `hasDesignModeRequiringVisual`) are unchanged, and the parser still never throws, which matches the spec Decision that rules out a loud error.

## Security
No findings. The regexes are anchored with bounded alternation, so there is no catastrophic backtracking (`(?:-[a-z0-9]+)*` cannot overlap with `[a-z0-9]*`). Input is a workspace design file, the same as at base.

## Performance
No findings. `prefixOrder` is an 8-element array built once per call, with at most 2 candidates. No regression against base.

## Verdict
APPROVED — the declared-token rule matches AC-E384-1..7 and the cut exactly, with E319 behaviour preserved; the comment-length finding is non-blocking.
