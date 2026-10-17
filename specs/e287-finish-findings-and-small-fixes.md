# e287-finish-findings-and-small-fixes

Lane `e287` of fan-out wave `specs/fanout-post-v4-w5.md` (post-v4 queue wave 5). Four tickets batched per the integrator manifest: **E287** (P2), **E326** (P2), **E324** (P3), **E325** (P3). The scope cut is the manifest's e287 `範圍切線` cell (human-approved 2026-10-16, including the mandatory architect hop for E287); this spec writes it down, it does not re-open it.

Line references below were re-verified against the lane base (`dac6069`) at cut time.

## Problem Statement

Four independent defects in four disjoint files.
**E287** (`docs/integrator-revision-2026-10-08.md` §4 O6, §6.2 D4) — `agc feature finish` reads a lane's findings file `.current/<lane>/pending-tickets.md` only from git's object db: `--shipped` from `--base` (`planPendingOnShipped`, `bin/agc-init.mjs` :2105–2115, silent `return null` at :2108), `--abandoned` from the branch ref (`applyPendingOnAbandoned`, :2708–2760, `return null` at :2712). In a repo where agc artifacts are git-excluded, the file is never on either revision, so finish says nothing; the findings survive only in the fs history copy the lane-close harvest happens to make (`executeLaneClose` :2378, advisory :2448; `executeAbandonCurrentHarvest` :1813, advisory :1830), and nobody is told they were not numbered. Separately (D4), a finding may belong to another repo; today any block is allocated a local `E<n>` (`planPendingApply` :1969; the block parser `validateBlock`, `tools/lane-ticket-allocation.ts` :306–361, ignores unknown keys, so a `target_repo:` line is silently dropped and the finding is numbered here).
**E326** — `scripts/verify-release.mjs` `evaluateCIGroundTruth` (:390): on the branch-scoped path (no `--sha`), an empty completed-run list WARNs at once (`no completed CI runs found on <branch>`, :539–541) instead of polling; under `--ci-check --strict` (release step 8b) that is an immediate FAIL on a freshly pushed `release/*` branch whose CI has not finished. Only the commit-scoped `--sha` path (E320) polls an empty list.
**E324** — `emitZodGateTelemetry` (`tools/registry.ts` :84–104) guards only `basename(workspace_path) === ".current"` (E317, :89–90); with `workspace_path = <ws>/.current/<lane>` and a bad `dispatch_pins` tier it still writes `<ws>/.current/<lane>/.current/_primary/telemetry.jsonl`.
**E325** — `tools/drift.ts` `readArtifactVersion` (:219–259) picks the lane or flat handoff path with `existsSync` (:227–229) and then reads it (:230); a concurrent flat↔lane migration rename between the two drops that call's schema-skew advisory. E312 closed the same window in `tools/handoff-parse.ts` `readAndMigrate` by re-reading the other layout once on a miss.

## User Stories

- As an integrator on a repo whose agc artifacts are git-excluded, I want `agc feature finish` to tell me that a lane's findings were not numbered and where they now live, so that no finding is lost silently.
- As an integrator coordinating two repos, I want a lane finding addressed to another repo to be listed for my ruling instead of getting a local id, so that this repo's backlog never carries another repo's ticket.
- As a release-engineer, I want `--ci-check --strict` on a freshly pushed release branch to wait for CI within the existing budget, so that step 8b does not fail on its first attempt merely because CI has not finished.
- As an operator, I want a malformed `tw_*` call whose `workspace_path` is any directory under `.current` to emit no telemetry, so that no stray nested `.current/**` tree is created.
- As a user of `tw_detect_drift`, I want the schema-skew check to survive a concurrent layout migration, so that a future-schema handoff is never silently unreported.

## Acceptance Criteria

Tests are qa-owned (Constitution §2). "Revision" below means the git revision finish reads the pending file from: `--base` for `--shipped`, `refs/heads/<branch>` for `--abandoned`.

### E287 — finish never drops findings silently; findings for another repo are not numbered here (`bin/agc-init.mjs`, `tools/lane-ticket-allocation.ts`)

Where a criterion says "per the architecture", `specs/e287-finish-findings-and-small-fixes-architecture.md` fixes the mechanism (see Open Questions); the observable outcome stated here is binding either way.

