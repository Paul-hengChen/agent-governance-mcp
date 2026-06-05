# Backlog — deferred follow-ups

Non-blocking items surfaced during feature work but deliberately left out of
the shipping feature's scope (MVP / surgical-change discipline). Each row is a
candidate for a future `/teamwork` feature; none blocks a release on its own.

> Recorded 2026-06-02. Origin tags reference the feature that surfaced the item.

| # | Item | Priority | Origin | Status |
|---|------|----------|--------|--------|
| B1 | Constitution §1 verbatim-wording relax | P2 | watermark-hide-model-tier (v3.23.0) | **done (v3.24.0)** |
| B2 | Always-on bundle headroom (2-token margin) | P1 | watermark-hide-model-tier (v3.23.0) | **done (v3.24.0)** |
| B3 | Version-pin test refactor (recurring break) | P1 | watermark (v3.23.0) + drift (v3.23.1) | **done (v3.24.0)** |
| B4 | Add `.nvmrc` + `engines` (Node version pin) | P1 | drift-archived-task-exclusion (v3.23.1) | **done (v3.23.1, Option Y)** |
| B5 | release-engineer staging list omits source dirs | **P0** | v3.23.1 release (post-mortem) | **done (v3.24.0)** |
| B6 | Derive release-staging guard from `tsconfig.include` (root-cause) | P2 | v3.24.0 independent review (F2) | open |
| B7 | Visual fidelity un-owned until optional last gate (structural drift, all gates green) — see [postmortem-visual-fidelity-gate.md](postmortem-visual-fidelity-gate.md) | **P0** | oobe-setup-wizard (2026-06-04) | open |

---

## B1 — Constitution §1 self-detection wording is a paraphrase, not verbatim
- **What:** `specs/watermark-hide-model-tier.md` AC1 quotes a "verbatim" self-detection
  string. To fit the always-on token budget, the shipped constitution §1 text is a
  **semantics-equivalent paraphrase**, not the literal AC1 string. Meaning is fully
  preserved (verified by code-reviewer, Round 2).
- **Fix:** Relax AC1 wording to "load-bearing semantics preserved" rather than
  "verbatim string". Spec-text-only change.
- **Risk if skipped:** None functional — purely a spec/AC documentation accuracy nit.

## B2 — Always-on lean bundle at 2098/2100 tokens (2-token margin)
- **What:** The stripped constitution + `skill-coordinator-lite.md` lean always-on
  bundle measures 2098 tokens against the `test/context-budget.test.mjs` cap of 2100.
  The next ~8-char edit to any always-on text will break that test.
- **Fix (pick one):** raise the cap with rationale, OR reclaim headroom by compressing
  constitution §1 further. Decide a target margin (e.g. ≥ 100 tokens).
- **Risk if skipped:** Brittle — an unrelated future constitution/skill edit fails CI
  unexpectedly with no obvious connection to the editor's change.

## B3 — Version-pin test breaks on every release
- **What:** `test/subagent-templates.test.mjs` (the `"vX.Y.Z AC8: ..."` test) hard-codes
  the version string in the test name, comments, and **two assert values**. Every PATCH/
  MINOR bump breaks it, forcing a manual qa-engineer edit. Hit on v3.23.0 (watermark)
  and again on v3.23.1 (drift) — confirmed recurring.
- **Fix (pick one):** (a) read `JSON.parse(package.json).version` dynamically at the top
  of the file so the test verifies the real invariant (`index.ts` literal == `package.json`)
  without per-release edits; (b) drop the test entirely and rely on the existing
  `scripts/check-version.mjs` pre-build gate.
- **Owner:** qa-engineer (test file — Constitution §2).
- **Risk if skipped:** Every release stalls on a spurious red test; easy to mistake for a
  real regression.

