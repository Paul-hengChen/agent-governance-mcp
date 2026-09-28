# Review — T-C5C18-01

covers: T-C5C18-01, T-C5C18-02, T-C5C18-03, T-C5C18-04, T-C5C18-05

Reviewer: code-reviewer (opus). Batched round, one review over the sr-engineer
uncommitted working-tree diff for feature `c5-c18-watermark-configcache`.
Clean-context: judged against `specs/c5-c18-watermark-configcache.md` + the diff
only.

## Summary
- **T-01 (C5a)**: all **12** `templates/claude-code-agents/*.md` CRITICAL lines
  rephrased from a hardcoded tier to `— @<role> (<the model tier you were
  actually invoked with>)`; frontmatter `model:` untouched.
- **T-02 (C5b)**: `lib/watermark-check.ts` mismatched branch now strips the wrong
  trailing watermark line before appending the canonical one (replace, not
  double-stamp); absent / matching / empty branches unchanged.
- **T-03/T-05**: `skill-coordinator.md` Correction-strategy prose and
  `skill-release-engineer.md` step-10 note synced to the new behavior.
- **T-04 (C18)**: `tools/config.ts` `configCache` now stores `{config, mtimeMs|null}`,
  re-stats per call, invalidates on mtime bump / existence flip; ENOENT→null,
  other stat errors refuse-loud.
- **Spec "14 files" is a miscount** — independently verified: 12 is correct (see
  Correctness). Verdict: **APPROVED**.

## Correctness
- **Spec-count claim verified (AC-1)**: `templates/claude-code-agents/` contains
  exactly **12** `.md` files, all 12 carry a CRITICAL line, all 12 are rephrased.
  `grep -rnE "CRITICAL: End every reply with .*\((opus|sonnet|haiku|fable)\)"
  templates/` returns **zero** remaining hardcoded tiers. The sibling
  `templates/agent-adapters/` dir carries no CRITICAL tier line. The spec's
  AC-1/§C5(a) "14" is a genuine miscount; sr-engineer's "12" is correct. No
  hardcoded tier survives.
- **Watermark mismatch branch (`lib/watermark-check.ts:123-139`)** — traced all
  edges, correct:
  - multiline body + wrong trailing watermark → body preserved, exactly one
    canonical watermark appended.
  - watermark-only reply (`lastBreak === -1`) → `corrected` is just the
    canonical watermark, no leading newline.
  - CRLF input (`— @wrong\r\n` style) → `Math.max(lastIndexOf("\n"),
    lastIndexOf("\r"))` locates the break; trailing `\r` stripped by
    `replace(/\s+$/,"")`; body preserved, normalized to `\n`.
  - Idempotency (AC-2): a second `validateWatermark` call on `corrected` sees the
    canonical watermark as the last non-empty line → `{present:true}`, returned
    unchanged. Exactly one trailing watermark, never two.
  - Absent branch (`:104`), defensive-unreachable branch (`:116`), matching
    branch (`:142`), and empty-reply branch (`:100`) are untouched — AC-2's
    "existing behaviors unchanged" holds.
- **`tools/config.ts` cache invalidation** — traced all AC-4/AC-5 transitions:
  - AC-4 (in-process content+mtime bump): `cached.mtimeMs !== currentMtime` →
    miss → re-read → new content. Correct.
  - AC-5 (absent→create→delete→recreate): each existence flip mismatches the
    cached mtime (`null` vs number, or number vs `null`) → miss → correct
    refresh. No stale positive/negative caching. Correct.
  - ENOENT tolerated (→`null`); non-ENOENT stat errors re-thrown (refuse-loud),
    matching the file's existing read-error posture. Correct.
  - Migration heal-on-read caches the pre-write mtime intentionally (documented
    `:127-131` of dist / `:127` of source): next call re-stats, mismatches,
    triggers one redundant-but-correct re-read — chosen over racing a post-write
    re-stat against concurrent writers. Sound trade-off.
- **Doc-sync accuracy**: `skill-coordinator.md` Correction-strategy line now reads
  "absent: append … Mismatched: replace — strip the wrong trailing watermark
  line, then append the canonical suffix (exactly one watermark line, never
  two)" — matches the implementation (AC-3). `skill-release-engineer.md` step 10
  gains the "append takes effect immediately … no restart needed" note (AC-6).
- **Expected-red manifest (SOP 4a)**: `qa_reports/expected-red_c5-c18-watermark-configcache.txt`
  exists; sampled all 5 declared entries (>3 required) by grepping each named
  test file for the named test string — all 5 resolve to real tests:
  `subagent-templates.test.mjs` v3.21.1/v3.21.2 (assert `— @<role>
  (<frontmatter-tier>)` verbatim — broken by the intended tier-agnostic
  rephrase); `release-staging.test.mjs` AC5/C13-AC6 (assert the
  release-engineer shim watermark line unaltered); `context-budget.test.mjs`
  AC8/AC-P2-7 teamwork design-arm floor (token-cap bump from the ~30-tok
  doc-sync prose growth). All 5 are qa-owned re-baselines tied to the intended
  change — none is a masked regression.

## Quality
No findings. Rephrasing is uniform across all 12 templates. New helper
`statConfigMtime` is well-named and single-purpose; the `ConfigCacheEntry`
interface documents `mtimeMs: null` semantics inline. Comments explain the
non-obvious pre-write-mtime caching choice. Docstrings on `validateWatermark`
and the `.d.ts` are synced to the three-branch behavior.

## Architecture
Matches the fix design in the spec exactly. C18 implemented as the
`tools/config.ts` mtime check, NOT the deprioritized `drift.ts` cache-bypass
(Out of Scope respected). C5a keeps frontmatter `model:` as the default while
making the in-context reminder tier-agnostic, exactly as the spec's fix-design
prescribes. No architecture spec present for this feature; no layering change.

## Security
No findings. No new trust boundary crossed. `statConfigMtime` error message
interpolates the config path (operator-controlled, not attacker input). No
secrets, no injection surface. Watermark strip logic is pure string manipulation
with no eval/exec.

## Performance
No regression. C18 adds one `fs.statSync` per `loadConfig` call — the accepted
cost explicitly sanctioned by the spec (read is already lazy per call site), and
strictly better than the prior never-invalidate cache. Watermark strip is O(n)
in reply length, one pass, no hot-path concern. Minor non-blocking observation:
sub-millisecond consecutive writes could share an identical `mtimeMs` and serve
a stale hit — but this is strictly better than the old forever-cache, matches
the spec's accepted design, and the real driftBaselineIds use case has an ample
time gap; not a defect.

## Verdict
APPROVED — all six functional ACs (AC-1..AC-6) satisfied, build green (AC-7:
`npm run build` exit 0, committed dist in sync with source), spec's "14"
miscount independently corrected to 12, and all 5 expected-red entries verified
as qa-owned re-baselines rather than regressions. Zero change-requiring findings.