- **AC-E287-1** (O6, `--shipped`) — Given a merged lane whose worktree holds `.current/<lane>/pending-tickets.md` with ≥ 1 unapplied well-formed block, and the file is absent at `--base` (fixture: `.current/` excluded via `info/exclude`), when `agc feature finish <lane> --shipped` runs, then finish completes as it does at base (exit 0, worktree removed, branch deleted, no backlog commit) and stderr carries one warning naming the lane, the pending file path, the revision it was absent from, the number of unapplied entries, and each entry's `lane_local_id` and title, stating they were not allocated.
  proof: new test in `test/e287-*.test.mjs` — ignored-`.current` fixture, `--shipped`, asserts exit 0, the warning fragments on stderr (Copy `e287.unallocated-warning`), and the `--base` branch log gains no `chore(backlog): allocate` commit.
- **AC-E287-2** (O6, `--abandoned`) — Same as AC-E287-1 for `--abandoned`, where the file is absent at the branch ref: finish completes as at base (worktree removed, branch kept), with the same warning.
  proof: new test, ignored-`.current` fixture, `--abandoned`, same assertions plus "kept branch" on stdout.
- **AC-E287-3** (destination stated truthfully) — The warning names where the findings now live, and names a location only when this run actually puts the file there. Under the PM proposal (Open Question Q1, option a) that is the lane-close / abandon harvest copy `.current/history/<YYYY-MM>/<lane>/pending-tickets.md` in the primary checkout. If this run would make no such copy (e.g. `.current/<lane>/` has tracked content, so the harvest is skipped, but `pending-tickets.md` itself is git-ignored and `git worktree remove` would delete it), finish must not delete the only copy silently — per the architecture, it either preserves the file or refuses before the first mutation (Q2).
  proof: new test asserting the named history path exists after the run and is byte-identical to the lane's file; second case for the tracked-dir/ignored-file shape asserting the file survives somewhere the output names, or finish exits non-zero with nothing removed.
- **AC-E287-4** (no regression) — When the pending file is absent from both the worktree and the revision, finish's output and effects are unchanged from base (no new line). When the pending file is present at the revision, E179 behaviour (allocation, `## Applied` archiving, refusals, idempotent re-run) is unchanged.
  proof: every existing test in `test/agc-feature-lifecycle.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e298-finish-remote-delete.test.mjs`, `test/e246-mailbox-teardown.test.mjs` and `test/lane-ticket-allocation.test.mjs` passes; any re-pin is listed with its reason in the QA evidence.
- **AC-E287-5** (D4 field) — A `pending-ticket` block may carry an optional `target_repo` field (field name final per the architecture, Q3). A non-empty string marks the finding as belonging to another repo; a present-but-empty or non-string value is a malformed block, reported like the other optional-field errors (on the revision path that is the existing fail-closed refusal, nothing applied).
  proof: new unit cases in `test/lane-ticket-allocation.test.mjs` or `test/e287-*.test.mjs` for `parsePendingTickets` with valid / empty / non-string `target_repo`.
- **AC-E287-6** (D4, no local id) — Given a pending file at the revision with one local entry and one `target_repo` entry, when finish runs (`--shipped` and `--abandoned`), then only the local entry gets an `E<n>` id and a backlog row; the `target_repo` entry gets no id, does not advance the max id, and finish's output lists it with its `lane_local_id`, title and target repo, marked as needing a human ruling.
  proof: new test per verb asserting the backlog diff has exactly one new row and the output carries Copy `e287.target-repo-line` for the other entry.
- **AC-E287-7** (D4, only external entries) — Given a pending file whose unapplied entries all carry `target_repo`, when finish runs, then no backlog commit is made, the entries are listed as in AC-E287-6, and finish does not refuse because `docs/backlog.md` is absent at `--base` (a backlog is needed only to number local entries).
  proof: new test with no `docs/backlog.md` on base and only `target_repo` entries → exit 0, no `chore(backlog): allocate` commit, listing present.
- **AC-E287-8** (D4, re-run and orphan scan) — A re-run of finish after a later step failed never allocates a `target_repo` entry and never errors because of one; `agc check`'s orphan-lane scan (`checkOrphanLanes`, :797) does not report a branch whose only unapplied entries are `target_repo` ones. The archival state of a listed `target_repo` block is fixed by the architecture (Q4).
  proof: new test — finish with a forced late failure (e.g. a dirty primary blocking `git worktree remove`), re-run → no allocation, no error; plus an `agc check` case on an abandoned branch carrying only `target_repo` entries → no orphan warning.
