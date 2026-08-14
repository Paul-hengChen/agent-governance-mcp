# Review — T-E645-02 (reviews T-E645-01)

covers: T-E645-02, T-E645-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- One file changed as scoped: `content/skill-release-engineer.md` (+17/−9). Zero source, zero `test/**`, no constitution fragment, no other `content/skill-*.md`. Ticket point (f) satisfied.
- **The 1713/1713 green is structural blindness, not compatibility.** Proven, not inferred: with the entire `git add lib/ tools/ …` enumeration line *deleted*, `test/release-staging.test.mjs` still returns 60/60. AC1 is vacuous for all 15 enumerated paths. This is qa's half (T-E645-03 point 1) but the fix is strictly larger than "add `gates/` to `FEATURE_DIRS`" — that change alone still yields 60/60 against the *pre-change* SOP. Detail in **Correctness → F1**.
- sr's two contested judgment calls both hold up under independent verification: the step-number pins are real and correctly left alone (F-OK-1), and the sha→version change is right against commit ground truth, not just against the SOP's claim about it (F-OK-2).
- Two blocking findings: a factual error in new normative text (**F2**), and the "fourth list" ticket point (a) sent me to find — `templates/claude-code-agents/release-engineer.md:11`, already pinned by AC5 in the *same* test file, still carries the enumeration without `gates/` (**F3**).
- Verdict: CHANGES_REQUESTED — F2 + F3, both one-line fixes in scope-adjacent text.

## Correctness

### F1 — BLIND, not compatible. Three layers, and layer 3 makes AC1 vacuous for every path. (informational for sr; load-bearing for T-E645-03)

The brief asked me to establish whether the green means "change is compatible" or "test cannot see this class at all". It is the second, and worse than posited.

**Layer 1** — `test/release-staging.test.mjs:66` (the brief cited `:82`; that is a *usage*, the declaration is `:66`):
```js
const FEATURE_DIRS = ["lib/", "tools/", "schema/", "guards/", "prompts/", "bin/", "scripts/", "content/", "templates/", "specs/", "test/", "qa_reports/", "review_reports/", "transport/"];
```
`gates/` absent. So AC1/AC2/AC3 never required `gates/`, and `simulatePreCommitVerify` (`:79`) cannot model an unstaged `gates/` change at all.

**Layer 2 — the root cause.** AC-B5.5 (`:542`) is the meta-guard built specifically so this cannot happen ("a newly added source directory triggers a guard failure automatically — no manual update to any test-side list required"; it exists because `transport/` slipped out of staging in v3.24.0). It derives the expected set from `tsconfig.json` `include` — which also omits `gates/`:
```json
"include": ["index.ts","tools/**/*.ts","guards/**/*.ts","prompts/**/*.ts","schema/**/*.ts","transport/**/*.ts","lib/**/*.ts"]
```
`gates/` compiles only transitively (via `tools/handoff-orchestrator.ts` → `gates/registry.ts`), so `dist/gates/` exists and the build is green while the declared source-root list is incomplete. The auto-detector was blind because its authority source was. This is the v3.24.0 `transport/` drift class recurring in the guard written to prevent it.

**Layer 3 — and this is the finding that matters most.** Fixing layers 1+2 still does not make AC1 catch the omission. AC1 (`:175`) asserts `SKILL.includes(dir)` against the **whole document**. Two experiments:

- `FEATURE_DIRS` patched with `gates/`, run against the **pre-change** SOP → **60/60 green.** Because the pre-change file already contained the substring `gates/` at two places (`gates/feature-lease.ts`, step 12 and the E13 note). An incidental mention in an unrelated step satisfies the assertion.
- The whole `git add …` enumeration line deleted from the current SOP → **60/60 green.**

I scanned all 15 paths: **every one** of `lib/ tools/ schema/ guards/ prompts/ bin/ scripts/ content/ templates/ specs/ test/ qa_reports/ review_reports/ transport/ dist/` is satisfied by prose elsewhere in the file. AC1's stated contract — "enumerates required staging directories explicitly … abstract language is prohibited" — is currently enforced only by its one negative assertion (`!SKILL.includes("git add <touched files")`, `:193`).

So the prediction of red was wrong in premise, not in degree: these pins are `includes`-shaped and monotonic. Additive SOP text can only move red→green. For this class of change a green suite carries close to zero information, and the only assertions that can go red are the five `!SKILL.includes(...)` negatives (`:193, :224, :617, :828, :832`) and the anchored `^N\.` regexes.

**Recommended fix for T-E645-03 point 1** (ordering matters — 3 before 1, or AC-B5.5 goes red):
1. Scope AC1 to the extracted `git add` line (e.g. match `/^\s+git add (.+)$/m`, assert each `FEATURE_DIR` + metadata path appears in **capture group 1**), not to `SKILL`. Without this, items 2–3 buy nothing.
2. Add `"gates/"` to `FEATURE_DIRS` (`:66`) and add the AC2 fixture proving an unstaged `gates/` change is now caught.
3. Add `"gates/**/*.ts"` to `tsconfig.json` `include` so AC-B5.5 resumes being an auto-detector. Verified safe: `dist/gates/` already exists, so this changes no emit. **This half is source, not test — it is outside qa's §2 lane and needs a coordinator call on ownership.**

Empirical support that this was live, not theoretical: `3c4b39e` (v3.100.0) shipped a real `gates/registry.ts` change in its release commit, staged only because the release-engineer noticed by hand.

### F2 — BLOCKING. `gates/` is miscounted in new normative text, in the file that legislates against exactly this.

