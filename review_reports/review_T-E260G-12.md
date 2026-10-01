# Review — T-E260G-12

Round 1 — CHANGES_REQUESTED — by code-reviewer (opus). Commit `9bc587a`; files `test/error-code-contract`, `eval-assertions`, `evidence-provenance` (`.test.mjs`).

## Summary
- 22 long blocks (269 counted lines) were trimmed, 19 of them in error-code-contract. That file's parsing code, regexes and FREE_TEXT_ALLOWLIST entries are byte-identical (emit and tokens are both 0 differ).
- The rationale sections for error-code-contract and eval-assertions keep the moved contract list, suffix list, union-membership notes and code-side source set. evidence-provenance points to its own spec instead.
- One trimmed comment now cites an untracked path, which AC7 forbids.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — proof `emit: 0 differ`
AC2 — implemented — proof `tokens`/`directives` ok
AC3 — implemented — proof `scope: ok`
AC4 — implemented — proof `>20: 0`
AC5 — implemented — no 8-20 block remains (table below)
AC6 — implemented — pointer lines error-code-contract:6, eval-assertions:6; evidence-provenance:6 cites `specs/qa-visual-baseline-provenance.md`
AC7 — **partial** — `bare-id: 0`, but test/error-code-contract.test.mjs:317 cites the untracked path `gates/registry.js` (finding below). The widened id-only scan has no hit.
AC8 — implemented — `form: ok`
AC9 — not judged here — lane-level

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
- **required** — test/error-code-contract.test.mjs:317 — "since it imports the real gates/registry.js (AC-5)". `gates/registry.js` is not a tracked path. The file imports `dist/gates/registry.js`, and the source is `gates/registry.ts`. The base text cited `gates/registry.ts`, so the trim turned a tracked citation into an untracked one. Fix: "the built dist/gates/registry.js".
- recommended — test/error-code-contract.test.mjs:2-4 — "The three code sets must agree". The tests assert registry == source harvest (:145), docs ⊆ registry (:172), and documentedInProse entries ⊆ docs (:185). Equality with docs holds today only because all 33 entries are `documentedInProse: true`. The rationale (spec :149-151) states it correctly ("a subset of the registry"). Suggested wording: "registry and source codes must match, doc codes must be a subset of the registry".
- Other rewritten comments I checked against code: the SUFFIX_RE note (:37-39), BACKTICK_TOKEN_RE (:91-93), the 33-count pin (:117-118, assertion :121-125), the DR-8 union (16 members, :238-242), the AC2 extraction helpers and the edge-pair note (EDGE_RE needs a bare role), the doc-file mapping parse, the AC3 allowlist closure, and every FREE_TEXT_ALLOWLIST rationale (each named predicate — prevState, checkSourceCredibility, hasProofAnnotatedAC, classifyLeaseOverride, isHandAuthoredStamp, hasStampRemediationAudit, hasEvidenceInFile — matches what the base text named). eval-assertions :2-5 and :144-145, evidence-provenance :2-6. All accurate.

## Quality
No findings beyond the above. Trailing ids such as "(DR-8, DR-9)" and "(AC-1, AC-5, E40)" follow plain words, which the rule allows.

## Architecture
No architecture spec; comment-only change.

## Security
No findings.

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED — error-code-contract:317 cites the untracked path `gates/registry.js` (AC7), a one-word fix.