- **AC-E287-9** (D4 in the O6 path) — In the AC-E287-1/2 warning, entries that carry `target_repo` are shown with their target repo.
  proof: covered by the AC-E287-1 test with one `target_repo` entry in the fixture.
- **AC-E287-10** (usage + follow-up) — `STR_USAGE_FEATURE` (`bin/agc-init.mjs` :1009) states that findings absent from the revision are warned about (not numbered) and that `target_repo` findings are listed, not numbered. The doc follow-up (documenting the field in `docs/lane-protocol.md` §4 and the integrator SOP Stage 6, both forbidden to this lane) is filed as a `pending-ticket` block in `.current/e287/pending-tickets.md`.
  proof: `node bin/agc-init.mjs feature` (missing-subcommand usage path) prints the new sentence; the pending-ticket block exists above `## Applied`.

### E326 — branch-scoped empty run list is polled (`scripts/verify-release.mjs`)

Tests use the existing `gh` PATH shims of `test/verify-release.test.mjs` (or an equivalent in a new `test/e326-*.test.mjs`) with `AGC_VERIFY_CI_WAIT_SECONDS` pinned.

- **AC-E326-1** — Given `--ci-check --strict` (no `--sha`) on a branch where `gh run list --branch` answers `[]` on the first call and a `success` run for HEAD on a later call within the budget, then the script polls (a poll-progress line on stdout), and exits 0 with `CI-CHECK PASSED`.
  proof: new test, sequence shim `["[]", <success run for HEAD>]`, budget ≥ the poll interval → exit 0, shim called ≥ 2 times.
- **AC-E326-2** — Given `--ci-check --strict` (no `--sha`) and `gh` answers `[]` until the budget is exhausted, then the script exits 1 with a FAIL on stderr whose reason is the unchanged `no completed CI runs found on <branch label>`; it does not FAIL before the budget is used.
  proof: new test, `[]` shim, budget `0` → exit 1, one gh call, stderr `/FAIL: CI ground-truth — no completed CI runs found on/`; second case budget small (e.g. `2`) → ≥ 2 gh calls before the FAIL.
- **AC-E326-3** — Lenient (`--ci-check` without `--strict`) with `[]` until the budget is exhausted → exit 0 and the existing WARN line, byte-identical reason (`WARN: CI ground-truth — no completed CI runs found on <label>; continuing without CI verification (graceful degradation, E14)`).
  proof: new test, budget `0` → exit 0 + the exact WARN regex VR-15 uses.
- **AC-E326-4** (`--sha` unchanged) — The commit-scoped path (E320) is unchanged.
  proof: `test/e320-ci-check-sha.test.mjs` (not owned) passes unmodified.
- **AC-E326-5** (gh-unavailable unchanged) — Spawn failure, non-zero `gh` exit and unparseable output degrade exactly as at base (lenient WARN, strict FAIL), on the first call, without polling.
  proof: existing gh-missing / gh-error / malformed-JSON VR tests pass unmodified.
- **AC-E326-6** (E238 untouched) — VR-22 (the `AGC_VERIFY_CI_WAIT_SECONDS=0` one-call/wall-clock test) is not edited and passes; VR-23 (default budget 480 s) is not edited and passes.
  proof: QA evidence quotes their pass lines; the diff of `test/verify-release.test.mjs` touches none of their lines.
- **AC-E326-7** (Check 6 scope — Option choice O-E326, see Dependencies) — Under the PM-recommended option A, Check 6 of the full release run (`verify-release.mjs vX.Y.Z`, lenient, :599) polls an empty list the same way (one rule in the shared evaluator, E163), and the one existing test that drives Check 6 with `[]` and no pinned budget (VR-15, test at :1002) gets `AGC_VERIFY_CI_WAIT_SECONDS: "0"` added — its assertions unchanged. Under option B, Check 6 keeps the immediate WARN and VR-15 is untouched.
  proof: option A — VR-15 passes with only the env pin added (diff shows one added line in that test); option B — VR-15 passes unmodified and a new test asserts Check 6 with `[]` makes exactly one gh call under a non-zero budget.