`content/skill-release-engineer.md:171`:
> `guards/` is 2 files (`session.ts`, `file-lock.ts`); `gates/` is 33 gate predicate modules plus `gates/registry.ts`

- `ls gates/*.ts | wc -l` → **14**: 12 predicate modules + `registry.ts` + `pipeline.ts`.
- `33` is the cardinality of the `GateErrorCode` union (`gates/registry.ts:26-58`) — gate **definitions/codes**, not modules. `3c4b39e`'s own commit subject settles it: `"E40 non-qa completed_tasks write gate (32→33 gates)"`.
- The claim also omits `gates/pipeline.ts`, the step runner.
- `guards/` = "2 files (`session.ts`, `file-lock.ts`)" is correct.

Why blocking rather than a nit: (a) the sentence's *only* job is to stop a release-engineer confusing `guards/` with `gates/` during a `git status --short` scan, and it does so by asserting a magnitude that is wrong by ~3× with the wrong noun; (b) it sits in the file whose own CRITICAL rule (`:24`, E17) is "describe the diff, not the brief … verify with `ls` / `git diff --stat` immediately before writing each record — NEVER from memory of the dispatch brief". The figure was carried verbatim from the brief's `scope_decision_why` ("gates/ = 33 gate defs + registry") and re-labeled "predicate modules" without an `ls`. Shipping the E17 failure mode inside the E17 file is the one place it cannot be waived.

Suggested wording: ``` `gates/` is 12 gate predicate modules plus `gates/registry.ts` (33 gate definitions) and `gates/pipeline.ts` ```

### F3 — BLOCKING. The fourth list. Same enumeration, no `gates/`, already pinned by AC5 in the same test file.

Ticket point (a) told me to grep for a fourth list rather than trust the three named line numbers. Within the reviewed file there is none — see F-OK-3. Outside it there are two, and the first is not merely adjacent, it is **an artifact this ticket's own test file already reads**:

`templates/claude-code-agents/release-engineer.md:11`:
> Staging scope includes ALL uncommitted upstream work, not just files you edited this turn: stage these directories `lib/ tools/ schema/ guards/ prompts/ bin/ transport/ scripts/ content/ templates/ specs/ test/ qa_reports/ review_reports/` plus metadata `package.json index.ts CHANGELOG.md README.md dist/`. Run `git diff --cached --stat` and verify source directories appear before committing.

`grep -c "gates/"` → **0**. `test/release-staging.test.mjs:51` binds this exact file as `SHIM`, and AC5 (`:291`) pins its content. So it is inside the ticket's test surface, not a distant file. It is a compressed restatement of both AC1 and AC2 — and it is the text that lands in a user's `.claude/agents/release-engineer.md` and that a dispatched release-engineer subagent reads before `tw_switch_role` returns the full SOP. A short, memorable, wrong list beside a long, correct one is worse than no list.

It is also now stale on E65: no mention of `.current/.config.json`, `docs/backlog.md`, or the three adapter stamps, and no adapter-stamp step.

I do not read this as sr overstepping — sr was told "ONE file" and honored it, and the two out-of-scope items were correctly left alone. This is an under-scoped cut. But E64's entire thesis is "a list that forgot a directory causes a release defect", and shipping E64 while a second copy of that list stays wrong ships the defect. One word plus one clause.

### F4 — non-blocking, recommend a backlog row (doc-writer, not this ticket).

`docs/skills/release-engineer.md:64` carries the same enumeration, also without `gates/`. That file's header declares `content/skill-release-engineer.md` as "Source of truth" and asserts "Every claim below traces to those files. Nothing here is invented." It now diverges on both E64 and E65 (step 10/11 ordering, the five paths, step 7d). Its header also cites two retired paths — `content/constitution.md` and `content/skill-coordinator.md`. That is a doc-regeneration job across `docs/skills/*.md`, too big for this cut.

### F5 — non-blocking. The scope rule was edited but not extended to 7b–7d's own output.

Steps 7b/7c/7d now cause release-engineer to leave `.current/.config.json`, `docs/backlog.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules` modified in the working tree *before* step 8's `git status --short` scan. The **Expected vs unrelated scope rule** (`:171`) — the normative trigger definition for the first Escalation row — enumerates only source dirs and does not name these five. That same paragraph already carves out release-engineer's *other* self-produced output ("The `qa_reports/archive/<feature>/**` … moves produced by SOP step 7a … are likewise EXPECTED move-only release-engineer output … never a STOP trigger"), which establishes that this is where own-output exemptions belong.

Mitigated in practice: sr added a sentence at step 8 (`:135`) stating these show as "ordinary pending changes" by the time the staging line runs, and a literal reader arriving at step 8 has just written them. Also pre-existing precedent that the rule is non-exhaustive on metadata: `.current/handoff.md` is modified by step 2's own opening write and appears in neither list. Non-blocking, but if F2/F3 are being fixed anyway, one clause here closes the same class of gap E65 was filed on.

### F6 — non-blocking. Stale cross-references to the retired step numbers, outside the reviewed file.

`specs/c5-c18-watermark-configcache.md:48,116,145` and `specs/c13-release-engineer-write-path.md:184` say "SOP step 10"; `specs/e8-success-telemetry-architecture.md:21` says "near step 11/12". Those are historical design records and arguably should read as of their date. `test/config-cache.test.mjs:15` is a code comment now pointing at a retired number — mildly misleading to a future reader. No assertion depends on any of them.

