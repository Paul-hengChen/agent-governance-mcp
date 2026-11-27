# Review — T-E447-01 (round 1, batched)

covers: T-E447-01, T-E447-02, T-E447-03, T-E447-04, T-E447-05, T-E447-06, T-E447-07

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Feature `e447-local-knowledge-files`, lane e447, branch `feat/e447-local-knowledge-files`, diff `07a6d47..HEAD` (44 files, +2759 / −60). Inputs read: `specs/e447-local-knowledge-files.md`, `qa_reports/tests_e447-local-knowledge-files.md`, `qa_reports/expected-red_e447-local-knowledge-files.txt`, `test/e447-*.test.mjs`, the diff. No ticket file (spec line 3 cites a backlog row), so the spec's AC1–AC12 are the scenarios.

Human rulings on record and honoured: cut approval 2026-11-26 — O1 (a), O2 (a), O3 (a), D1–D10 as written. Post-approval Copy amendment to DOC-INST-5 (a leading `. With` instead of ` With`, so the appended sentence no longer runs on from the existing cell), consented by the human on 2026-11-27 ("ok, 同意"), recorded at spec line 20 and the DOC-INST-5 block. The amendment shipped at 7cdc9f7. My judge run confirms that the old (iii) cell is an exact prefix of the new one and that the appended tail equals the amended DOC-INST-5 byte for byte.

Process note, recorded once: during T-E447-02 the sr session used `git commit --amend` on an unpushed commit (the integrator has already recorded it); the T-E447-02 commit under review is 18ffb6f. This finding does not depend on that note.

## Summary

