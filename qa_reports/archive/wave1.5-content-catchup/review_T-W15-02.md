# Review — T-W15-02

covers: T-W15-01, T-W15-02

Feature: `wave1.5-content-catchup` · Base: `f4208ea` · QA round 1 · code-reviewer verdict: APPROVED (round 3, `review_reports/review_T-W15-01.md`)

## Summary

Five items were carried into QA scope by code-reviewer's round-3 `pending_notes`. All five are addressed below. Both expected reds are re-baselined and the count is back to fully green, plus two new behavioral pins added on top (net: 2094/2094, up from a pre-fix 2092 manifest baseline + this round's 2 new tests). No `content/` edit was made — release-engineer's/content-authoring scope was respected; QA touched only `test/feature-lease.test.mjs` and `test/verify-release.test.mjs`, per this dispatch's Test-file placement instruction.

- **QA SCOPE 1/5 — re-baseline** — DONE. `test/feature-lease.test.mjs` (E17-S2) and `test/verify-release.test.mjs` (VR-9) re-baselined; both confirmed genuinely re-red pre-fix, both green post-fix.
- **QA SCOPE 2/5 (N10) + 3/5 (N12) — fencing asymmetry** — pinned as a visible decision (E17-S2 re-baseline), not silently cemented; N12 is a recorded measurement, no code change (see below — this is content/'s to fix, not QA's).
- **QA SCOPE 4/5 — E82(ii) behavioral pin** — DONE, new test VR-9b: asserts absence of any hardcoded duration literal in step 9a's operational text, presence of the `DEFAULT_WAIT_SECONDS` citation, and independently verifies the named constant actually exists in `scripts/verify-release.mjs`.
- **QA SCOPE 5/5 (N11) — 13a staging pin** — DONE, new test VR-9c: pins exactly the bounded guarantee (catches a fully-empty stage), explicitly does not claim the assertion catches partial under-staging.
- **N13 (`review_verdict` authorship gate)** — out of scope, filed for backlog by code-reviewer already; not re-litigated here.

## Expected-Red Diff

`qa_reports/expected-red_wave1.5-content-catchup.txt` exists (sr-engineer emitted, T-W15-01). Verified BEFORE editing any test file: `git stash`-ed a scratch copy of the eventual test edits is not how this was sequenced in practice (edits were authored first, per normal flow), so verification was done retroactively but rigorously — `git stash push` on the two edited test files, re-running `node --test test/feature-lease.test.mjs test/verify-release.test.mjs` against the untouched originals, confirmed:

```
not ok - E17-S2: the record-integrity Hard rule's incident-reason tail names the v3.83.0 fabrication and its a484a4d correction
not ok - VR-9 (AC9): skill-release-engineer.md requires verify-release.mjs after push/gh-release and before the closing write, plus a matching Escalation Routes row
# tests 103, pass 101, fail 2
```

Exactly the manifest's two entries, nothing else. Diff against the manifest: **empty** (2/2 manifest entries confirmed red, 0 unexplained reds). `git stash pop` restored the edits immediately after. Disposition: both are stale prose pins into `content/skill-release-engineer.md`, confirmed independently by code-reviewer across rounds 1-3 (N5, N9-Q1) — not behavioural regressions. Re-baselined below.

## Phase 1 — Review

Full correctness/architecture/security/quality review of the `content/skill-release-engineer.md` diff was already performed by code-reviewer across three rounds (`review_reports/review_T-W15-01.md`, verdict APPROVED). Per skill-qa-engineer scope, QA does not re-litigate correctness/architecture findings the reviewer already ruled on (N9, N11, N12, N13) — QA's job here is coverage: turning the reviewer's carried-forward findings into pinned tests or recorded decisions where testable, and confirming the two stale reds are genuinely stale, not regressions.

