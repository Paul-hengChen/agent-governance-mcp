# Review — T-E115-01

covers: T-E115-01, T-E115-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Two new files reviewed against `specs/e115-join-precondition-check.md`: `tools/join-precondition.ts` (215 lines) and `scripts/join-precondition.mjs` (36 lines), plus their generated `dist/` output. No other source file is touched.
- **AC1, AC2, AC5, AC6, AC7, AC8 all verified PASS** — each by execution or by grep against the emitted `.d.ts`, not by reading the implementer's notes. AC5 in particular is clean: every read/exec in the module is anchored to the single `repoRoot`, and no exported function takes a second workspace-path argument.
- **AC3/AC4 FAIL in practice.** `checkDeclaredVsActualLaneIdentity` compares *every* declared row against the one actual `active_feature`, so any `feature-split.md` with ≥2 rows — the canonical shape the coordinator template mandates — reports fabricated mismatches and drives `renderJoinPreconditionReport` to `VERDICT: join precondition NOT satisfied` in a perfectly healthy workspace. Reproduced against this workspace's own real `.current/feature-split.md` and against a synthetic canonical plan.
- The check therefore cannot return a clean result on a real artifact; the only clean configuration is a single-row plan matching exactly. A self-check that always fails carries no information — the same "nobody can trust it" failure mode the ticket exists to eliminate.
- Model independence satisfied: implementer ran on `fable` (per `dispatch_pins`), this review on Opus 5. No same-model blind-spot overlap suspected.

## Correctness

### C1 (BLOCKING) — `checkDeclaredVsActualLaneIdentity` fabricates a mismatch on every healthy multi-row split plan
`tools/join-precondition.ts:209-213`

```ts
const mismatches: LaneIdentityMismatch[] = declaredFeatureIds
  .filter((declared) => declared !== actual)
  .map((declared) => ({ declared, actual: actual as string }));
```

A `feature-split.md` Split Table has one row per planned lane; by construction only one of them can equal this workspace's current `active_feature`. Every other row is reported as a mismatch even when nothing is wrong.

Reproduced two ways.

**(a) This workspace's own real artifact.** `<lanes-root>/e115/.current/feature-split.md` declares three rows; the handoff records `e115-join-precondition-check`:

```
{"compared": true, "mismatches": [
  {"declared":"e39-e58-transition-matrix-sync","actual":"e115-join-precondition-check"},
  {"declared":"e48-docs-skills-policy","actual":"e115-join-precondition-check"},
  {"declared":"e56-drtwo-amendment","actual":"e115-join-precondition-check"}]}
```

and the rendered report ends:

```
VERDICT: join precondition NOT satisfied — resolve the issue(s) above before proceeding.
```

**(b) A synthetic, entirely healthy canonical plan** (2 rows, `active_feature` exactly equal to row 1 — i.e. the success case) still yields a mismatch:

```
{"compared":true,"mismatches":[{"declared":"demo-shared-foundation","actual":"demo-feature-one"}]}
```

The canonical template in `content/coord-01-core-head.md:48+` mandates this multi-row shape (`| 0 | <shared-foundation> | … |` + `| 1 | <feature> | … |`), so ≥2 rows is the normal case, not an edge case. A single-row plan matching exactly is the *only* configuration that returns `mismatches: []` (verified).

Why this is a correctness defect and not merely a tuning choice:
- AC4's stated principle is that the function must never fabricate "a match **or a mismatch**". Reporting an already-`done` or not-yet-started sibling lane as a mismatch is a fabricated mismatch — nothing is wrong in that workspace.
- The spec's Problem Statement defines the real signal precisely: *"two planned lanes collapsing into one workspace under a third name"*. That is a **membership** question — is the actual `active_feature` present anywhere in the declared plan? — not an every-row-equality question. The incident the ticket was filed from (`source-list-mock` + `source-list-contract-docs` both running as `source-list-mock-contract`) is caught by membership and is *drowned* by per-row equality, which fires on healthy plans too.
- `renderJoinPreconditionReport:253-256` promotes any mismatch straight to a hard `NOT satisfied` verdict, so the false positive is not cosmetic — it blocks the very join the module is supposed to clear.