## B6 — Derive the release-staging guard from `tsconfig.include` (P2, deferred from v3.24.0)
- **What:** The AC-B5.5 guard test in `test/release-staging.test.mjs` detects source dirs by scanning
  for `.ts/.mjs` files and subtracting a hand-maintained `EXCLUDED_DIRS` set. The authoritative list of
  TS source roots already exists: `tsconfig.json` `include` (`tools, guards, prompts, schema, transport, lib`).
- **Why it matters:** the hand-maintained `EXCLUDED_DIRS` is exactly what let `transport/` slip through in
  v3.24.0 (it was wrongly placed in the exclusion set, masking the staging gap until the independent review).
  The guard works today for all known dirs, but a future new source dir wrongly added to `EXCLUDED_DIRS`
  could drift again — same failure class.
- **Fix:** have the guard parse `tsconfig.json` `include`, map each glob to its top-level dir, and assert
  every one appears in `FEATURE_DIRS` (+ the staging enumeration). Removes the hand-maintained exclusion list
  as a drift source. Recorded in `specs/backlog-batch-v3.24.0.md` Dependencies as "deferred — out of scope
  for the T479 patch; the remove-from-EXCLUDED + add-to-FEATURE_DIRS patch is sufficient for MVP correctness."
- **Owner:** /teamwork (qa-engineer owns the test; sr-engineer if a shared helper is extracted).
- **Risk if skipped:** low/latent — current guard is correct for known dirs; this is future-proofing against
  the next hand-maintained-list drift.

## B5 — release-engineer staging list omits source directories (P0)
- **What:** `content/skill-release-engineer.md` SOP step 7 + `templates/claude-code-agents/release-engineer.md`
  enumerate the staging set as `lib/ content/ templates/ specs/ test/ qa_reports/ review_reports/`
  + metadata. It **omits `tools/ schema/ guards/ prompts/ bin/`** — i.e. every source directory
  except `lib/`. The post-commit sanity check only verifies `specs/<feature>.md`, so the gap is silent.
- **Symptom (v3.23.1 post-mortem):** the drift fix lived in `tools/drift.ts`; the release commit shipped
  the compiled `dist/tools/drift.js` (correct) but **not** the `tools/drift.ts` source. The tag therefore
  has source lagging dist. npx consumers run `dist/` so they are unaffected, but the repo tree is
  internally inconsistent. Required a backfill commit on `main` (tags are immutable — not retagged).
- **Fix:** add `tools/ schema/ guards/ prompts/ bin/` to the SOP step-7 staging enumeration and the
  template hint; extend `test/release-staging.test.mjs` to assert every top-level source dir in the repo
  appears in the staged-paths list (so a new source dir can't silently fall out of releases).
- **Owner:** /teamwork (edits governance SOP `content/skill-release-engineer.md` + template + test — pm→sr→reviewer→qa).
- **Risk if skipped:** every feature touching `tools/`/`schema/`/`guards/`/`prompts/`/`bin/` ships with
  source/dist divergence in its tag; future readers `git checkout`-ing a tag get stale source.

## B4 — No `.nvmrc` / `engines` → Node version drift
- **What:** Repo has no `.nvmrc`, no `.node-version`, and no `engines` field in
  `package.json`. The dev shell silently drifted to Node 26, which mismatched the
  `better-sqlite3` native ABI (compiled for Node 22, `NODE_MODULE_VERSION 127`),
  producing 55 `ERR_DLOPEN_FAILED` test failures. CI matrix is `[20, 22]` only.
- **Shipped (v3.23.1, Option Y):** Added `.nvmrc` (`22`) and `package.json`
  `"engines": { "node": ">=20" }` — **lower-bound only**. An upper bound (`<23`) was
  rejected: `better-sqlite3` recompiles against the consumer's Node ABI at `npx`-install
  time, so Node 23+ consumers have no mismatch; a ceiling would only emit spurious
  `EBADENGINE` warnings. Dev/CI determinism is owned by `.nvmrc` + the CI matrix `[20,22]`.
- **Risk if skipped (historical):** Recurring environment drift; full SQLite/RAG suite goes
  red on any machine running Node outside the CI matrix, masking real failures.