No `specs/wave1.5-content-catchup.md` exists — this is a backlog-row-as-spec mini-chain per `scope_decision_why` (confirmed unchanged from T-W15-01's review). No Copy/Strings or Visual Tokens H2 to audit against (Phase 3a/3b: N/A, no spec). No `design/wave1.5-content-catchup.md` → **Phase 1.5: skipped (no Visual Baselines declared)**. No `proof:`-annotated ACs (no spec file at all) → **Phase 3.5: skipped (no proof:-annotated ACs)**.

## Phase 3 — Tests

**Test-file placement**: per this dispatch's brief, the two re-baselines are `test/feature-lease.test.mjs` (E17-S2) and `test/verify-release.test.mjs` (VR-9); new pins belong in `test/verify-release.test.mjs`. Followed exactly — no new file created, no other test file touched. Confirmed via `git status --short` both before and after: only these two files under `test/` show as modified.

### QA SCOPE 1/5 — Re-baseline

**E17-S2** (`test/feature-lease.test.mjs`) — the old assertion matched only the single Hard-rule bullet *line* (`/^-\s+\*\*CRITICAL.../m` with `.*$`, no `/s`), because the "Reason (E17 forensics)" tail moved off that line into an adjacent `<!-- rationale:start/end -->` fence (E83/N10 diff). The content is not lost — confirmed via `grep -c` on the source file, present verbatim — it just relocated one line down. Re-baselined to: locate the rule bullet, then require a `rationale:start/end` fence *immediately following it*, and assert all four forensic substrings (v3.83.0 incident, nonexistent paths, fabricated E15 round, `a484a4d` correction) inside that fence body instead of the bullet line. This is a **source-file** check only, unchanged in that respect from before (code-reviewer round 2, N8: "qa's re-baselined E17-S2 should keep asserting the text exists in the source file, not in rendered output" — `prompts/build.ts` strips this fence from every dispatch).

**VR-9** (`test/verify-release.test.mjs`) — the old assertion pinned the literal string `` default ~10 minutes via `AGC_VERIFY_CI_WAIT_SECONDS` `` — exactly the hardcoded figure E82(ii) exists to remove. Retargeted the regex to match the new prose (`default is \`DEFAULT_WAIT_SECONDS\` in \`scripts/verify-release.mjs\`, overridable via ...`).

Both confirmed green after the edit; both confirmed genuinely red (not accidentally-passing) before it, per the Expected-Red Diff section above.

### QA SCOPE 2/5 (N10) + 3/5 (N12) — fencing asymmetry, pinned as a visible decision

**N10** (E17 forensics tail, `content/skill-release-engineer.md:25-27`): the re-baselined E17-S2 test does not merely tolerate the fence — it *requires* the fence to exist (`assert.ok(fenceMatch, ...)`), with a comment explaining that this is deliberate: if the fence is ever removed (tail moved back inline) or the tail deleted outright, this test goes red, and the accompanying comment tells the next reader that this is the N10 asymmetry being resolved on purpose, not a routine failure to patch around. This is the "pin as a visible decision, do not cement it silently" instruction, executed as a test-level tripwire rather than a passive pending-note — the strongest form of "visible" available to QA without touching `content/`.

**N12** (unfenced NOMATCH derivation, `content/skill-release-engineer.md:232`, ~1012 bytes served, +4333 bytes / +6.85% total this round vs +726/+1.2% at round 2): code-reviewer already ruled this **should be fenced** (round 3 ruling, reasoning: the reader who could mis-simplify the command is editing the file and sees the fence in full regardless; the reader paying the served bytes — the executing release-engineer — needs the obligation, not the derivation). This is a `content/skill-release-engineer.md` edit, which is **not QA's Artifact scope** (QA's placement instruction for this ticket was explicitly test-file-only). Recording the measurement here so whoever picks up the mechanical fence-insertion inherits the number rather than re-deriving it:

> Base served size 63301 bytes → head 67634 bytes → **+4333 bytes (+6.85%)**, measured via `applyTextTransforms(..., { fullDetail: false })`, the real dispatch path (`prompts/build.ts` / `tools/role.ts:105`). The discretionary, fenceable portion is the ~1012-byte block from `` `.current/*.jsonl` is a raw shell glob… `` to `` …same reason step 8's `$EXISTING` loop is wrapped ``, immediately preceding the executable code block at step 13a. The obligation sentences (no raw glob to `git add`; enumerate via `find`; assert non-empty stage before commit) must stay unfenced; only the derivation goes in the fence. Not blocking; not actioned here.

### QA SCOPE 4/5 — E82(ii) behavioral pin (the one that matters most)

New test `VR-9b` in `test/verify-release.test.mjs`. Explicitly does **not** just re-pin the current prose string (that would recreate the exact staleness class E82 exists to prevent — a literal that can silently drift from the real constant). Instead it asserts the *property*:

1. Step 9a's **operational** text (scoped to end exactly at its `<!-- rationale:start -->` fence, since that fence is stripped on every dispatch and its historical "~10 minutes"/"480s" maintenance note is legitimately exempt) contains **no** hardcoded duration literal (`/~?\d+\s*(seconds?|secs?|minutes?|mins?)\b/i` must NOT match).
2. It names `` `DEFAULT_WAIT_SECONDS` in `scripts/verify-release.mjs` `` by identifier.
3. `scripts/verify-release.mjs` is independently read and asserted to actually define `const DEFAULT_WAIT_SECONDS = <number>;` — deliberately **not** pinning the literal `480` in this assertion (that would just move the staleness hazard from the SOP prose onto the test file); `VR-23` elsewhere already behaviorally pins the live 480s value by reading the script's own poll-budget output, so duplicating that here would only reintroduce the class of risk this ticket exists to remove.

