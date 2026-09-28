# Review — T-E9A-04 (e9a-stamp-integrity)

covers: T-E9A-01, T-E9A-02, T-E9A-03

## Summary
- Reviews the uncommitted working-tree diff for T-E9A-01..03 against `specs/e9a-stamp-integrity.md` (clean-context: diff + spec + forensics only).
- Three substantive files: `content/skill-release-engineer.md` (new CRITICAL no-MCP-path relay Hard rule + amended Output rule), `templates/claude-code-agents/release-engineer.md` (matching CRITICAL paragraph), `tools/drift.ts` (purely-additive `stampAdvisory: string | null` on the `tw_detect_drift` result). Plus the three compiled `dist/tools/drift.*` artifacts (expected `tsc` output).
- Purely-additive claim on `tw_detect_drift` **verified**: `driftDetected`/`details`/`handoffLastTask`/`tasksCompleted`/`tasksIncomplete` byte-identical; no `GateErrorCode`; no gate/orchestrator/`index.ts` change; only external consumer (`tools/registry.ts` handler) passes the JSON through unchanged.
- All spec ACs met (AC1/AC2 content present & byte-identifiable; AC3/AC4 regex behavior correct; AC5 the three existing drift suites pass unmodified). AC1/AC2/AC3/AC4 `proof:` test authoring is QA scope (T-E9A-05) per §2 — correctly deferred by sr-engineer.
- The sr-flagged unquoted-YAML-`Date` evasion is a real but narrow gap, judged **acceptable / out-of-scope** per the spec's advisory-only, string-field-modeled framing (rationale under Correctness).
- Verdict: **APPROVED**.

## Correctness
No blocking findings.

- **Regex `/T\d{2}:\d{2}:00\.000Z$/` (`tools/drift.ts:36`)** is correct against the forensics. Verified it matches all 5 confirmed hand-authored stamps — `…T01:35:00.000Z`, `…T04:35:00.000Z`, `…T12:00:00.000Z` (round hour), `…T08:30:00.000Z` (round half-hour), `…T00:00:00.000Z` (midnight seed); round-hour / round-half-hour are proper subsets of "seconds 00 + ms 000", as the comment claims. AC3 fixture `2026-07-12T01:35:00.000Z` → matches (non-null). AC4 ms-entropy fixture `2026-07-13T03:22:38.181Z` → no match (null). ✓
- **Threading (AC3 control / purely-additive)** is correct: the three pre-`handoff` early returns (version-skew `drift.ts:204`, `!handoff && !tasks` `:219`, `!handoff` `:230`) each return `stampAdvisory: null`; `stampAdvisory` is computed once at `:238` immediately after `handoff` is confirmed non-null; and threaded into the "no tasks" branch (`:247`) and the main return (`:328`). No other field in any return path changed. ✓
- **No runtime type hazard**: `computeStampAdvisory` receives `handoff.last_updated`, which `tools/handoff.ts:436` guarantees is a `string` via `asString()` (a non-string YAML value is coerced with `String(v)`, never left as an object). `.test()` cannot be called on a non-string here. ✓
- **sr-flagged unquoted-YAML-`Date` evasion — REAL but ACCEPTABLE / out-of-scope.** If `last_updated` were written *unquoted* in the frontmatter, js-yaml's default schema parses the ISO scalar to a JS `Date`, and `asString(date)` yields a locale string (`"Sat Jul 12 2026 …"`) that the regex cannot match → advisory silently `null`. I confirmed this path exists. I judge it out-of-scope, not CHANGES_REQUESTED, on five grounds: (1) the spec Architecture note explicitly models `last_updated` as a *string* field and pins the regex on the string; AC3/AC4 fixtures are quoted strings. (2) The server write path always quotes (`handoff.ts:1102`, `forceQuotes: true`), so every legitimately-produced stamp is a quoted string. (3) I verified all 5 historical hand-edits were themselves **quoted** (`git show d74e255/8baf136/3c5eda9 :.current/handoff.md`) — the modeled threat (a fatigue-improvised hand-edit copying the file's existing quoted format) produces a quoted string that the advisory *does* catch. (4) The advisory is explicitly best-effort audit signal, not a rejection path or security control — the spec's Out of Scope excludes hard-rejecting client-shaped timestamps outright. (5) E1A's negative-age guard (`gates/feature-lease.ts`) already fail-opens on any untrustworthy stamp, so no safety margin depends on the advisory. The `asString`→locale-string behavior is pre-existing parser behavior (also underlying D5 `dispatched_at` / E1A age), not introduced by this change. Worth a one-line note in the E9A follow-up backlog, not a blocker.