- No `content/**` change (`content/skill-release-engineer.md` 8b wording out of scope).

### E324 — no telemetry emit for any workspace path under `.current` (`tools/registry.ts`)

- **AC-E324-1** — Given `workspace_path = <ws>/.current/<lane>` (an existing directory) and a `tw_update_state` call carrying a bad `dispatch_pins` tier, when the zod boundary rejects it, then the original validation error is returned unchanged and `<ws>/.current/<lane>/.current` does not exist afterwards. Same for a deeper directory (e.g. `<ws>/.current/history/<bucket>`).
  proof: new case in `test/e303-zod-boundary-telemetry.test.mjs` (or `test/e324-*.test.mjs`) asserting `fs.existsSync(path.join(ws, ".current", "<lane>", ".current")) === false`.
- **AC-E324-2** — The guard is a path-segment test on the normalized absolute path (any segment exactly `.current`), replacing the basename-only check; a segment that merely contains the text (e.g. a workspace dir named `my.current-ws`) still emits; a path that normalizes out of `.current` (e.g. `<ws>/.current/..`) is judged after normalization.
  proof: new cases: `my.current-ws` workspace → emit count 1; existing E303-E2E1/E2E2 and the E317 case stay green unmodified.
- **AC-E324-3** — `dist/tools/registry.*` rebuilt and committed.
  proof: `git diff dac6069 --stat -- tools/ dist/tools/` lists `tools/registry.ts` and `dist/tools/registry.*` for this ticket.

### E325 — drift's handoff version peek survives a concurrent layout migration (`tools/drift.ts`)

- **AC-E325-1** — When the chosen handoff path is missing at read time (ENOENT/ENOTDIR, or `existsSync` false after the pick), `readArtifactVersion("handoff")` reads the other layout's path once (lane ↔ flat, both directions) and returns its version; no loop, no lock, no write, no migration.
  proof: new `test/e325-*.test.mjs` exercising the retry via a seam or a rename between pick and read (e.g. a test-only hook, or `fs` monkey-patching in-process against `dist/tools/drift.js`), forward and reverse.
- **AC-E325-2** — Neither file present → `null` as today; a present-but-unparseable file → unchanged behaviour (`null` from the catch, or `0` with no frontmatter).
  proof: new cases in the same file.
- **AC-E325-3** — `tools/handoff-parse.ts` is not edited (not owned). No exported helper there fits: `readHandoffFileIfPresent` and the E312 retry inside `readAndMigrate` are module-private, and the exported `parseHandoff` migrates in memory to CURRENT and refuses future versions — exactly what this peek must bypass (comment :214–218). The retry is therefore local to `tools/drift.ts`, mirroring E312's shape.
  proof: `git diff dac6069 --name-only` does not list `tools/handoff-parse.ts`.
- **AC-E325-4** — `dist/tools/drift.*` rebuilt and committed; existing `test/drift-*.test.mjs` green.
  proof: full-suite run.

### Lane-wide

- **AC-LANE-1** — The full suite is run once via `node scripts/test-lock.mjs -- npm test`, after the final commit, on a clean tree, on the lane's final HEAD; pass/total quoted in QA evidence.
- **AC-LANE-2** — `git diff dac6069 --name-only` lists only files in the manifest e287 row's `擁有` cell.
- **AC-LANE-3** — No new test asserts growable content of a real `specs/fanout-*.md`, and no new test diffs a file against a fixed base sha (in-test fixtures only). No local absolute paths in evidence or spec.

### Completion definition (manifest `完成定義` rows for e287, verbatim)