### F-OK-1 — sr's step-number pin claim: VERIFIED ACCURATE. No pinned step silently moved.

I checked the claim against the files rather than the report, since a green suite would not necessarily reveal a text-matching pin whose number moved.

- `test/feature-lease.test.mjs:666` (S8) pins `/^11b\.\s+\*\*Success-metrics emit is automatic\*\*.*$/m` — anchored on the literal number.
- `test/feature-lease.test.mjs:983-984` (S8b) pins `/^11b\.\s+…/m` and `/^12\.\s+\*\*Closing write\*\*/m`, then asserts `11b` precedes `12` **and** that step 12's line still contains `tw_update_state(agent_id="release-engineer"` and `next_role="pm"` byte-intact.
- `test/verify-release.test.mjs:676` (VR-9) pins `/9a\.\s*\*\*Release self-check\*\*/` and index-orders `**GitHub release**` < `9a. **Release self-check**` < `**Closing write**`.

Leaving 9a/11a/11b/12/13 at their existing numbers was therefore necessary, not merely convenient. Renumbering any of them would have broken S8, S8b, or VR-9 outright — these are the anchored assertions that *can* go red, unlike AC1's substring form.

Two notes: S8b's test *name* says "step 11b sits between step 11 and step 12" but its body never asserts step 11 exists, so the retired `11.` pointer is not load-bearing for the test — though keeping it does keep the test name honest, and the "no gap between 9a and 11a" rationale in the step-10 pointer (`:146`) is sound. And the E13 note-block test (`test/feature-lease.test.mjs:847`) slices from its heading to the next `\n\n`; new step 14 sits after that blank line, so it is untouched.

Independent run of all four pinning files: **167/167 pass** (`release-staging` 60, plus `feature-lease`, `verify-release`, `agc-adapters`).

### F-OK-2 — the sha→version change: VERIFIED against commit ground truth, per ticket point (c).

The ticket told me to re-derive against what `11cc082` and `3c4b39e` actually did, not against the SOP's claim about them. Both:

- contain `.antigravityrules`, `.current/.config.json`, `AGENTS.md`, `CLAUDE.md`, `docs/backlog.md` in the **same** commit as source changes (`tools/transitions.ts`; `gates/registry.ts` + `tools/handoff-orchestrator.ts`) — confirming option (i) describes practice;
- cite a **version** in the backlog done-mark, never a sha: `"**DONE — shipped v3.100.0**"`.

And the new ordering makes the old wording factually impossible: step 7c now precedes step 8, which is where `git commit` and `git tag -a` first run, so no sha or tag exists at 7c. "release version (`vX.Y.Z`, from step 4's bump)" is correct and available — step 4 is the bump. No downstream consumer reads a sha out of the backlog row (grepped). Step 12's `pending_notes` still carries `"tag: <sha>"`, but that is a different artifact written after step 8, unaffected.

### F-OK-3 — no missed list *inside* the reviewed file; no list got `gates/` that shouldn't.

I enumerated every line in the file carrying ≥3 directory-path tokens rather than trusting the three cited line numbers. Source-dir lists needing `gates/`: `:133` (git add), `:136` (AC2 cross-reference set), `:171` (scope rule) — all three have it; plus `:41` (MUST-NOT) by sr's judgment call. Lists correctly **without** `gates/`: `:30-39` (Artifact write allowlist — release-engineer must not write gate source, so its absence is required), and step 7a's `qa_reports/` / `review_reports/` enumerations (`:119-124`, evidence trees, not source dirs). The `:135` metadata sentence and the AC2 metadata-only-FAIL clause both carry all five new paths.

### F-OK-4 — E65 ordering is internally consistent; nothing moved ahead of step 8 needs post-commit state. Ticket points (c) and (d).

- 7b's inputs (`completed_tasks` / `tasksCompleted`) are available from step 1. 7c and 7d both cite step 4's version, and step 4 precedes them. No post-commit dependency.
- 7d's `agc check` reads the agc package's own `package.json` (`bin/agc-init.mjs:56`), bumped at step 4 — so at 7d it compares stamps against the **new** version. Correct placement.
- 7d sits *after* step 6's `npm test`, which would be a problem if any test pinned the repo root's adapter stamps to `package.json`. It does not: every `agc-version` assertion in `test/agc-adapters.test.mjs` runs against a temp workspace (`mkTmp`), never `ROOT`. So step 6 does not go red on stale root stamps, and 7d's placement is safe.
- 7d names all three files with their correct distinct stamp forms (`<!-- agc-version: X.Y.Z -->` for `CLAUDE.md`, `# agc-version: X.Y.Z` for the other two — matching `test/agc-adapters.test.mjs:164,179`) and requires `agc check` exit 0 with the verbatim success string. Point (d) satisfied.

### F-OK-5 — the `git add` line is copy-pasteable as written. Ticket point (b).

All 26 pathspecs exist in this repo, so no "did not match any files" abort. All five new paths are tracked and un-ignored — verified with `git ls-files --error-unmatch` (all 5 present) and `git check-ignore` (no match); `.gitignore` excludes only `.current/.agc-hook-marker.json` under `.current/`, and the line names `.current/.config.json` as a specific file rather than the directory, so no ignored sibling is swept in.

### F-OK-6 — E55's step 14 is executable within the actual Artifact allowlist. Ticket point (e).

