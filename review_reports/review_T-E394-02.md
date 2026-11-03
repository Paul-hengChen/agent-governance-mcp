# Review — T-E394-02..T-E394-10 (e394-release-sop-rewrite)

covers: T-E394-02, T-E394-03, T-E394-04, T-E394-05, T-E394-06, T-E394-07, T-E394-08, T-E394-09, T-E394-10

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: whole lane diff `<base>..HEAD` (`<base>` = `git merge-base HEAD main`): new `scripts/release.mjs` (1061 lines, three phases `prepare` / `publish` / `close-out`, 31 exit classes, array-argv runner with a runtime allow-list and a dry-run recorder), `specs/release-sop-history.md` (16 verbatim units), `content/skill-release-engineer.md` rewritten whole (14,320 B), the expected-red manifest and lane bookkeeping.
- Judged against `specs/e394-release-sop-rewrite.md` (AC-S1..S9, P1..P10, H1..H8, L1) and `specs/e394-release-sop-rewrite-architecture.md` with the integrator rulings (read-only `ls-remote` / `gh auth status` / `gh release view`; AC4 before the commit with the `Stage the missing files and re-run.` remedy; E1A/E9A/E4X folds).
- Beyond reading: ran the three phases end to end on a throwaway fixture repo (real git with a bare `origin`, `gh` and the absorbed node scripts simulated): `prepare --dry-run` left status, every local ref and every origin ref byte-identical; real `prepare` made the release commit with the archive moves, drift baseline and stamps, pushed `release/vX.Y.Z` and opened the PR; a re-run skipped commit and push. `publish` (dry-run, real, re-run) merged, tagged the merge commit locally and on origin, deleted the branch, and the re-run skipped tag and push. `close-out` (dry-run, real after a simulated kill mid-wait) committed only the lane handoff + jsonl, merged, pulled and finished `CLOSE-OUT PASSED` on a clean `main`.
- Verdict: APPROVED. No required finding. Three recommended and four optional findings below. None blocks qa (T-E394-11..16).