- Adds an opt-in `"knowledge": "local"` mode. `agc init --knowledge` writes the exclude rules, refuses without local artifacts (D1) and defaults the adapter (D2). `feature start` seeds the lane and writes a hash record. `feature reseed` is new. `finish` copies back only the files the record filter selects (O3 (a), D6, D7) and numbers findings into the primary checkout's untracked backlog. `check --cut` adds a `MANIFEST_CHANGED` byte comparison (D9). The change also adds three SOP texts, three docs sections and the qa re-pins.
- Scope is clean: every touched file is in the e447 owned set, the implicit lane bookkeeping, or the three integrator-assigned tests. Nothing in `gates/**`, `prompts/**`, `templates/**`, `tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `docs/backlog.md`, `specs/fanout-*.md` or e446's set. `GATE_REGISTRY` = 33, pipeline = 17 steps.
- AC1–AC12 are implemented and their tests pass. Each test asserts its scenario's outcome on the CLI and on scratch repos.
- Verdict: **CHANGES_REQUESTED**. The blocking findings: 12 user-facing strings that no Copy row lists (SOP 5a, a scenario defect); several new behaviours and refusals that no scenario or test covers (item 1); one wrong fact in `docs/install.md`; and a re-run of `finish --shipped` that cannot finish on its own after a late failure when the lane changed the backlog.

## AC Completeness

- AC1 — implemented — `bin/agc-init.mjs` runInit knowledge block (~L469–L491, L676–L705), seedLaneKnowledge, planKnowledgeHarvest/Numbering; test `AC1` green.
- AC2 — implemented — (a) knowledgeTicketDir + `/${ticketDir}/` rule; (b) agcAdapters filter (tracked or unstamped files get no rule); (c) the tracked-path errBlock; (d) usageError for needs-local; (e) parseInitArgs; (f) artifactExcludeRulesForPrefix. Tests `AC2 (a)`…`(f)` green.
- AC3 — implemented — `seedLaneKnowledge` (bin/agc-init.mjs:2046); test `AC3` green.
- AC4 — implemented — tracked set from `ls-files` in primary, lane-absent check, `readKnowledgeBytes` dangling branch; test `AC4` green (resolving symlink also covered).
- AC5 — implemented — `planKnowledgeHarvest` (:2371) same-path destination, unchanged count, `planEvidenceHarvestOutsideKnowledge` (:2356) drops `specs` from the archive harvest; test `AC5` green.
- AC6 — implemented — overwrite branch (primary still at the recorded hash) and the e180 refuse line before any mutation; tests `AC6 overwrite`, `AC6 both changed` green.
- AC7 — implemented — `planKnowledgeNumbering` (:2461) / `applyKnowledgeNumbering` (:2477); test `AC7` green (plain run and the re-run after a late failure with an unchanged backlog).
- AC8 — implemented — `--abandoned` destination `<root>/abandoned/<lane>/…`; test `AC8` green.
- AC9 — implemented — `manifestChangedFailure` (tools/fanout-manifest.ts ~L2540) + `checkCut` extraFailures; `runFeatureReseed` (bin/agc-init.mjs:2272); tests `AC9 match` / `changed` / `reseed` / `reseed refuses` / `reseed boundaries` green.
- AC10 — implemented — mode off: no rule, no key, no seed, no new finish line, the `specs/archive` rule and the E287 warning unchanged; the existing finish suites pass unedited in the full run. The `check --cut` half: see judgement item (2) under Correctness.
- AC11 — implemented — C-C08K const-08 line 6, C-CO3K and C-IN-R4 appended; test `AC11` green; goldens explained (below).
- AC12 — implemented — test `AC12` green; my judge run of `git diff 07a6d47..HEAD -- docs/config.md docs/install.md docs/lane-protocol.md` shows additions only, apart from the (iii) eject row, whose old text is an exact prefix of the new. But see R3: one DOC-INST-4 fact is wrong.

## Correctness

**R1 — required (scenario defect, SOP 5a): user-facing strings no Copy row lists.** The spec's Copy / Strings table lists every CLI diagnostic this feature designs, error lines included. The diff prints these 12 strings that it does not list:
1. `bin/agc-init.mjs:486` — `agc init: refusing --knowledge=local — ticketDir "<dir>" contains a character unsafe for a gitignore exclude rule …` (exit 2)
2. `:615` — `<config>: could not add "knowledge" — left untouched (…)` (warning)
3. `:1322` — the finish paragraph of `STR_USAGE_FEATURE` (`With "knowledge": "local", copies back only the knowledge files …`). e447.usage-feature lists only the start addition and the reseed block.
4. `:2056` — `agc feature start — warning: <seed> would not be ignored by git in the lane — no knowledge file copied (…)`
5. `:2091` — `agc feature start — warning: could not copy <rel> into the lane (…) — not seeded`
6. `:2103` — `agc feature start — warning: could not seed the lane's knowledge files (…) — copy them by hand or re-run in a new lane`
7. `:2274` — `agc feature reseed: expected at least one <path>` (usage, exit 2)
8. `:2314` — `agc feature reseed: cannot read <seed> (…) — nothing changed`
9. `:2326` — `agc feature reseed: <rel> is not ignored by git in this lane (tracked, or no exclude rule) — nothing changed`
10. `:2328` — `agc feature reseed: <rel> is not a file in the primary checkout — nothing changed`
11. `:2378` — `agc feature finish <verb>: cannot read .current/<lane>/knowledge-seed.json (…) — nothing removed`
12. `:2438` — `agc feature finish <verb>: harvest of <rel> into the primary checkout failed (…) — worktree and branch left in place (re-running finish is safe)`

Per SOP 5a the judge does not ratify these after the fact. pm sources each one, adopting or rewording it, as a Copy row. This lane already treated a one-character Copy change (DOC-INST-5) as a post-approval amendment that needed the human's consent, so the same treatment applies here.

**R2 — required (scenario defect → pm, then test defect → qa): sr-added behaviours with no scenario or test (judgement item 1).** Some of these decide new behaviour; others extend behaviour that the spec's "refuse before any mutation, nothing changed" pattern already decides. Each one needs a scenario (pm) and a test (qa) that fails when its outcome is wrong:
- (a) finish in mode on with **no seed record**: every lane knowledge file counts as created. This is new behaviour; pm decides it.
- (b) `finish --shipped` with a **lane-changed `docs/backlog.md`** and findings to number: the rows are appended to the lane copy, which then replaces the primary copy. This is new behaviour; pm decides it, together with R4.
- (c) finish refusals: a malformed or unreadable seed record (refuses, nothing removed: probed, exit 1); a blocking non-directory ancestor at the destination (refuses with the e180 line: probed); blocks to number with the primary backlog absent; malformed pending blocks in mode on.
- (d) reseed: a knowledge path that is tracked in the lane (or not ignored there) is refused; a path that is not a file in the primary checkout is refused (probed, exit 1); an unreadable seed record is refused; no operand gives exit 2; a lane-absent, unrecorded file is seeded fresh.
- (e) init: the ticketDir unsafe-character refusal (exit 2, nothing written).
- (f) `check --cut`: a malformed primary config counts as mode off; a manifest outside the lane worktree is not compared.