| 完成定義條目 | 由哪張票讓它成立 | ACs |
|---|---|---|
| finish 遇到 base 上沒有 `pending-tickets.md` 時會警告；點名別 repo 的新發現不在本機配號、列在輸出 | e287（E287） | AC-E287-1..10 |
| `workspace_path` 在 `.current` 之下時 zod 邊界 telemetry 不 emit | e287（E324） | AC-E324-1..3 |
| `tools/drift.ts` 併發遷移時不會因「先選再讀」少讀 handoff | e287（E325） | AC-E325-1..4 |
| 剛建的 release 分支 8b `--ci-check --strict` 在預算內輪詢、不立刻 FAIL | e287（E326） | AC-E326-1..7 |

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e287.unallocated-warning | stderr line(s) for AC-E287-1/2; must contain `agc feature finish —`, `pending-tickets.md`, the revision name, `not allocated`, the entry count, and each entry's `lane_local_id` | authored-here — operator-facing diagnostic; architect/sr fix the remaining wording, tests match on the quoted fragments only |
| e287.target-repo-line | one line per `target_repo` entry for AC-E287-6/7/9; must contain the `lane_local_id`, the target repo value, and `human ruling` | authored-here — D4 (`docs/integrator-revision-2026-10-08.md` §6.2) asks for a listing "待人類裁定"; same matching rule |
| e287.usage | added sentence(s) in `STR_USAGE_FEATURE` for AC-E287-10 | authored-here — usage text, not pinned by any test |
| verify-release.empty-list-reason | `no completed CI runs found on <label>` — unchanged from base | base `scripts/verify-release.mjs` :540 |