Step 14 instructs release-engineer to write nothing; it is descriptive of what `next_role="pm"` means and explicitly states "Nothing about step 12's write mechanics changes here". So it cannot ask the role to do something its allowlist forbids — the defect E55 documents is not reproduced. It sits after the E13 prose note (a numbered step separated from its list by a paragraph, which is slightly awkward structurally) but that is the only placement that leaves steps 12/13 and the note byte-intact for S7/S8b/E13-AC6.

### F-OK-7 — out-of-scope items confirmed untouched. Ticket point (g).

- `npx tsc` at `:54` — unchanged; still carries no `postbuild` / `check-transitions-sync.mjs` note. Gap intact for the human fold-or-file call.
- `content/constitution.md` at `:41` (the brief's "around line 41" is exact) — the retired path is retained verbatim; the diff at that line adds only `gates/` and the new rationale clause. `ls content/constitution.md` → No such file or directory, so the reference is indeed dead, and deliberately left dead.

### F-OK-8 — expected-red set is correctly empty; no regression. Ticket point (h).

No `qa_reports/expected-red_e64-e65-e55-release-sop-staging.txt`, and none is required: SOP step 4a arms only when the diff touches test files or intentional reds evidently exist. The diff touches no test file and nothing is red. Verified the working tree is otherwise pristine after my experiments — `git diff --stat` shows only `content/skill-release-engineer.md | 26 +++---` (17/9), matching the pre-review baseline; `test/release-staging.test.mjs` and `tsconfig.json` restored byte-identical.

## Quality

- The retired-pointer pattern (`10.` / `11.` kept as one-line "moved to 7b/7c" markers instead of deleted) is the right call under the pin constraints and reads clearly. The 7b/7c/7d lettering matches the file's existing 3a/6a/7a/9a/11a/11b convention.
- New prose is dense even by this file's standards — 7b, 7c and `:41` each carry a multi-clause parenthetical citing commits and prior versions inline. Consistent with the file's house style, and the `<!-- origin:start -->` tag on 7c's `(v3.58.0, C10)` was correctly preserved through the move, so `stripOriginTags` still elides it in composed prompts.
- Convention drift: none. No `<!-- rationale:start -->` block was opened for the new E65 rationale, matching how E44/E50 additions were written inline.

## Architecture

No `specs/e64-…md` or `specs/<feature>-architecture.md` exists — this is a backlog-row-as-spec mini-chain, recorded as such in `scope_decision_why`, so the backlog E64/E65/E55 rows are the contract. All three rows are satisfied in intent: E64's three lists plus the MUST-NOT judgment call, E65 option (i) exactly as the row prefers it ("move the step-10/11 writes and the stamp bump ahead of step 8 and add all five paths to its list"), E55's terminal step.

On sr's `gates/`-in-MUST-NOT judgment call, which the brief asked me to assess: **the reasoning holds, and it is not a novel distinction — the file already relied on it.** `content/` is in step 8's staging list while `content/skill-*.md` is in the MUST-NOT list; same for `tools/`, `schema/`, `guards/`, `prompts/`, all staged and all MUST-NOT. So author-vs-stage was already the operative rule for every source dir in both lists; `gates/` joining is the consistent outcome, and the alternative (omit it from MUST-NOT) would have made `gates/` the sole staged source dir release-engineer was *permitted* to author. Making the distinction explicit in text was the right response to "state your judgment rather than pick silently". The one defect in that sentence is F2's count, not its logic.

Layering otherwise unchanged: no step crosses a role boundary, and the five new write targets are all added to the Artifact allowlist with field-level scoping (`the agc-version: stamp line only`), matching how `.config.json` and `docs/backlog.md` were already scoped.

## Security

No findings. Doc-only change; no code path, no input crosses a trust boundary, no secrets. The new `git add` paths are fixed literals, not interpolated — no pathspec-injection surface. `agc check` is invoked as a plain command with no argument interpolation. I confirm sr's checklist claim.

## Performance

No findings, with one measurement worth recording. The file grows 25.9 KB → 27.3 KB (+1.4 KB, +5.3%). It is composed into the release-engineer prompt bundle, so this is a real per-invocation context cost, but it is bounded and the role is invoked once per release — the least frequent role in the chain. No hot path, no algorithmic surface. Below any threshold that would justify trimming, and the E17-style inline rationale this file uses throughout is a deliberate accepted cost.

## Verdict

**CHANGES_REQUESTED** — the E64/E65/E55 substance is correct and both contested judgment calls verify clean, but two one-line fixes are required: F2 (`gates/` miscounted as "33 gate predicate modules"; actual 12 modules / 14 files, 33 being gate definitions — an E17-class error inside the E17 file) and F3 (`templates/claude-code-agents/release-engineer.md:11`, already pinned as `SHIM` by AC5 in this ticket's own test file, still carries the staging enumeration without `gates/`, leaving E64's defect live in the deployed dispatch artifact). F5 recommended in the same round; F1 is qa's (T-E645-03 point 1) with the scope correction noted; F4/F6 for a backlog row.

---

## Round 2 — APPROVED — by code-reviewer

## Summary

- Cut grew 1 file → 7 files + `tsconfig.json`, all six round-1 findings addressed. Every round-1 blocker (F2, F3) verified fixed and factually correct against `ls`/`GATE_REGISTRY`, not against sr's claim about them.
- **The tsconfig root cause is the right fix and its blast radius is fully bounded.** Independently re-verified by a stronger method than sr's (see **Correctness → R2-1**): compiling the *base* and *patched* configs into two fresh out-dirs gives 264 files each, `diff -rq` = zero output. `gates/` was already emitted under the old config via transitive import, so the change moves the program's declared *root* set, not its file set. Sole consumer of the `include` list outside `tsc` is one test.
- **The new red is correct and correctly scoped.** Suite is 1712/1713; the single red is exactly `AC-B5.5`, the manifest entry is real and locatable, and all four round-1 pin files are 166/167 (the one fail being AC-B5.5 itself) — so F-OK-1's step-number pins are undisturbed.
- **sr's ordering caveat for qa is FALSE, and I am the source of the error.** Empirically disproven, not argued: `FEATURE_DIRS` patched with `gates/` and **no** AC1 rescope → **60/60 green**. Full correction in **R2-2**. This is the one item that would have sent qa in a circle.
- One non-blocking finding: the docs mirror was fixed at 1 of its **3** enumeration sites (**R2-3**). Verdict: APPROVED.

## Correctness

### R2-1 — tsconfig emit-neutrality: INDEPENDENTLY VERIFIED, by a stronger method than the one reported.

sr verified by copying the existing `dist/` and re-running `npx tsc`. That method has a hole: it trusts that the committed `dist/` was current for the *pre-change* config. I did not reuse it. Instead I reconstructed the base config from `git show HEAD:tsconfig.json`, pointed both configs at fresh out-dirs, and compiled each from scratch:

```
old: 264 files   new: 264 files
diff -rq emit-old emit-new  →  (no output, exit 0)
```

`gates/` present in **both** emits at 56 files (14 modules × `.js`/`.d.ts`/`.js.map`/`.d.ts.map`). So `gates/*.ts` was *already* fully compiled and emitted under the base config, pulled in transitively via `tools/handoff-orchestrator.ts` → `gates/registry.ts`. Adding `gates/**/*.ts` to `include` changes the program's declared **root** set, not its **file** set — which is exactly why the emit is byte-identical rather than merely equivalent.

Two further checks that the reported verification did not cover:

- `rootDir` is explicitly `"."` (`tsconfig.json:7`), so no `rootDir` *inference* change — the failure mode where adding an include path silently re-bases the whole output tree cannot occur here.
- **Blast radius is closed.** `getTsConfigSourceDirs` (`lib/tsconfig-source-dirs.ts:32`) is the only reader of the `include` array, and it has exactly **one** consumer repo-wide: `test/release-staging.test.mjs:554` (AC-B5.5). No production code path reads `tsconfig.json`. So the total consequence of this one line is (a) emit — proven identical, and (b) AC-B5.5 — the intended, recorded red. Nothing else.

Committed `dist/` also matches a fresh emit (`.js`/`.d.ts` identical; `git status dist/` clean), so no dist churn is owed.

### R2-2 — BLOCKING FOR NOBODY, BUT READ THIS BEFORE QA MOVES: the ordering caveat handed to qa is wrong, and it is my error, not sr's.

`qa_reports/expected-red_…txt` states, citing me verbatim:

> Fixing FEATURE_DIRS, and rescoping AC1 first per the review's ordering note (F1: "3 before 1, or AC-B5.5 goes red"), is qa's half

sr quoted my round-1 parenthetical accurately. **The parenthetical was garbled and the claim it produced is false.** I disproved it by experiment rather than by re-reading the predicate:

- **Experiment A** — added `"gates/"` to `FEATURE_DIRS` (`:66`) only; AC1 left entirely unscoped; `tsconfig.json` as shipped this round → `node --test test/release-staging.test.mjs` = **60/60, 0 fail.**

AC-B5.5 (`:542-566`) is a pure set difference: `getTsConfigSourceDirs(tsconfig) \ FEATURE_DIRS === []`. It reads the tsconfig `include` list and `FEATURE_DIRS`, and **nothing else** — no `SKILL` text, no AC1, no fixture. Therefore:

- AC-B5.5's red is cured by, and **only** by, adding `"gates/"` to `FEATURE_DIRS`. Nothing about AC1 can affect it in either direction.
- Rescoping AC1 "first" is **not** a precondition for anything. A qa engineer who follows the manifest literally will rescope AC1, re-run, find AC-B5.5 **still red**, and reasonably conclude the rescope was wrong — the circle the round-2 brief was worried about.

**Corrected guidance for T-E645-03 point 1** (supersedes round-1 F1's ordering parenthetical and the manifest header):

1. Add `"gates/"` to `FEATURE_DIRS` (`test/release-staging.test.mjs:66`). This alone clears the red. Do it first, because it is the only thing that is currently *owed* — sr already landed the tsconfig half.
2. Rescope AC1 from `SKILL` to the extracted `git add` line. Independent of (1); needed not to clear a red but because AC1 has **zero** detection power in its current substring form (round-1 F1 layer 3 stands unchanged).
3. Add the AC2 fixture proving an unstaged `gates/` change is caught.

There is no red-producing ordering constraint between these. Any sequence works; (1) is merely the one that clears the suite.

**And the rescope in (2) is verified safe — I did not hand qa an untested recommendation.** Experiment C: extracting `/^\s+git add (.+)$/m` from the current SOP yields a 26-token capture group containing **all 15** patched `FEATURE_DIRS` and **all 6** metadata paths — `missing: []` for both. So the rescoped assertion is green against the shipped SOP text, and its first real red would be a genuine future omission.

The load-bearing part of the manifest is correct: the structured line

```
test/release-staging.test.mjs | AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list
```

sampled and confirmed real at `test/release-staging.test.mjs:542` (SOP 4a: one entry, so all entries sampled). Only the prose header carries the bad clause. Whoever next writes that file should strike the "rescoping AC1 first" clause; I am not routing sr back for a comment that faithfully quotes my own mistake.

### R2-3 — non-blocking, but 1-of-3 is worse than either 0-of-3 or 3-of-3. The docs mirror.

Round-1 F4 cited `docs/skills/release-engineer.md:64`. sr fixed exactly that line. My citation was under-specified: the mirror carries the enumeration at **three** sites, and the other two still lack `gates/`:

- `:64` — the `git add` line — **FIXED**.
- `:67` — step 7b, the AC2 pre-commit cross-reference set (`{lib/, tools/, schema/, guards/, prompts/, …}`) — **still omits `gates/`**.
- `:98` — STOP-exit table row `10b`, *"Expected uncommitted changes"*, the mirror of the *Expected vs unrelated scope rule* — **still omits `gates/`**, and also omits all five E65 metadata paths.

Before this diff the mirror was *uniformly* stale — a reader was consistently wrong. It now says: stage `gates/` at 7a, then verify a set that excludes `gates/` at 7b, then consult a table row that says `gates/` is not among the expected changes. That is E64's exact defect — stage-without-verify — newly introduced into the mirror by a partial fix.

Why still non-blocking: no test pins these three lines (the E59 `"waived"` sweep and the labeled `docs/skills/release-engineer.md:51/92/121/165-167` pins in `test/release-staging.test.mjs:1095-1146` are untouched and green), the mirror is non-normative, and E48 mirror policy is undecided — so a deliberate minimal touch is defensible. The mirror is also *already* deeply divergent independent of this ticket: `:47` asserts "these four files (plus `dist/**`) are the **only** files release-engineer may write", which was false before E65 (the allowlist already carried `.current/.config.json`, `docs/backlog.md`, and both archive trees) and is further false now.

Recommendation, coordinator's call — either is fine, the current middle is not: **(a)** complete the two remaining lines (still strictly "the omission only", ~2 lines, no E48 policy question raised), or **(b)** revert `:64` so the mirror stays uniformly stale until E48 regenerates it properly. I lean (a): it is smaller than the revert and removes an internal contradiction that a human reader can act on wrongly.

### R2-4 — F2 verified fixed, and verified *correct*, which is a different claim.

`content/skill-release-engineer.md:171` now reads:

> `guards/` is 2 files (`session.ts`, `file-lock.ts`); `gates/` is 12 gate predicate modules plus `gates/registry.ts` (33 gate definitions) and `gates/pipeline.ts`

Re-derived from the filesystem, not from the note claiming it was derived from the filesystem:

- `ls gates/` → **14** files, all `.ts`. Minus `registry.ts` and `pipeline.ts` = **12** predicate modules: `ac-execution, code-review, cut-approval, evidence-schema, expected-red, external-refs, feature-lease, lease-override, qa-review, scope-decision, stamp-provenance, visual`. Every one is a predicate; none is metadata. `12 + 1 + 1 = 14` closes.
- `GATE_REGISTRY.length` → **33** (loaded from `dist/gates/registry.js`; `ALL_GATE_CODES.length` = 33 too). The parenthetical attaches "33 gate definitions" to `gates/registry.ts`, which is where `GATE_REGISTRY` lives. Correct noun, correct owner, correct magnitude.

The E17 failure mode round-1 F2 objected to — a magnitude asserted from the dispatch brief without an `ls` — is gone, and the sentence's job (stop a release-engineer conflating `guards/` with `gates/`) is now served by accurate numbers.

Informational, out of scope, worth a backlog row: `CLAUDE.md:87` still says `GATE_REGISTRY — 32 gate definitions`. Stale since E40 (`3c4b39e`'s subject is literally `32→33 gates`), pre-existing and not introduced here — but now the SOP is right and the repo's own layout doc is wrong, which is the same stale-enumeration class E64 exists to close. `CLAUDE.md` is release-engineer-writable for the `agc-version:` stamp line only, so this is not a release-time fix.

### R2-5 — F3 verified fixed; the SHIM is now consistent with the SOP on `gates/`.

`templates/claude-code-agents/release-engineer.md:11` now enumerates `… guards/ gates/ prompts/ …`. `grep -c "gates/"` → 1 (was 0). AC5 (`test/release-staging.test.mjs:291`) binds this file as `SHIM` and is green. The deployed dispatch artifact no longer carries a short, memorable, wrong list beside the long correct one.

Round-1 F3's *secondary* observation stands unaddressed and is correctly out of scope: the SHIM is still silent on E65 — no `.current/.config.json`, no `docs/backlog.md`, no adapter-stamp step, no mention of the five paths. It is a compression, not a mirror, and no test requires E65 coverage there. Backlog row alongside R2-3, not this cut.

### R2-6 — F5 verified fixed, and the attribution is per-step accurate.

The *Expected vs unrelated scope rule* (`:171`) now carves out the five 7b–7d paths with each attributed to its producing step — `.current/.config.json` (7b), `docs/backlog.md` (7c), the three `agc-version:` stamps (7d). Matches the steps as written. Placed in the same paragraph as the existing step-7a archive-move carve-out, which is where own-output exemptions already live.

Round-1 F5's pre-existing note stands unchanged and still non-blocking: `.current/handoff.md`, written by step 2's own opening `tw_update_state`, is named in neither the scope rule nor step 8's staging list. Predates E65; the rule is non-exhaustive on state metadata by long-standing practice.

### R2-7 — F6: all 5 sites annotated, the past-record rule honored, no history silently restated.

The repo's standing rule is that dated records describe the past and must not be rewritten. I checked each of the 5 sites for *insertion* vs *substitution*, since only the latter violates it:

| site | original text | how it changed |
|---|---|---|
| `specs/c13-release-engineer-write-path.md:184` | "the closing write (current step 10)" | qualifier inserted: "…(current step 10 **as of this spec; now step 12 in the current SOP**)" |
| `specs/c5-c18-watermark-configcache.md:48` | "(SOP step 10, \"Drift-baseline acknowledgment\")" | qualifier inserted before the quoted title |
| `specs/c5-c18-watermark-configcache.md:116` | "(near line 59)" | "; renumbered to step 7b under E65" appended |
| `specs/c5-c18-watermark-configcache.md:145` | AC-6 "SOP step 10 gains a one-line note" | parenthetical inserted between "step 10" and "gains" |
| `specs/e8-success-telemetry-architecture.md:21` | "one informational SOP note near step 11/12" | parenthetical appended naming step 11b |

In every case the original claim survives verbatim and the annotation is additive. **No original number was overwritten** — `step 10`, `step 11/12`, `near line 59` all still read as the record said they read. This is the correct pattern, and it is the one thing that would have been easy to get wrong by "helpfully" replacing 10 with 7b.

Annotation accuracy re-derived against the current file: closing write **is** step 12 (`:150`), drift-baseline **is** 7b, the metrics note **is** 11b (`:149`). All three correct. e8's "between the E65-retired step 11 pointer and step 12" elides the intervening 11a, but it mirrors the phrasing of the existing test name at `test/feature-lease.test.mjs:981` ("step 11b sits between step 11 and step 12"), so it is consistent with the repo's own framing rather than newly imprecise.

Completeness swept independently: `grep -rnE "SOP step 1[012]|step 10\b|step 11\b|step 11/12" specs docs test templates content bin scripts` returns only correctly-annotated or correctly-current hits. No sixth stale site was missed.

**`test/config-cache.test.mjs:15` left untouched — correct, and it should be handed to qa rather than dropped.** Three reasons it was right: it is `test/**`, explicitly excluded from sr's round-2 scope; its own header reads `// Coded by @qa-engineer`, so it is qa's artifact under §2; and no assertion depends on it (comment only). But it is now the *sole* surviving stale `SOP step 10` reference in the tree, so qa should annotate it in T-E645-03 with the same additive pattern used above. Flagging so it does not fall between the two lanes.

### R2-8 — the new red: correctly produced, correctly recorded, nothing else moved.

- `npm test` → **1712/1713**, single fail: `not ok 1150 - AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list`. Exactly the test named in the manifest, and exactly the one the brief predicted.
- Four round-1 pin files run together (`release-staging`, `feature-lease`, `verify-release`, `agc-adapters`) → **166/167**, the one fail being AC-B5.5. So F-OK-1's anchored pins (S8 `^11b\.`, S8b `^11b\.`/`^12\.` + ordering + byte-intact step-12 text, VR-9 `9a.`) are all still green — the round-2 diff did not disturb step numbering. Verified directly too: `9a / 10 / 11 / 11a / 11b / 12 / 13 / 14` all present at their round-1 numbers.
- This is a *detection* red, not a build regression — `npx tsc` clean both configs, emit byte-identical (R2-1). The guard woke up because its authority source became complete, which is the intended semantics of AC-B5.5's own WHY comment ("a newly added source directory triggers a guard failure automatically").
- **Zero `test/**` edits**: `git diff --stat HEAD -- test/` is empty. My two experiments were run against a saved copy and restored byte-exact (`shasum -c` OK, `git status --porcelain test/` empty) before writing this section.
- **Both out-of-scope items still untouched**: `:54` still carries the `npx tsc` bump-build path with no `postbuild`/`check-transitions-sync.mjs` note; `:41` retains the dead `content/constitution.md` path verbatim (`ls` → no such file). Neither silently fixed.
- `tasks.md` and `.current/*` diffs are chain bookkeeping only (the three T-E645 rows + handoff state). No scope creep.

## Quality

- The retired-slot pointers at `10.`/`11.` and the additive spec annotations are the same discipline applied in two places: keep the old marker legible, add the new fact beside it. Consistent, and it is what makes R2-7 pass.
- `:171` is now a long paragraph carrying four distinct carve-outs (source dirs, the `guards/`/`gates/` disambiguation, 7a archive moves, 7b–7d metadata). At the upper bound of readable, but it is the normative trigger definition for one escalation row and splitting it would risk the pins that slice this file by paragraph. Leave it.
- Minor nit, no action needed: `specs/c5-c18-watermark-configcache.md:48` inserts the annotation *between* "step 10" and its quoted title, so the sentence now reads `(SOP step 10 as of this spec; renumbered to step 7b under E65, "Drift-baseline acknowledgment")` — the comma before the title now visually attaches to "E65". Purely cosmetic; the historical text is intact, which is the property that matters.
- Convention drift: none. `gates/**/*.ts` sits in `include` in the same position relative to `guards/` that the SOP lists use, which is a small but real consistency win.

## Architecture

No `specs/e64-…md` or `-architecture.md` exists; the backlog E64/E65/E55 rows are the contract, as recorded in `scope_decision_why`. All three remain satisfied, and round 2 strengthens E64 rather than expanding it.

The one genuinely architectural change this round is `tsconfig.json`, and it is the right layer. Round-1 F1 layer 2 identified the defect as *AC-B5.5's authority source being incomplete*, not as *AC-B5.5 being wrong*. Patching `FEATURE_DIRS` alone would have papered over that — the auto-detector would still have been blind to the *next* new source directory. Patching `include` restores the invariant the guard was built on ("no manual update to any test-side list required", `:543-548`), which is why the red it produces is evidence the fix worked. This is the v3.24.0 `transport/` drift class being closed at its root instead of at its symptom.

Ownership note, since round-1 F1 item 3 flagged it as needing a coordinator call: `tsconfig.json` is source, not test, so it sits outside qa's §2 lane — the coordinator folding it into sr's round-2 scope is the correct resolution, and it also means qa inherits a red it can clear with a one-line test-side change entirely within its own lane. Clean seam.

`gates/` in the MUST-NOT list still holds for the round-1 reasons (author vs. stage, a distinction the file already relied on for `content/`, `tools/`, `schema/`, `guards/`, `prompts/`), and R2-4 removes the single defect in that sentence.

## Security

No findings. The content and spec edits are prose. `tsconfig.json` gains one glob over a first-party in-repo directory that was already being compiled — no new file enters the program, no external path, no `extends`, no `typeRoots` or `paths` change, so no dependency-resolution surface moves. The `git add` enumeration remains fixed literals with no interpolation (no pathspec injection), and `agc check` is still invoked with no argument interpolation. Verified independently, not accepted from the checklist.

## Performance

No findings. `content/skill-release-engineer.md` grows a further ~0.4 KB over round 1 (`:171` gained the two clauses), holding the round-1 assessment: bounded, one composed prompt, least-frequent role in the chain. The `tsconfig.json` line adds one glob to the program's root set with an identical resulting file set, so `tsc` walks the same files — build time unchanged in both fresh compiles I ran. `getTsConfigSourceDirs` gains one array element read once per test run. No hot path.

## Verdict

**APPROVED** — both round-1 blockers are fixed and independently verified *correct* rather than merely changed (R2-4 re-derived 12/33 from `ls` + `GATE_REGISTRY`; R2-5 confirmed the SHIM). The tsconfig root-cause fix is emit-neutral under a stronger test than the one reported (fresh dual compile, 264≡264, `diff -rq` silent) and its blast radius is closed at a single test-only consumer, so the resulting AC-B5.5 red is a guard waking up, not a regression. F5/F6 land correctly, and F6's annotations honor the dated-record rule by insertion rather than substitution at all 5 sites. Two items travel forward, neither blocking: **R2-2** — sr's ordering caveat to qa is false (disproven: `FEATURE_DIRS` alone → 60/60), it originates in my own round-1 wording, and the corrected sequence plus its empirical safety check are recorded above; and **R2-3** — the docs mirror is fixed at 1 of 3 enumeration sites, which is internally contradictory in a way it was not before, and wants either 2 more lines or a revert.

### Round 2 addendum — R2-3 resolved 3-of-3. Verdict unchanged: APPROVED.

Post-verdict, the coordinator took option (a) from R2-3 and had sr complete the mirror rather than revert `:64`. Confirmed against the tree, delta only:

- `docs/skills/release-engineer.md:67` (step 7b, AC2 cross-reference set) — `gates/` added inside the braced set.
- `docs/skills/release-engineer.md:98` (STOP-exit table row `10b`, *Expected uncommitted changes*) — `gates/` added.
- `grep -c "gates/"` → **3**; all three sites (`:64`, `:67`, `:98`) now carry it.

Scope of the delta verified, not taken on report:

- `git diff --numstat HEAD -- docs/skills/release-engineer.md` → `3 3`, i.e. three single-line replacements total (`:64` from the original round-2 cut, plus these two). No insertions elsewhere in the file, no reflow, no other row of the STOP table touched.
- **Slot position agrees with the canonical file**, which matters because a list can carry the right token in the wrong place: both files yield exactly `guards/ gates/` (space-separated prose form) and `guards/, gates/` (braced-set form). The mirror matches `content/skill-release-engineer.md`'s ordering, not merely its membership.
- Tree unchanged otherwise: same 10 modified + 2 untracked paths as the reviewed cut; `git diff --stat HEAD -- test/` still empty.
- `test/release-staging.test.mjs` → 59/60, single red still `AC-B5.5`. So the `docs/skills/` pins that file carries — the E59 tree-wide `"waived"` sweep (`:1095`) and the labeled mirror sites at `:51`/`:92`/`:121`/`:165-167` (`:1126-1146`) — are unaffected by the edit.

**The internal contradiction R2-3 identified is gone.** The mirror no longer says *stage `gates/` at 7a, then verify a set excluding it at 7b, then consult a table row calling it unexpected*; all three steps now agree, and they agree with the canonical SOP.

Two residual divergences in this file are **correctly** left in place, since the carve-out was for the E64 omission only and E48 mirror policy is undecided:

- `:98` row `10b` still omits the five E65 metadata paths (`.current/.config.json`, `docs/backlog.md`, and the three `agc-version:` stamps) that the canonical `:171` scope rule now carves out.
- `:47` still asserts "these four files (plus `dist/**`) are the **only** files release-engineer may write" — false before E65 and further false now.

Both are E65/E48 mirror staleness, a different class from the `gates/` omission, and both belong to the doc-regeneration backlog row round-1 F4 recommended. Fixing them here would have been the scope expansion the carve-out existed to prevent.

Nothing in this delta touches the tsconfig analysis (R2-1), the corrected qa sequencing (R2-2), F2/F5/F6, or the expected-red set. **APPROVED stands.**