Accepted as untested (optional): start's per-file copy-failure and whole-seeding-failure warnings (fail-safe: they only seed fewer files, and are hard to provoke portably), the submodule-style `.git` skip in `check --cut`, and the `.current/<lane>/` not-ignored start warning, unless pm chooses to make it a scenario.

**R3 — required (implementation defect → sr): wrong fact in shipped docs.** `docs/install.md:235` reads "`specs/` included — in this mode it does not go to `specs/abandoned/`". Without the mode, `--shipped` sends ignored specs to `specs/archive/<ticket-id>/` (`SHIPPED_EVIDENCE_DIRS` + bucket `archive`, bin/agc-init.mjs:4330; `docs/lane-protocol.md:44`), never to `specs/abandoned/`. The spec fact (O3 (a)) is "In this mode `specs/` goes through this rule instead of `specs/archive/<lane>/`". The sentence points adopters at the wrong directory. Fix: `… — in this mode it does not go to \`specs/archive/<ticket-id>/\``. The line is a DOC-INST-4 addition (wording free, facts fixed), so changing it needs no Copy amendment.

**R4 — required (implementation defect → sr; scenario from R2 (b), test by qa): a re-run of `finish --shipped` after a late failure cannot finish on its own.** Probed on HEAD with a scratch repo:
1. The lane appends a row to its seeded `docs/backlog.md` and has one pending block. An untracked `blocker.txt` makes `git worktree remove` fail.
2. The first run harvests the lane backlog over the primary copy, appends E13 to it and closes the lane state, then exits 1 at the worktree remove ("re-running finish is safe" is the contract the harvest-failure message states).
3. After `blocker.txt` is removed, the re-run exits 1 with `harvest destination already exists in the primary checkout and differs (nothing moved): …/docs/backlog.md`. The lane copy no longer matches its record, and the primary copy (now lane bytes plus E13) matches neither the lane copy nor the record.

No data is lost, but finish no longer completes without a hand edit, and the refusal blames a file that finish itself wrote. Required outcome: in that state the re-run completes without manual action, allocates nothing new, and leaves the primary backlog as the lane bytes plus the numbered rows. One way: when numbering appends to a harvested lane backlog, write the same bytes back to the lane copy, so the re-run's `fileHasBytes` check skips it. sr chooses the fix; qa pins it.

**Judgement item (2) — D9 "no git, no extra read" in a mode-off linked worktree: accepted as-is.** D9 defines its case by the *primary checkout's* config. From inside a linked worktree, finding the primary checkout needs either git (`git worktree list`) or reading git's own `.git`/commondir files. So "no git, no extra read" can only hold literally outside a linked worktree. That is how `manifestChangedFailure` behaves: it checks `.git` with `stat` only, and a `.git` directory, or no `.git` at all, means no git command and no read. Inside a mode-off lane, the extra work is one `git worktree list` and one raw read of the primary config. Stdout, stderr and the exit code are unchanged: test `AC10 … check --cut` passes in a mode-off lane, and my live `check --cut` run in this linked worktree (primary mode off) printed the base report with no `MANIFEST_CHANGED`. AC10's observable contract holds. Recommended, not required: short-circuit on the lane's own copied `.current/.config.json` when present, which avoids the git call in the common mode-off case.

Tests otherwise: every AC has a test on the public interface (CLI / served prompt / docs text) whose assertions would fail on a wrong outcome. AC6 both-changed snapshots both trees, HEAD and the branch. AC7 checks the row, the provenance, git log/status, history `## Applied` and line order. AC9 compares against a computed "exit as today". The open interface details in the qa report contradict no scenario. Coverage: not measured. The e447 tests drive `bin/agc-init.mjs` and `scripts/fanout.mjs` as child processes, and the suite has no coverage tooling wired for spawned CLIs.