## AC Completeness
AC-S1 — implemented — `scripts/release.mjs:129-153` (dry-run records mutate/fs/deferred), `:253` (`fetch` recorded only), `:1051` (DRY-RUN OK line); fixture probe: zero change to tree, index, refs and origin.
AC-S2 — implemented — `scripts/release.mjs:17-28` equals the architecture table row for row (code, id, phases; machine-compared); 31 distinct codes and ids; `:1053-1057` prints `RELEASE_STOP <CLASS_ID>: <detail>` last on stderr, detail single-lined at `:33`.
AC-S3 — implemented — `scripts/release.mjs:62-106`, `spawnSync` only at `:123`, `node` children via `process.execPath`; probe: `push origin main`, `--force`, `branch -D`, `tag -d`, `--squash`, `--admin`, `--amend`, `checkout`, `reset`, `rebase`, `clean`, `stash`, `update-ref`, `merge`, `:`-refspecs, `bash`, `npm`, `pull` off `main` all refused; mutate/read kind cross-checked at `:104`.
AC-S4 — implemented — `scripts/release.mjs:286-380` (per-tree guard before any write, byte-identical stop string, `<CODES>` logged also when empty, no-clobber moves, `expected-red_*` per feature, `covers:` sweep in its own tree). Fixture-level parity with the base fragments is qa's ST retarget (T-E394-12).
AC-S5 — implemented — `scripts/release.mjs:387-410` (7b), `:426-472` (7c rows + stray-diff check, then `check-bookkeeping.mjs`), `:476-513` (7d, all three checked before the first write, `agc-init.mjs check` deferred after a write).
AC-S6 — implemented — `scripts/release.mjs:521-573` (existence-filtered plan, one `git add --`, feature-dir + root-file completeness with `.current/` excluded), `:576-632` (citations over `PREV_TAG..HEAD` ∪ stage, `(context, not changed)` exempts membership only), `:637-699` (AC4 before the commit, REQUIRE remedy per the ruling, UNCLASSIFIABLE verbatim), `:708-736` (`commit -F`, `push -u`, `gh pr create --base main`); no merge, no tag.
AC-S7 — implemented — `scripts/release.mjs:852-904`; tag-exists stop before any merge (`:855-861`), strict CI gate (`:865-868`), `--auto --merge`, MERGED wait, `switch main` + `pull --ff-only` + HEAD = merge oid, `tag -a`, push tag, `branch -d`, `gh release create --verify-tag` with CHANGELOG body + `## Install`, then `verify-release.mjs vX.Y.Z`. See the `--sha` deviation under Architecture.
AC-S8 — implemented — `scripts/release.mjs:942-1034`; compiled `resolveCurrentLane`, closing-write precheck, enumerated `*.jsonl` (no glob), empty stage stops twice (before and after `git add`), bookkeeping PR merged before `--close-out`, `classifyCloseOut` maps the two FAILs to 54 / 55.
AC-S9 — implemented — subprocess only (`:263`, `:467`, `:865`, `:901`, `:1028`); the three scripts are byte-unchanged (`git diff <base>..HEAD -- scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs` empty); release.mjs re-implements none of their checks.
AC-P1 — implemented — `content/skill-release-engineer.md:1-4`, sections at `:6`, `:9`, `:12`, `:24`, `:33`, `:61` in order; frontmatter byte-identical to base.
AC-P2 — implemented — `content/skill-release-engineer.md:36-38` (step 3: bump, CHANGELOG, advisory disposition) precedes the first phase (step 12).
AC-P3 — implemented — `content/skill-release-engineer.md:34-46` (prose steps 1–11), `:47-54` (three phase command lines, `--dry-run` first).
AC-P4 — implemented — `content/skill-release-engineer.md:65-106`: 31 `exit N CLASS` rows equal `EXIT_CLASSES` in order (machine-checked) + 9 non-script rows covering every row the AC names; `next_role` cells ∈ {`—`, `pm`, `qa-engineer`}; `—` defined as omit at `:63`.
AC-P5 — implemented — `content/skill-release-engineer.md:51-55` and Output rule `:10`.
AC-P6 — implemented — `content/skill-release-engineer.md:13-22` (all nine retained rules; §6 pointer at `:15`; record integrity at `:21`).
AC-P7 — implemented — `content/skill-release-engineer.md:25-31`; base MUST-NOT list kept; script-performs-writes sentence at `:29`.
AC-P8 — implemented — no 7–40 hex token, no `v<d>.<d>.<d>`, one history pointer (`:108`, last line).
AC-P9 — implemented — glue-free on `switchRole` and `buildPromptForRole` (both `fullDetail` settings) by the T-E69-02 detector run ad hoc; zero raw markers in the file; the red T-E69-02 / T-E8795-02 tests fail on base anchors only (`- \`mkdir -p\``, `7b.` header, E95 bullet) — Re-pin Map row, T-E394-14.
AC-P10 — implemented — all 16 units re-verified: each base range `a..b` occurs verbatim in `specs/release-sop-history.md` and its sha256 prefix equals the architecture table (16/16); provenance header present.
AC-H1 — implemented — no file under `test/` changed in the lane diff; the three CLIs unchanged.
AC-H2 — implemented — relative-import grep over the three scripts prints nothing.
AC-H3 — implemented — `npm run -s check:version` exit 0, `npm run -s check:bookkeeping` exit 0 on lane HEAD.
AC-H4 — implemented — no `dist/` path in the lane diff; `dist/` clean after the suite's prebuild.
AC-H5 — implemented — `wc -c` = 14,320 ≤ 15,000.
AC-H6 — implemented — `` `gates/registry.ts` (`GATE_REGISTRY`) `` occurs once (`:31`), no gate count.
AC-H7 — implemented — changed paths: `scripts/release.mjs`, `specs/release-sop-history.md`, `content/skill-release-engineer.md`, the two E394 specs, `qa_reports/expected-red_e394-release-sop-rewrite.txt`, `.current/e394/**`; nothing under `templates/`, `prompts/`, `tools/`, `gates/`, `package.json`, `CLAUDE.md`.
AC-H8 — implemented — frontmatter unchanged; `test/subagent-templates.test.mjs` untouched.
AC-L1 — partial (by design) — the 69-id table is the architecture's; the carrier assertions are qa's T-E394-11/12/15, not this diff. Not a finding against sr scope.
AC-T1, AC-T2 — qa scope (T-E394-11..16); see the expected-red disposition under Correctness.

## Correctness
No required findings.