Suggested remedies (either is acceptable; pick one and say which):
1. **Membership test** — flag iff `actual` is absent from `declaredFeatureIds`, reporting the declared set alongside `actual` as the single finding. Directly encodes the Problem Statement's incident.
2. **Row-scoped test** — keep per-row comparison but ignore rows whose `status` column is `done`, and treat "actual matches at least one declared row" as satisfied, so a healthy in-progress plan is clean.

Note the tension with AC3's literal wording (*"compares each declared value … returns a mismatch finding whenever they differ"*), which can be read as sanctioning the current behaviour. The literal reading produces a check that cannot pass on the artifact shape the codebase actually generates, so the AC wording likely needs a PM clarification alongside the fix rather than a silent reinterpretation — escalate if you disagree with the remedy rather than working around the AC.

### Verified-clean correctness items (no findings)

**AC1/AC2 — `checkLaneAncestry`, `tools/join-precondition.ts:60-87`.** Executed against a scratch git repo with real branches and commits. All seven probes behave per spec, and the two failure modes called out for adversarial attention are both correctly classified as *unknown*, never as a clean "not merged":

| probe | result |
|---|---|
| merged branch | `{isAncestor: true}` |
| unmerged branch (git exit 1) | `{isAncestor: false}`, **no** `error` |
| nonexistent branch (exit 128) | `false` + `"fatal: Not a valid object name no-such-branch"` |
| `repoRoot` exists but is not a git repo | `false` + `"fatal: not a git repository…"` — **not** misclassified |
| `repoRoot` directory does not exist | `false` + `"spawnSync git ENOENT"` |
| `git` binary unavailable (`PATH` stripped) | `false` + `"spawnSync git ENOENT"` |
| option-shaped branch args (`-a`, `--is-ancestor`) | `false` + git usage text |

