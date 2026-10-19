# Review — T-E351-01

covers: T-E351-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Text-only edit to `docs/lane-protocol.md` for E352 (§1 generic fallback when `agc` is not on PATH) and E351 (`artifacts: local` commit, evidence and findings rules in §3 and §4). Diff `19fc049..9358227`: 1 line removed, 5 lines added.
- Each new line matches its spec Copy / Strings cell byte for byte and sits where the spec puts it. I checked this with a script against the spec table, not by eye. No other line in the file changed.
- I checked every factual claim against `bin/agc-init.mjs` (read-only) and found no overclaim. Two gap clauses describe less than the code or backlog covers. Both are optional findings.
- The hard conditions hold. Heading skeleton is unchanged and §7 is still last. No AC-E290-3 forbidden string appears. No new line equals or is contained in a `PROMPT_TEMPLATE_3B` line. 18 related test files pass: 221 pass, 0 fail, 2 skipped. Both skips are e130 history-dependent ACs that skip when commit `121ddc8` is not in history. They are not caused by this diff.
- Verdict: APPROVED. Same-model note: sr-engineer and this reviewer both ran on opus, so blind spots may overlap. The Copy check was mechanical to offset that.

## AC Completeness
Scope note: T-E351-01 is the sr build task. Assertions that live in tests are QA's (T-E351-02). For those ACs, "implemented" below means the doc side is in place and the existing tests that apply are green.
- AC-E352-1 — implemented — `docs/lane-protocol.md:17` equals `copy.s1-fallback` (×1). `copy.s1-old` count is 0, and the line sits at the same position as the base line.
- AC-E352-2 — implemented — §1:17 holds `node <agc 安裝位置>/bin/agc-init.mjs`. §5:97 still holds `node <agc 安裝位置>/scripts/fanout.mjs`.
- AC-E352-3 — implemented — the added lines contain none of the AC-E290-3 strings (`node bin/agc-init.mjs` is absent: the placeholder sits between `node ` and `bin/`). e290 is green.
- AC-E351-1 — implemented — `:41` `copy.s3-commit-kept` is unchanged (×1). `:42` equals `copy.s3-local`.
- AC-E351-2 — implemented — `:43` equals `copy.s3-harvest`.
- AC-E351-3 — implemented — `:44` equals `copy.s3-gaps`. `E196` and `E217` each appear exactly once in the file.
- AC-E351-4 — implemented — `:70` `copy.s4-commit-kept` is unchanged (×1, e329 `LP_COMMIT`). `:71` equals `copy.s4-local`.
- AC-E351-5 — implemented (doc side) — the constants match the doc: `ARTIFACT_EXCLUDE_RULES` at `bin/agc-init.mjs:1055`, `ABANDON_EVIDENCE_DIRS` at `:1116` (no `specs`), `SHIPPED_EVIDENCE_DIRS` at `:1123`, and the "not numbered — finish warns, lists its findings and keeps a copy" fragment in `STR_USAGE_FEATURE` at `:1010-1040`. The test assertion belongs to QA.
- AC-E351-6 — implemented — (a) the eight `## ` headings are in AC-E290-2 order and §7 is last. (b) No added line equals or is a substring of a `PROMPT_TEMPLATE_3B` line (checked against `dist/tools/fanout-manifest.js`), and e294/e177a are green. (c) None of the forbidden strings appear. (d) No absolute-path regex match. (e) Base vs head: exactly 1 removed and 5 added, all of them Copy cells.
- AC-E351-7 — partial (by design) — the targeted pinned-string suites are green (see Correctness). The full `npm test` on a clean tree after the last commit is QA's step under T-E351-02. This is not a finding against T-E351-01.
- AC-E351-8 — implemented — `git diff --stat main...HEAD` lists only `.current/e351/**`, `docs/lane-protocol.md` and `specs/e351-lane-protocol-gaps.md`, all owned paths.