Deviation judgments (each checked against the base SOP text at `<base>` and the architecture):
- T-02 `STAGE_PATHS` declared early: harmless; the scope rule and the stage plan share one list (`:40-49`). Accepted.
- T-02 `Runner.deferred` returns the result on a real run (architecture said `void`): required, since 7d / 8a-1 / 8c-2 / 9a / 13b act on that result. Accepted.
- T-02 fetch failure → `STALE_BASE`: the base cannot be verified without the fetch; Blocked with a recovery that re-baselines is the right posture. Accepted.
- T-02 CLOSED bookkeeping PR → `PR_CANNOT_MERGE` (`:278`): matches the class trigger "PR closed/absent". Accepted.
- T-03 no `git log --grep` CODES fallback: correct — base 7a explicitly derives `<CODES>` from working-tree files and forbids hunting commit subjects (base line 114). Accepted.
- T-04 `--tickets none` keeps the backlog stray-diff check with an empty id set (`:437-440`): stricter than the architecture sentence, consistent with the Artifact allowlist (no row → no backlog edit) and documented in SOP step 10. Accepted.
- T-05 `-z` / `--no-renames`: correct for paths with spaces and for rename-split membership. Negated CHANGELOG mentions need `(context, not changed)` immediately after the span (`:589`): matches base 8a, which exempted only marked paths; base had no negation exemption. Accepted (the SOP Record-integrity rule now says so explicitly).
- T-06 exact set membership: equals base "appears in `git diff … --name-only`". MERGED PR on a prepare re-run: in practice `STALE_BASE` (11) fires first (origin/main holds the merge commit), or `WRONG_BRANCH` on `main`; either stops before any mutation (see O4). Accepted.
- T-07 `--sha <headRefOid>` on the strict gate: `verify-release.mjs` keeps `--strict` semantics in `--sha` mode (every cannot-answer path FAILs; no completed run for the sha within budget FAILs), and the sha is asserted equal to HEAD at `:272`; it removes the dependency on upstream-derived branch naming. `ALLOWED` admits only that form (`:77-78`). Accepted; architecture text should follow (O3). `--verify-tag`: prevents gh creating a tag. HEAD = oid assert skipped when the tag is already at the oid locally or on origin: nothing will be tagged, so the assert has nothing to protect. Accepted.
- T-08 close-out "main contains the merge oid" (`:1023-1026`) instead of HEAD = oid: close-out tags nothing, containment is the meaningful check. Existing bookkeeping PR skips the closing-write precheck: that PR can only have been opened after the precheck passed in an earlier run. Runtime import of `dist/tools/lane-paths.js`: as the architecture specifies. Accepted.
- T-10 step order (decisions incl. advisory disposition at step 3, before the pre-flight CI at step 4): satisfies AC-P2; the cost is at most one human question before a red `main` is detected. Escalation rows reference the SOP's own numbering consistently. Accepted.

Expected-red disposition (step 4a): `qa_reports/expected-red_e394-release-sop-rewrite.txt` exists; 65 entries, every file in the spec's Test Re-pin Map. Sampled 4 entries by grep in the named file — `render-structure` T-E69-02 (switchRole), `release-staging` E59, `verify-release` VR-9b, `e336-portable-pull` AC-E336-1 — all real, locatable tests. Full suite under the test lock (`node scripts/test-lock.mjs -- npm test` at lane HEAD): 3779 pass / 65 fail / 2 skipped of 3846; the 65 failing test names equal the manifest's 65 entries exactly (set difference empty both ways), so there is no red outside the Re-pin Map.
- E59 ("unedited" in the map, red here): acceptable as-is. Its two SOP-site anchors require the base label `6a. **Dependency-audit disposition**`, which the fixed new numbering removes; the new step 3(c) keeps the bold label and both bold bullets verbatim, its excerpt names `disposition` and contains no `waived`, so qa's T-E394-12 re-pin is an anchor-prefix change that preserves E59's intent. The file is in the map (AC-T1 is file-level); the "unedited" cell was a planning prediction, not a contract.
- `verify-release.test.mjs` VR-9b / VR-9c: SOP-wording pins in the VR-9 family; AC-H1 protects only its non-SOP-wording tests. Acceptable.

## Quality
- **O2 (optional)** `scripts/release.mjs:295` — the comment's example basename uses a real ticket code (`review_T-E37-01.md` → E37); a neutral placeholder (e.g. `review_T-ABC-01.md`) reads better for non-agc readers. Kept otherwise: every other comment states a constraint or reason, cites no ticket, sha or version (comment-discipline check clean).
- Naming and structure fit the repo's other `scripts/*.mjs`; exports match the architecture's interface table.

## Architecture
- Phase split, step order per phase, exit table, data structures, allow-list, dry-run semantics, absorption (subprocess only, zero diff to the three scripts) and the single-file constraint all follow the architecture.
- **O3 (optional)** — text drift to fold into the architecture at its next touch, no code change: 8b-2 / AC-S7 read `--ci-check --strict` while the script passes `--strict --sha <release head>`; the Exit-Code table points `DONE_MARK` at "SOP step 11" while the SOP's done-mark step is 10; the SOP outline's step 3/4 order is swapped (decisions before pre-flight).