Nothing threw in any probe. The exit-status extraction at `:69-70` is robust across both `execFileSync` error shapes: a non-zero child exit populates `.status` (so `status === 1` isolates git's documented ancestry negative), while a spawn failure leaves `.status` undefined and falls through to the error branch. This matches git's documented contract for `merge-base --is-ancestor` (0 = true, 1 = false, *any other* non-zero = error), so the `status === 1` narrowing is well-founded rather than incidental.

**AC4 degradation — `tools/join-precondition.ts:162-207`.** All five degradation paths probed; every one returns `compared: false` with an honest `reason` and empty `mismatches`, and none throws: missing `feature-split.md`; table with no recognizable column; unfilled `<placeholder>` template; unparseable handoff YAML (the `parseHandoff` throw at `handoff-parse.ts:205` is correctly caught at `:190`); and no `handoff.md` at all. The `actual === null` guard at `:200` is not redundant with the `catch` — `parseHandoff` returns `null` rather than throwing when the file is absent.

**AC6 — `tools/join-precondition.ts:257`.** Exactly one `HOOK POINT FOR E126` comment in the source (`grep -c` = 1), sited at the "all preconditions satisfied" branch, which is the correct join moment. It names what a future assertion needs (pre/post-merge `completed_tasks`/`[x]` snapshot) and implements none of it. The second occurrence under `dist/` is the TypeScript compiler's copy of that same comment, not a second hook.

**SOP step 4a (expected-red sampling) — not armed.** The diff touches no test files, `npm run build` is green, and there is no evidence of intentionally-red tests. `qa_reports/expected-red_<feature>.txt` is correctly absent. `test/e115-join-precondition.test.mjs` is likewise correctly absent — it is qa-engineer's file per Constitution §2.

## Quality

### Q1 (non-blocking) — header alias matching is defeated by ordinary markdown decoration
`tools/join-precondition.ts:108,132`. `DECLARED_FEATURE_COLUMN_ALIASES` is matched against the raw trimmed cell, so a `**feature id**` header (valid markdown, and a style used elsewhere in these very files) falls through to `compared: false, reason: "no populated feature id / active_feature column could be located"`. Verified. The degradation is honest, so this is not a correctness hole — but it silently disables the check on a legal artifact. Normalizing the cell (strip `*`, `` ` ``, `_`) before the alias lookup would close it, and the same normalization would protect declared *values* written as `` `e115-…` `` from becoming false mismatches.

### Q2 (non-blocking) — no end-of-options guard on the branch argument
`tools/join-precondition.ts:63`. Branch names are passed positionally, so an argument beginning with `-` is consumed by git as an option (verified: `-a` and `--is-ancestor` both return git's usage text). `execFileSync` with an argv array means there is no shell and no injection vector, and the result degrades safely to `false + error`, so severity is low. Validating the branch name (or resolving it through `git rev-parse --verify` first) would make the error message name the real problem instead of printing a usage block.

### Q3 (non-blocking) — empty `ancestry` reports NOT satisfied
`tools/join-precondition.ts:253`. `ancestry.length > 0 && …` means a zero-branch call reports `NOT satisfied` with `(no branches given)`. Defensible (no evidence is not satisfaction), but it is the one verdict path with no explanatory comment; the CLI makes it reachable only via `node scripts/join-precondition.mjs /abs/repo/root`. Worth one line of comment stating the choice is deliberate.

### Positive notes
Doc comments are accurate against the code (I checked each claim rather than trusting it), the AC5 rationale in the header comment correctly contrasts this module with `tools/feature-rollup.ts`'s deliberate sibling-worktree reads, and the separator-row / placeholder / new-table-block handling in `parseDeclaredFeatureIds:118-146` is genuinely careful — the unrelated measurement tables in this workspace's real `feature-split.md` are correctly skipped because collection only starts after a header alias is located.

## Architecture
No architecture spec exists for this feature (`specs/e115-join-precondition-check-architecture.md` absent), so the spec's own constraints are the design contract, and the implementation honours them: a standalone callable module plus a thin CLI, mirroring the `tools/feature-rollup.ts` + `scripts/feature-rollup.mjs` precedent, with nothing wired into `gates/registry.ts` or `UPDATE_STATE_GATE_PIPELINE` (confirmed — `tools/registry.ts` untouched). Render is correctly separated from the two checks: `renderJoinPreconditionReport` takes both results as parameters and performs no hidden re-read, which is what keeps the AC5 boundary auditable at a single layer. `npm run build` is clean (`tsc` + `check:version` + `check:transitions-sync`), and `dist/` is byte-identical to a fresh rebuild — no stale build output shipped.

## Security
No findings.
- **AC5 (zero cross-workspace reads) — VERIFIED, the load-bearing invariant holds.** Every read/exec call site in both files is anchored to the single `repoRoot`: `execFileSync(…, {cwd: repoRoot})` at `:63`; `fs.readFileSync(path.join(repoRoot, ".current/feature-split.md"))` at `:163,167`; `parseHandoff(repoRoot)` at `:188`, which resolves to `repoRoot/.current/handoff.md` and nothing else (`tools/handoff-parse.ts:188-192`, read-only, no migration write-back on this path). Grep for `../`, `__dirname`, `homedir`, `readdirSync`, `agc-lanes` returns nothing. The only non-`repoRoot` path anywhere is the CLI's `process.cwd()` default, which *is* the invoking workspace by definition.
- No exported function takes a second workspace-path argument — confirmed against the emitted `dist/tools/join-precondition.d.ts`, which is the authoritative signature surface: `checkLaneAncestry(branches: string[], repoRoot: string)`, `checkDeclaredVsActualLaneIdentity(repoRoot: string)`, `renderJoinPreconditionReport(ancestry, identity)` — no path argument at all on the third.
- A caller-supplied branch name cannot become a cross-workspace read: it is resolved by git as a revision against the local object database, never as a filesystem path.
- `execFileSync` with an argv array invokes no shell, so branch names carrying shell metacharacters are inert. No secrets, no network, no writes of any kind — both files are read-only.
- The CLI's `lastArg.startsWith("/")` repo-root heuristic (`scripts/join-precondition.mjs:30`) is safe: git refnames cannot begin with `/` (`git check-ref-format`), so a branch can never be swallowed as a repo root.

## Performance
No findings. One `git merge-base` subprocess per `depends_on` branch (`:61-63`) — linear in a list that is single-digit by nature, run once at build entry, off every hot path. `feature-split.md` is read once and parsed in a single O(lines) pass with no backtracking. No caches, no listeners, no retained state; both functions are pure apart from their reads. No prior implementation exists to regress against.

## Verdict
CHANGES_REQUESTED — AC1/AC2/AC5/AC6/AC7/AC8 all verified clean, but C1 makes the AC3/AC4 identity check report fabricated mismatches and a hard `NOT satisfied` verdict on every healthy multi-row `feature-split.md`, including this workspace's own, so the check cannot pass on the artifact shape the codebase actually generates.

---

## Round 2 — APPROVED — by code-reviewer

covers: T-E115-01, T-E115-02

## Summary
- Delta reviewed against the **amended** `specs/e115-join-precondition-check.md` (Amendment History :195, amended AC3, new AC9). Changes are confined to `tools/join-precondition.ts` (215 → 314 lines); `scripts/join-precondition.mjs` is unchanged and needed no change.
- **C1 (round 1, blocking) is fixed and verified against the original repro artifact.** This lane's own real `.current/feature-split.md` — a 3-row Split Table that produced 3 fabricated mismatches in round 1 — now produces exactly ONE finding naming the full declared set. Verified by running the CLI end-to-end, not by reading the diff.
- **Amended AC3 satisfied**: membership, one finding maximum, zero `status`-column special-casing (confirmed by a probe where the matching row carries `status: done` — still satisfied).
- **New AC9 satisfied at both application sites**, and survives the adversarial probes it was most likely to fail: internal underscores, unbalanced/nested decoration, decoration-only cells, and the empty-string-collision path.
- **AC1/AC2/AC4/AC5/AC6/AC7/AC8 re-verified by execution or grep this round**, not carried over on the handoff's word. All clean.
- Model independence holds: implementer on `fable` (`dispatch_pins`), this review on Opus 5. No same-model blind-spot overlap suspected.
- Verdict: **APPROVED**.

## Correctness

**C1 — RESOLVED.** `tools/join-precondition.ts:246-248` is now

```ts
const mismatches: LaneIdentityMismatch[] = declaredFeatureIds.includes(actual)
  ? []
  : [{ declaredFeatureIds, actual }];
```

This is structurally incapable of emitting more than one finding — the "exactly ONE finding" clause of amended AC3 is enforced by shape, not by discipline. No `status` read appears anywhere in the function; the row-skipping variant PM refuted is genuinely absent rather than merely unused.

Executed probes (scratch fixtures, real on-disk workspaces):

| probe | result |
|---|---|
| healthy 3-row plan, `actual` matches row 2, siblings differ | `compared:true, mismatches:[]` |
| `actual` matches a row whose `status` is `done` | `compared:true, mismatches:[]` — no status special-casing |
| `source-list-mock` / `source-list-contract-docs` declared, actual `source-list-mock-contract` | exactly ONE finding naming both declared values + actual |
| 5 declared rows, none matching | `mismatches.length === 1` |
| this lane's **real** `.current/feature-split.md` (round-1 repro) | ONE finding, 3-item declared set (was 3 findings) |

**AC9 — satisfied at both sites**, `stripMarkdownDecoration` at :129-131, applied at :153 (header-alias lookup) and :162 (declared value). Probed for the failure modes the assignment named:

- **Internal underscore is safe.** `e115_join` → `e115_join`. The regex `/^[*`_]+|[*`_]+$/g` is anchored, so only run-of-decoration at the string's ends is removed. A feature id with internal `_` round-trips unchanged; the `_feature_id_` header form also normalizes correctly to `feature_id` (in the alias set).
- **Decoration-only cell cannot produce an empty declared value.** `***` strips to `""`, and :163 drops `""` before the push. Probed: a plan whose only rows are `***` / ``` ``` ``` yields `compared:false` with a reason — degraded honestly, not an empty declared set silently reported as a verdict.
- **Empty `actual` cannot match an empty declared value.** Both sides are guarded independently: `""` never enters `declared` (:163), and `state?.active_feature || null` at :222 coerces an empty `active_feature` to `null`, which exits at :233 with `compared:false`. Probed a handoff with a blank `active_feature` — returns `compared:false`, never a fabricated match.
- **Collapsing two distinct declared values to one string is harmless.** `` `alpha` `` and `**alpha**` both normalize to `alpha`. The result is only ever consumed by `.includes(actual)`, so a collapse can dedupe the declared set but can never manufacture a match against a *different* `actual`, and can never suppress a real mismatch.
- **Unbalanced and nested decoration both normalize.** `**alpha` → `alpha`; `` **`alpha`** `` → `alpha`.
- Strip ordering vs. the `<template>` placeholder guard is correct: :162 strips, then :163 tests `<`/`>`, so `` `<feature-id>` `` is still recognized as an unfilled placeholder and skipped.

**AC4 — honest degradation intact after the rewrite.** All four degradation paths probed on real fixtures, each returning `compared:false` + a populated `reason` + `mismatches: []`:
- missing `.current/feature-split.md` (:199-207)
- no recognizable feature-identity column / no populated values (:210-217)
- unparseable handoff — probed with deliberately malformed YAML (:220-231)
- parseable handoff with no `active_feature` (:233-240)

No path returns `compared:true` without both a located declared set and a non-empty actual, so a fabricated verdict is unreachable.

**AC1/AC2 — re-verified against a real scratch git repo** (init → branch → merge --no-ff → second unmerged branch), not by reading:
- merged branch → `{isAncestor:true}`, no `error`
- existing-but-unmerged branch → `{isAncestor:false}` with **no** `error` (clean negative correctly distinguished from failure via `status === 1` at :70)
- unknown branch → `{isAncestor:false, error:"fatal: Not a valid object name …"}`, no throw
- bogus `repoRoot` → `{isAncestor:false, error:"spawnSync git ENOENT"}`, no throw
- empty branch list → `[]`, no throw

**Consumer sweep for the reshaped `LaneIdentityMismatch`.** Grepped the whole tree (excluding `dist/`, `node_modules/`) for `LaneIdentityMismatch`, `.declared`, `declared:` and `declaredFeatureIds`. The only consumer is `renderJoinPreconditionReport:286`, which reads `m.actual` and `m.declaredFeatureIds.join(", ")` — the new shape. Executed the renderer with a mismatch payload: output contains the full declared set and no `undefined`. No stale `{declared, actual}` reference survives anywhere, and nothing outside `scripts/join-precondition.mjs` imports the module at all.

No findings.

## Quality
No findings. Doc comments at :89-95, :122-128 and :170-194 were rewritten to describe membership semantics and explicitly record why `status` is not special-cased, with a one-way reference to the Amendment History — they match the code rather than trailing it. `stripMarkdownDecoration` is a single named helper used at both sites rather than duplicated inline. Naming (`declaredFeatureIds`) matches the interface field, so the finding literal at :248 is a clean shorthand.

Two non-blocking observations, neither gated by any AC and neither worth a round:
1. A feature id that legitimately *begins or ends* with `_` (e.g. `_internal`) is corrupted by the strip and would surface as a false mismatch. This is exactly what amended AC9 mandates ("strips leading/trailing … `_`"), agc feature ids are kebab-case throughout, and the failure direction is loud (a visible finding), not silent. Spec-conformant, not a defect.
2. An exotic separator row that fails the `/^:?-+:?$/` test at :160 would add a junk member such as `---` to the declared set. It can only make membership *more* likely to succeed, never suppress a real mismatch, so the blast radius is a cosmetic line in the printed declared set. Pre-existing, not introduced by this delta.

Q2 and Q3 were formally deferred by PM with no AC and are not re-raised. For the record, the Q2 probe confirms PM's stated reasoning empirically: a `-`-leading branch arg degrades to `{isAncestor:false, error:"<git usage text>"}` — argv-array `execFileSync`, no shell, no injection surface.

## Architecture
No findings. The module stays a self-contained, callable build-entry self-check: its only internal import is `parseHandoff`, and nothing wires it into `gates/registry.ts` or `UPDATE_STATE_GATE_PIPELINE`, matching the spec's Out of Scope. The membership rewrite is a local change to one expression plus one interface; it introduced no new dependency, no new exported surface, and no change to the `LaneIdentityCheckResult` envelope, so AC4's degradation contract sits on exactly the same structure it did in round 1. `scripts/join-precondition.mjs` retains the `scripts/feature-rollup.mjs` thin-wrapper shape (argv → function → `console.log`, zero domain logic) — **AC7** re-confirmed by side-by-side comparison.

**AC5 — zero cross-workspace reads, re-verified this round.** Every I/O site in the module: `execFileSync` with `cwd: repoRoot` (:63-65), `fs.readFileSync(path.join(repoRoot, ".current/feature-split.md"))` (:196, :200), `parseHandoff(repoRoot)` (:221). No fourth site exists. Exported signatures read off the emitted `dist/tools/join-precondition.d.ts` — `checkLaneAncestry(branches, repoRoot)`, `checkDeclaredVsActualLaneIdentity(repoRoot)`, `renderJoinPreconditionReport(ancestry, identity)` — none takes a second workspace-path argument. The delta added no I/O.

**AC6 — re-verified directly.** `grep -c "HOOK POINT FOR E126"` over `tools/join-precondition.ts` = **1** (at :296), over `scripts/join-precondition.mjs` = **0**; the only other tree occurrences are prose in `tasks.md`, the spec, and this review file. The comment names what a future assertion would need (pre/post-merge `completed_tasks`/`[x]` counts) and stops there — grepping the module for `completed_tasks|preMerge|postMerge|assert` returns hits only inside that comment block. No E126 logic.

**AC8 — boundaries clean.** `git status --porcelain` for `tools/drift.ts`, `tools/lane-registry.ts`, `content/`, `tools/registry.ts`, `scripts/verify-release.mjs`, `docs/backlog.md` and `test/` returns empty; `git diff --stat e784a3b -- docs/backlog.md` is empty, so no done-mark moved. The working-tree change set is the three declared source artifacts plus their `dist/` output, the spec, this review file, and governance bookkeeping.

`test/e115-join-precondition.test.mjs` is correctly absent — it is qa-engineer's file (Constitution §2) and T-E115-03 has not run. Not a finding.

## Security
No findings. `execFileSync` is invoked with an argv array and no shell, so a hostile branch name cannot escape into a command (probed: `-z-leading-dash` degrades to git's usage text as `error`). `stderr` is captured with `stdio: ["ignore","ignore","pipe"]` and surfaced as a message, never evaluated. The only filesystem read is a fixed relative path joined onto the caller-supplied `repoRoot`; no component of that path derives from file contents, so parsed `feature-split.md` text never reaches a path, a command, or a `RegExp` constructor. No secrets, no network, no new trust boundary. The AC9 strip operates on a fixed character class with an anchored, non-backtracking pattern — no ReDoS surface.

## Performance
No findings, and no regression vs. the round-1 implementation. The rewrite replaced an O(n) `filter` with an O(n) `includes` over the same declared set — same complexity class, one fewer allocation in the satisfied case. `parseDeclaredFeatureIds` remains a single O(lines) pass with an O(1) `Set` alias lookup per header candidate; `stripMarkdownDecoration` adds two anchored regex passes per cell, bounded by cell length. `checkLaneAncestry` spawns one `git` process per `depends_on` branch — inherent to the check and bounded by a join ticket's dependency count (single digits). No caching, no listeners, no unbounded growth.

## Verdict
APPROVED — amended AC3 is satisfied by construction (membership, one finding maximum, no `status` special-casing) and verified against the exact artifact that produced round 1's C1; AC9 holds at both application sites under adversarial probing; AC4's honest-degradation contract survives the rewrite on all four paths; and AC1/AC2/AC5/AC6/AC7/AC8 were re-verified this round by execution and grep rather than inherited from the handoff.