## Quality
No blocking findings.

- Naming (`HAND_AUTHORED_STAMP_RE`, `computeStampAdvisory`), placement (constant + helper co-located above `detectDrift`, field on the existing `DriftReport` interface), and the block-comment convention match the surrounding `drift.ts` style (mirrors `DRIFT_COMPRESS_THRESHOLD` / `checkVersionSkew`). ✓
- Skill rule text is internally consistent with existing content: the new CRITICAL rule (no-MCP-*path* → relay) does not contradict the existing "STOP on ⛔ rejection" bullet (which governs the *have-a-path-but-rejected* case — STOP), the D10 push-rejection bullet (git recovery, orthogonal), or the C13 first-class-transition bullet (which assumes a reachable MCP path; the relay preserves `agent_id="release-engineer"`, keeping the C13 audit trail intact). The amended Output rule aligns with SOP step 13's read-back. ✓
- **4-of-5 forensics claim is accurate, not overstated.** The skill rule's "4 of the 5 confirmed hand-authored stamps came from sessions with no legal MCP write path" matches both the forensics (4 release-close events + 1 pre-hardening seed) and the spec's own "4 of the 5" framing (spec L81). The "no legal MCP write path" characterization is defensible: v3.48.0/v3.49.0 predate C13 (no legal transition at all); v3.72.0/v3.73.1 are the tool-surface-limited subagent class the 2026-07-13 datapoint proved. ✓

## Architecture
Conforms to the spec's Architecture note (in lieu of a separate ARCH ticket, same shape as E7/E13). Field added to the existing `DriftReport` interface; computed once post-`handoff`-confirmation; no storage-mode scoping (justified — `last_updated` is universally populated by both `HandoffStorage` implementations via the same server write path); a new independent field rather than folding into `details` (correctly avoids flipping `driftDetected` and avoids forcing every existing `assert.deepEqual(report.details, …)` to enumerate it). No new `gates/` wiring, no orchestrator change. ✓

## Security
No findings. The advisory is read-only audit signal on an already-parsed field; introduces no new input trust boundary, no injection surface, no secret. The rule text hardens the audit trail (relay instead of hand-edit) rather than weakening it. ✓

## Performance
No findings. One `RegExp.test()` per `detectDrift` call on a short string, computed once (not in a loop). No hot-path or algorithmic-class change vs base. ✓

## Verdict
**APPROVED** — the diff satisfies every in-scope AC; the `tw_detect_drift` change is verifiably purely-additive; the rule text is consistent with existing skill content and does not overstate the forensics; the template's pinned watermark and example-suffix blocks are untouched; and the sr-flagged unquoted-YAML-`Date` evasion is an acceptable out-of-scope limitation of an explicitly advisory-only check.

### Reviewer notes for QA (T-E9A-05), not blockers
1. **Full-suite test flake (pre-existing, unrelated to E9A):** `test/handoff-write-arg-guard.test.mjs` test #516 (`AC-1 t-ac1-valid-root-path-accepted`, a Zod path-validation test with zero drift references) flakes ~2-of-3 under `node --test test/*.test.mjs` concurrency but passes 3/3 in isolation. `npm run build` is clean (exit 0); `npm test` returned 1394/1394 on a clean run and 1393/1 on flaky runs. This is an environmental/shared-state flake outside the E9A change surface — QA should be aware it is not an E9A regression. The three E9A-relevant drift suites (`drift-baseline` 10/10, `drift-archived-tasks` 10/10, `drift-skew` 7/7) pass deterministically.
2. AC6 requires `npm audit --audit-level=high` in addition to build+test — that is QA's execution (not run in this review).
3. Consider a backlog note for the unquoted-YAML-`Date` advisory-silence edge described under Correctness, if hardening the advisory beyond the observed quoted-stamp pattern is ever desired.