## Security
- Array argv everywhere; one `spawnSync` call site; no shell, no `bash`/`sh`/`npm` child; `node` children are the four named repo scripts via `process.execPath`.
- Path containment: `active_feature`, expected-red feature names and the lane name pass `safeSegment` (`:291`); every fs write/move/mkdir goes through `inside()` (`:114-118`); `--state` / `--message-file` must resolve (realpath) outside the repository; citation existence is checked inside the repository only (`:622-625`).
- No secrets, no absolute paths, no network beyond `git`/`gh`.
- **O1 (optional)** `scripts/release.mjs:71-72` — read-only verbs accept any arguments, so the runtime guard would admit e.g. `git diff --output=<file>` (a write). The script never builds such an argv; refusing `--output` / `-o` on read verbs would make the guard match its read-only label.

## Performance
- No hot path. The merge wait polls at ≥ 1 s within a bounded budget (`:802-817`); the archive step lists each tree once and reads `covers:` lines only for root `.md` files; `classifySpecCheck` uses a Set. No regression against a prose-driven release.

## Recommended findings (non-blocking)
- **R1 (recommended)** `scripts/release.mjs:210-221` with SOP step 1 (`content/skill-release-engineer.md:34`) — AC-S6 MULTI-FEATURE fidelity. The `--state` file is the `tw_get_state` read view, which elides `pending_notes` beyond the read-view budget and inserts a `⟦agc read-view⟧ … omitted` marker; a `Multi-feature release:` line can be among the elided notes, so M reads false and a line-named feature whose spec exists but is absent from the range no longer stops. Suggest `preInputs` stop `USAGE` when any `pending_notes` entry contains the read-view marker (or the SOP says to save the full notes), so the snapshot is never silently partial.
- **R2 (recommended)** `scripts/release.mjs:1061` — exit contract (AC-S2). `process.exit(await main(…))` can drop still-queued stdout/stderr when stdio is a pipe on macOS (asynchronous pipe writes there), which on a large forwarded child output could lose the final `RELEASE_STOP` line. `process.exitCode = await main(…)` lets the streams drain.
- **R3 (recommended)** `scripts/release.mjs:262` — the stale-README-pin check is a substring test: with `PREV_TAG` `vA.B.1` and new version `A.B.10`, `#vA.B.10` contains `#vA.B.1`, so a correct bump stops `VERSION_INCOHERENT`. Use the same token boundary as `versionToken` (`:421`).
- **O4 (optional)** SOP step 13 / `scripts/release.mjs:865` — the `publish --dry-run` runs the strict CI gate for real (a read), so the dry-run itself can wait up to the CI budget; one clause in step 13 would set that expectation.

## Verdict
APPROVED — every AC in sr scope is implemented, the three absorbed scripts and `dist/` are untouched, the history move is byte-verified, the exit/Escalation bijection holds, and the fixture runs of all three phases behave as specified; the findings are recommended/optional hardening only.

## Round 2 — APPROVED — by code-reviewer

Re-review of the qa FAIL round 1 fix, task T-E394-02 (touches T-E394-10 SOP step 1). Diff `2932dad..HEAD -- scripts/release.mjs content/skill-release-engineer.md` (b387c9e, 01b102d). Reviewer did not build the fix; same model family as sr (opus), so independence rests on clean context.

## Summary
- README pin checks now match `#<tag>` as a whole token (`pinsTag`, `scripts/release.mjs:211-212`, used at `:297-298`).
- CLI entry guard compares real paths (`:1097-1104`); `preInputs` refuses a truncated read view (`:216-219`, `:251`).
- `--state` also takes a verbatim `handoff.md` copy, parsed by the compiled canonical parser in a throwaway `os.tmpdir()` workspace (`:223-245`); SOP step 1 changed by one sentence (`content/skill-release-engineer.md:34`).
- Verdict: APPROVED. Two recommended findings, none blocking.