## Correctness
I checked every claim in the new lines against `bin/agc-init.mjs` (read-only):
- **s1 fallback** — `package.json` `bin.agc` is `./bin/agc-init.mjs`, so `node <agc 安裝位置>/bin/agc-init.mjs <same subcommand/args>` is the same entry point as `agc`. True.
- **s3-local exclude list** — `ARTIFACT_EXCLUDE_RULES = ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"]` (`:1055`). The comment there says "specs/, design/ and research/ stay tracked", which backs "`specs/` 照樣 tracked". The "no `git add -f`" rule is policy, not a tool claim. True.
- **s3-harvest `--shipped` evidence** — `planShippedEvidenceHarvest` (`:3009`) walks `SHIPPED_EVIDENCE_DIRS` recursively. A file is at risk when it is untracked and `check-ignore` does not return 1. It is copied to primary's `<dir>/archive/<ticketId>/<sub>` (`:3049`). "被 ignore 又沒 tracked … 複製到 primary 的 `<目錄>/archive/<lane>/`" is true.
- **s3-harvest `--shipped` lane dir** — in `planLaneClose` (`:2676`), `harvestSrc` is set when `.current/<lane>/` has no tracked content. The apply step runs `fs.cpSync(harvestSrc, histAbs, { recursive: true … })` into `.current/history/<bucket>/<lane>/` (`:2836-2838`). Under local mode the dir is fully excluded, so this path is the one taken. True.
- **s3-harvest `--abandoned`** — `planAbandonEvidence` (`:1679`) matches the lane id as a case-insensitive token, only on files directly under `qa_reports/` and `review_reports/`, and moves each match to `<dir>/abandoned/<ticketId>/`. `planAbandonEvidenceHarvest` (`:1738`) puts each untracked, at-risk file at `repoRoot/<same dst>` in primary. `planAbandonCurrentHarvest` (`:1861`) copies an untracked `.current/<lane>/` into primary history. All three clauses are true.
- **s3-gaps E196** — on the first run `planLaneClose` uses `git mv` for a tracked lane dir. `laneIgnoredStateFiles` is called only on the `alreadyClosed` re-run path (`:2680-2681`), so ignored siblings are dropped on the first run. This matches the backlog row (`docs/backlog.md:319`). True. See optional finding 1.
- **s3-gaps E217** — `ABANDON_EVIDENCE_DIRS` has no `specs` (`:1116`), and the backlog row (`:340`) describes the same "git-ignored, unlinked spec deleted by `git worktree remove`" loss. True.
- **s4-local (O6)** — `readUnallocatedFindings` (`:2339`) returns the worktree file's findings only when the file is absent at every rev finish reads. The E287 comment block (`:2307-2314`) and `STR_USAGE_FEATURE` both say finish does not number them, reports them on stderr and keeps a verified copy in `.current/history/<YYYY-MM>/<lane>/`. Under local mode the file can never be at a rev without a force-add, so "一律走上一條路徑" is true.
- Tests run: e130, e177a-check-cli, e177a-manifest, e177b-lane-status, e177b-mailbox-watch, e178a, e246, e286, e289-config-key, e289-render-addendum, e290, e292-integrator-sop, e294, e295, e296, e329, e342, e343. Result: 223 tests, 221 pass, 0 fail, 2 skip. Both skips are e130 AC4/AC14, which skip when `121ddc8` is not in history.

Findings:
- **optional 1** — `docs/lane-protocol.md:44` E196 clause names only the `--shipped` first run. The backlog row (`docs/backlog.md:319`) now also holds folded-in E206: the same partly-tracked loss on `--abandoned`. The clause says less than the row; it is not an overclaim. Under `artifacts: local`, with `.current/` fully excluded, neither path triggers, so a lane following the rules loses nothing. The wording is PM-owned Copy, and the sr applied it verbatim. Optional follow-up: widen the clause, e.g. `--shipped`／`--abandoned`.
- **optional 2** — `:44` In the local-mode bullet, E196 can only arise when `.current/<lane>/` is partly tracked. The bullet directly above (`:42`) forbids exactly that. Naming the gap is still useful (D2 asks for it, and an adopter may track part of the dir anyway), but readers may wonder why it is there. No change needed.
- **optional 3** — `:43` "第一層檔名帶 lane 名（不分大小寫）" simplifies the bounded-token match. The id must be delimited by `_`, `.`, `-` or a string edge (`:1682`), so `reviewe351x.md` would not move. With the mandated `review_<task id>.md` / `T-<ticket>-NN` naming this is harmless.

## Quality
No findings. The new lines follow the surrounding bullet and sub-bullet style (bold lead, full-width punctuation, backticked paths), and the §1 fallback copies §5's fan-out phrasing word for word. No comments are added (docs-only diff), so step 4b has nothing to check.

## Architecture
No architecture spec (architect hop skipped by design: one docs file). The generic file stays repo-agnostic. The new lines describe agc tool behaviour that every adopter shares (`agc init --artifacts=local`, `agc feature finish`). The only repo path is `bin/agc-init.mjs`, behind the `<agc 安裝位置>/` placeholder, which the plan allows explicitly. The repo-specific call form is still left to the addendum. Constitution §6 generic citation: E196 and E217 each carry a plain-language clause, and the doc does not cite E73 (the spec does), explaining local mode in words instead.

## Security
No findings. Docs only. No absolute local paths, secrets or sensitive references. The new rule against `git add -f` on excluded paths lowers the risk of leaking agc artifacts.

## Performance
No findings. No code change.

## Verdict
APPROVED — all five new lines match the spec Copy table verbatim and in position, every tool claim holds against `bin/agc-init.mjs`, and every hard condition and pinned-string suite is green. The three findings are optional.