## Quality

- Naming, error style (`FeatureError` / `usageError`, exit codes) and atomic-write helpers match the surrounding code. `upsertArtifactsKey` gains a `key` parameter instead of being duplicated.
- The implementation constraints hold. The `ARTIFACT_EXCLUDE_RULES` / `SHIPPED_EVIDENCE_DIRS` / `ABANDON_*` / `KNOWLEDGE_RULES` constants are byte-unchanged (the new constant is `KNOWLEDGE_LOCAL_RULES`). No new `laneIgnoredStateFiles(` call site. No function inserted between `deleteRemoteLaneBranch` and `runFeatureFinish` (the new finish helpers sit after `runFeatureStart`). No new `lane-paths` importer.
- Comment check (5d). `agc check — comments` reports long blocks the diff grew or added: `bin/agc-init.mjs:308` (8), `:507` (9), `:2362` (9), `:3062` (10); `tools/fanout-manifest.ts:2531` (8); and the four e447 test-file headers. Kept: each states a non-obvious contract (the key-generic upsert; the D2 adapter rule; the harvest decision table; the `backlogBlob` override; the D9 scope) at 1–3 lines over the limit, in the file's existing convention. The `tools/config.ts` / `tools/lane-paths.ts` ratio warnings predate this diff.
- optional: `reseed`'s not-knowledge refusal echoes the operand as typed (`escapeSegmentForDisplay(p)`, :2300), not the repo-relative `<rel>` the Copy row names. The qa report leaves it unpinned on purpose; consider printing the normalised path when one exists.

## Architecture

No architecture spec (the spec records "No architect hop"). D10 holds: no new `tools/*.ts`, `CLAUDE.md` untouched. Seed, harvest and numbering live in `bin/agc-init.mjs`. The comparison lives in `tools/fanout-manifest.ts` `runCheckCut`, and `checkCut` stays pure (it takes `extraFailures`). The primary config is read raw, never through `loadConfig` (heal-write avoided). D4: `knowledgeSeed` entry with `required: false` and `noFlatCounterpart: true`; the filename comes from `laneFile("knowledgeSeed")`.

## Security

No new trust boundary. Reseed operands are canonicalised against the lane root (parent realpath) and must sit under a knowledge root: `..`, `specs/../README.md` and absolute paths are refused (tested). Harvest destinations come from `readdir` names under fixed roots, joined by segment. Writes go through a temp file plus `rename`, which replaces a symlinked destination instead of following it. Git runs via `execFileSync` with argument arrays and `--literal-pathspecs`; `check-ignore` gets NUL-separated stdin. No secrets.

## Performance

Start walks the knowledge roots once, with one batched `ls-files` and one batched `check-ignore`; finish does the same in the lane. File bytes are read once per candidate. `check --cut` outside a linked worktree adds only `stat` calls up the directory chain. No regression on the mode-off paths.

Full suite (judge run, HEAD db6e693): `node scripts/test-lock.mjs -- npm test` → 4815 pass / 0 fail / 2 skipped of 4817, exit 0. All 39 expected-red entries are now green, and there are no reds off the manifest (`qa_reports/review_T-E447-01.md`). `npm run build` produced no `dist/` diff. `npm audit --audit-level=high` exited 0.

## Verdict

CHANGES_REQUESTED. R1 and R2 are scenario defects (12 strings no Copy row lists; untested sr-added behaviours, some of which decide new behaviour), and R3 and R4 are implementation defects (a wrong path fact in `docs/install.md`; a `--shipped` re-run that cannot finish on its own after a late failure). Route to pm (Copy rows plus scenarios, with the human's consent as for DOC-INST-5), then qa (tests and expected-red), then sr (R3, R4 and any reworded strings).

## Round 2 — APPROVED — by code-reviewer

Round 2 (task T-E447-10) supersedes the round-1 verdict above. R1–R4 are resolved, AC1–AC20 pass, and the full suite is 4834 / 0 / 2 of 4836. The round-2 report is `review_reports/review_T-E447-10.md`, which covers T-E447-01..10.