No user-facing strings in E324 / E325.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `content/**`, incl. `content/skill-release-engineer.md` 8b wording and the integrator SOP Stage 6 sentences pinned by `test/e246-mailbox-teardown.test.mjs`.
- `docs/lane-protocol.md` §4 (the `target_repo` field's documentation) — filed as a lane finding (AC-E287-10).
- E291 (configurable `node_modules` link locations, same `bin/agc-init.mjs`, next wave); E292 (sister-repo declaration, D1/D2); E288 (D3 hand-off format).
- Numbering findings from the worktree's working copy (bypassing the git object db) — see Q1 option b.
- Changing the existing refusal when the pending file IS at the revision but `docs/backlog.md` is not (for local entries).
- `tools/handoff-parse.ts`, `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, `templates/**`, `index.ts`, and every other path the manifest e287 row forbids.
- A workspace genuinely located below an ancestor directory named `.current` loses zod-boundary telemetry (accepted consequence of the ticket's "any `.current` segment" fix shape).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks) — integrator / release-engineer.

## Dependencies / Prerequisites

- Lane base `dac6069` (wave 5 manifest merged into `main`). No cross-lane dependency (manifest `相依` = 無). `bin/agc-init.mjs` is assigned to e287 this wave only.
- Resource Audit: zero external references — the tickets cite only in-repo files; no fetch needed.
- `dispatch_pins`: `sr-engineer=opus` (manifest Dispatch pins).
- Routing: pm → **architect** (mandatory for E287, human-approved 2026-10-16; the architect's Open Questions go to the integrator mailbox for a second pre-review before human approval) → sr-engineer → code-reviewer → qa-engineer.
- **One sr pass**: the four tickets touch pairwise-disjoint files (E287: `bin/agc-init.mjs` + `tools/lane-ticket-allocation.ts`; E324: `tools/registry.ts`; E325: `tools/drift.ts`; E326: `scripts/verify-release.mjs`) and share no contract, so one sr-engineer pass after the architect is feasible. E324/E325/E326 do not depend on the architecture; E287 is the bulk. If the hop budget runs tight, sr may land the three small fixes first as separate commits.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

### Open Questions for the architect (E287) — with PM proposals

- **Q1 — where untracked findings go.** Options: (a) warn-only; the findings' durable home is the existing per-lane harvest copy `.current/history/<YYYY-MM>/<lane>/pending-tickets.md`, which the warning names; a human numbers them by hand. (b) (a), plus when `docs/backlog.md` is tracked at `--base`, number them from the worktree copy and commit the backlog rows. (c) (a), plus append them to a primary-side aggregate file for repos with no backlog. **PM proposal: (a)** — it uses the copy finish already makes, adds no file format, and keeps E179's rule that only content read from git's object db (what was reviewed and merged) gets numbered; (b) breaks that rule, (c) adds a file with no consumer.
- **Q2 — the copy is not always made.** The shipped harvest copies `.current/<lane>/` only when it has no tracked content (`planLaneClose` `harvestSrc`); the abandoned harvest likewise (`planAbandonCurrentHarvest` :1763, AC8). A lane with tracked `.current/<lane>/` but an ignored `pending-tickets.md` loses the file at `git worktree remove`. **PM proposal:** copy that one file into the history dir too (same COPYFILE_EXCL / re-run discipline as the E180 evidence harvest), rather than refusing.
- **Q3 — the D4 field.** **PM proposal:** `target_repo: <non-empty string>`, free text (a repo name or path as the lane knows it); presence alone means "not this repo" — no comparison against this repo's identity (a lane wanting a local id omits the field). Parsed into `PendingTicketEntry` in `tools/lane-ticket-allocation.ts`.
- **Q4 — state of a listed `target_repo` block.** If it stays live, `agc check` flags an abandoned branch forever and re-runs re-list it; if it is moved under `## Applied` it has no backlog provenance, which `parsePendingTickets` (with `appliedLaneLocalIds`) reports as an error on the next run. **PM proposal:** archive it under `## Applied` in the same commit as the local entries, and exempt archived `target_repo` blocks from the provenance check; the orphan scan then ignores them naturally.
- **Q5 — a local entry whose `depends_on` names a `target_repo` entry's `lane_local_id`.** **PM proposal:** refuse as an unresolvable reference (existing fail-closed path, nothing applied), with a reason naming `target_repo`, so the lane rewrites it as prose.
- **Q6 — output stream.** **PM proposal:** both the O6 warning and the D4 listing go to stderr with the `agc feature finish — ` prefix (the D4 listing is a request for a human ruling, the same class as the kept-mailbox warning).

### Option choice for the human (E326)

- **O-E326 — does Check 6 of the full release run also poll an empty branch-scoped list?** (A) yes — one rule in the shared evaluator (E163 made Check 6 and `--ci-check` share it; Check 6 already polls a non-empty list that lacks the sha, E80), so a full release run on a branch with no completed CI run waits up to the budget (default 480 s) before its lenient WARN; VR-15 needs `AGC_VERIFY_CI_WAIT_SECONDS: "0"` added (one-line qa edit, assertions unchanged). (B) no — poll only under `--ci-check`; Check 6 and VR-15 unchanged. **PM recommendation: A** (the manifest wording "分支範圍的空清單也在輪詢預算內輪詢…照 `--strict`" names no mode carve-out, and a mode-specific branch re-introduces the divergence E163 removed).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E287-01 | sr: finish warns when the lane's `pending-tickets.md` is in the worktree but not at the revision, names where it lives, never loses the only copy; `target_repo` findings parsed, never numbered, listed for a human ruling; usage text; file the doc follow-up as a lane finding (AC-E287-1..10, per architecture) | architect | 3–4 | `bin/agc-init.mjs`, `tools/lane-ticket-allocation.ts`, `dist/tools/lane-ticket-allocation.*` | — |
| T-E324-01 | sr: `emitZodGateTelemetry` skips any normalized `workspace_path` with a `.current` segment; rebuild dist (AC-E324-1..3) | none | 3 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E325-01 | sr: `readArtifactVersion` handoff peek re-reads the other layout once on a pick-then-read miss, local to drift.ts; rebuild dist (AC-E325-1..4) | none | 3 | `tools/drift.ts`, `dist/tools/drift.*` | — |
| T-E326-01 | sr: poll an empty branch-scoped run list within the budget, then strict FAIL / lenient WARN with the unchanged reason; `--sha` and gh-unavailable paths unchanged (AC-E326-1..7, option per human ruling) | none | 1 | `scripts/verify-release.mjs` | — |
| T-E287-02 | qa: E287 tests + re-pins (only if needed) in owned finish tests; lane-wide full suite on final HEAD, clean tree (AC-E287-1..10, AC-LANE-1..3) | T-E287-01, T-E324-01, T-E325-01, T-E326-01 | 1–4 | `test/e287-*.test.mjs`, `test/lane-ticket-allocation.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs` | — |
| T-E324-02 | qa: E324 cases (AC-E324-1..2) | T-E324-01 | 1 | `test/e303-zod-boundary-telemetry.test.mjs`, `test/e324-*.test.mjs` | — |
| T-E325-02 | qa: E325 cases (AC-E325-1..2) | T-E325-01 | 1 | `test/e325-*.test.mjs` | — |
| T-E326-02 | qa: E326 cases; VR-15 budget pin under option A; VR-22/VR-23 untouched (AC-E326-1..7) | T-E326-01 | 1–2 | `test/verify-release.test.mjs`, `test/e326-*.test.mjs` | — |