## AC Completeness
covers: T-E394-02
AC-S2 (R3 stale pin) — implemented — `scripts/release.mjs:211-212,297-298`; `test/e394-release-script.test.mjs:353` green with no test edit (e394 files 86/86).
AC-S1 / pre-1 USAGE (`--state` contract, integrator ruling b') — implemented — `scripts/release.mjs:216-256`.
AC-P3 / SOP step 1 — implemented — `content/skill-release-engineer.md:34`; SOP 14,434 B (≤ 15,000); the SOP structure tests (Escalation bijection included) pass.
AC-S3 (verb allow-list) — unchanged — the diff adds no `spawn`/`git`/`gh` call and no shell; `parseHandoff` resolves the lane by pure fs (`tools/lane-paths.ts:239-272`, no subprocess).
AC-S9 / three absorbed scripts and `dist/` — unchanged — `git diff 89e01c6..HEAD -- scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs dist` is empty.

## Correctness
No required findings. Probes run from a scratch dir via a symlinked `scripts/` dir (`node <link>/release.mjs prepare … --dry-run`):
- lane copy (code-reviewer, In_Progress) → USAGE 2; PASS copy → passes pre-1, stops WRONG_BRANCH 10 as expected on a feature branch; untruncated JSON → same.
- JSON with `completed_tasks_truncated` → USAGE; JSON with a `⟦agc read-view⟧` note → USAGE; malformed frontmatter → USAGE with the parser's message.
- `release-state-*` dirs under `os.tmpdir()`: 0 before, 0 after all runs (including the throw paths); worktree status unchanged by the runs.
- Symlinked absolute invocation with a bad phase → exit 2 (was silent 0); `import()` of the module through the symlink does not run `main`.
- `pinsTag` regex: `#v1\.2\.1(?!\w|\.\d)` rejects `#v1.2.10`, and tag `v1.2.10` rejects `#v1.2.100`; `reEscape` covers every regex metacharacter a `git describe` tag can carry.
- `completed_tasks_truncated` is in scope: step 7b (`:438`) writes `ctx.state.completed_tasks` into `driftBaselineIds`, and the read view keeps only the last 50 ids (`tools/handoff-parse.ts:704-722`), so accepting it would silently drop baseline ids.
- `preInputs` became async; the phase runner already awaits every step (`:1085`).

## Quality
- **R1 (recommended)** `scripts/release.mjs:243` — the fence detection strips a leading BOM, but `parseHandoffCopy` writes the original text (`:230`), so the parser's `^---` frontmatter match fails and a BOM copy stops USAGE with `(got undefined, )` — fails closed, but the message points at the wrong cause. Either write the BOM-stripped text or drop the BOM tolerance. A server-written or `cp` copy carries no BOM, so this is cosmetic.
- Comment discipline (Constitution §6): the added comments state what the code does, carry no ticket id, sha or local path; `E37` example neutralised to `ABC` (`:331`). The `:221-222` comment says the parser "may write migration results there" — `parseHandoff` itself does not write, but the comment errs safe; kept.
- `READ_VIEW_MARKER` duplicates `READ_VIEW_MARKER_PREFIX` (`tools/handoff-types.ts:17`); acceptable in a script that only imports `dist/` lazily, and `startsWith` matches where the reader places it (`tools/handoff-parse.ts:61`).

## Architecture
- **R2 (recommended)** `specs/e394-release-sop-rewrite-architecture.md:41,208,438,483` still describe `--state` as the `tw_get_state` JSON only. The handoff-copy form comes from an integrator ruling recorded outside the repo; the implementation is a superset (JSON form kept), so it does not contradict the doc, but the doc should name the second form and the truncation refusal (architect/pm follow-up, not sr scope).
- Parsing reuses the canonical parser (no duplicated YAML/section parsing), injectable via `deps.importHandoffParse`; layering fits the doc's "script reads compiled helpers" pattern.

## Security
No findings. The temp workspace is `mkdtempSync` under `os.tmpdir()` (unpredictable name), removed in `finally`; nothing is written under the repository. The dynamic import path is fixed (`<root>/dist/tools/handoff-parse.js`), never input-derived. `--state` still goes through `readInput`'s outside-the-root check before any parse.

## Performance
No findings. One extra temp dir + one file write + one module import per `prepare` run; no hot path.

## Expected-red and suite
`node scripts/test-lock.mjs -- npm test`: 3864 pass / 66 fail / 2 skipped of 3932. 65 fails are listed in `qa_reports/expected-red_e394-release-sop-rewrite.txt` (sampled 3: `test/e130-lane-default.test.mjs` AC11, `test/release-staging.test.mjs` D10-AC1, `test/render-structure.test.mjs` T-E8795-02 — all locatable). The one unlisted fail is `test/render-structure.test.mjs:567` (T-E77-02) flagging `test/e394-release-sop.test.mjs:31` (`git show ${BASE}:…`) — a qa-authored test file reading repository history, not an implementation defect; qa owns it next round.

## Verdict
APPROVED — all five fix items are implemented and verified by probe, the R3 red is green without a test edit, no new git/gh verb or repository mutation is introduced, and the two findings are recommended only.