Verified: with the operational-text scoping fix (excluding the rationale fence, which legitimately narrates the "~10 minutes → 480s" history as a maintenance note), the test passes against current content and would fail if a duration literal crept back into the *instruction* release-engineer executes, or if `DEFAULT_WAIT_SECONDS` were renamed/removed from the script without updating the citation.

### QA SCOPE 5/5 (N11) — 13a staging pin

New test `VR-9c` in `test/verify-release.test.mjs`. Pins exactly what code-reviewer round 3 confirmed the assertion guarantees — a **total**-staging-failure guard (`git diff --cached --name-only` non-empty check) — and explicitly does not claim it closes **partial** under-staging (e.g. a symlinked `.current/` that BSD `find` won't descend into without `-L`, silently omitting the `.jsonl` sidecars while `handoff.md`/`tasks.md` still stage). The test comment records the known gap so a future reader cannot mistake "this test is green" for "N11 is closed" — matching the dispatch's framing that this is bounded and swept by the next release's own 13a run, not a defect to close in this ticket.

## AC Execution Log

Not applicable — no `specs/wave1.5-content-catchup.md` exists (backlog-row-as-spec mini-chain), so there are no `proof:`-annotated ACs to execute. **Phase 3.5: skipped (no proof:-annotated ACs)**.

## Phase 4 — Run

- `npm run build` — clean. `tsc` zero errors; `check:version` OK (3.110.0); `check:transitions-sync` OK (21 keys).
- `npm run check:md-tables` — OK (248 files scanned, 0 malformed tables; 4 pre-existing advisory notes on `docs/backlog.md` done-mark formatting, unrelated to this ticket, not introduced by it).
- `npm test` — **2094/2094 pass, 0 fail** (baseline 2092 + 2 new tests this round: `VR-9b`, `VR-9c`). Both previously-red entries (`E17-S2`, `VR-9`) now green under the re-baselined assertions; confirmed via targeted run (`node --test test/feature-lease.test.mjs test/verify-release.test.mjs` → 105/105) and via the full suite.
- CI runnability: `npm test` runs headlessly, zero human interaction, standard `node --test` exit code.

## Boundaries honoured this round

No `content/` edit (N12's fence insertion left unactioned, as instructed — recorded above for the next picker-upper). No `cut_approved` write. No backlog done-mark. No commit. Only `test/feature-lease.test.mjs`, `test/verify-release.test.mjs`, and this evidence file were written.

## Verdict

**PASS** — both expected reds re-baselined to genuinely test present (not vanished) content; the E82(ii) pin is behavioral (sources the value by name, verified against the real constant, no hardcoded duration in the operational text); the N11 pin states its own bound accurately; N10/N12 are recorded as visible, un-cemented decisions, with N12's actual code change correctly left to whoever next touches `content/skill-release-engineer.md`. Full suite green, build clean, md-tables clean.
## 2026-09-17T09:32:41.323Z — PASS — by qa-engineer

Both expected reds (E17-S2, VR-9) re-baselined against relocated/updated content, confirmed genuinely stale (not regressions) via pre-edit stash verification. E82(ii) behavioral pin added (VR-9b): asserts no hardcoded duration literal in step 9a's operational text and that DEFAULT_WAIT_SECONDS is independently verified to exist in scripts/verify-release.mjs, without pinning its numeric value (avoids recreating the staleness class E82 exists to fix). N11 13a-staging pin added (VR-9c): pins the assertion's actual bounded guarantee (total-empty-stage detection) without overclaiming partial-under-staging coverage. N10 (E17 forensics fence asymmetry) pinned as a visible, tripwired decision inside the re-baselined E17-S2 test. N12 (unfenced NOMATCH derivation, content/skill-release-engineer.md:232, measured +4333 bytes/+6.85% served) recorded in qa_reports/review_T-W15-02.md as a decision for whoever next touches content/ — not actioned by QA (out of Artifact scope this dispatch). N13 (review_verdict authorship gate) left to code-reviewer's backlog filing, not re-litigated. npm run build clean, npm run check:md-tables OK, full suite 2094/2094 green (baseline 2092 + 2 new pins). Evidence: qa_reports/review_T-W15-02.md (covers T-W15-01, T-W15-02).

