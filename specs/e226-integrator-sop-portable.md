# e226-integrator-sop-portable

Lane `e226` of `specs/fanout-post-v4-w9.md` (post-v4 wave 9). Tickets: E226 + E349 + E350. Text-only wave: no code, no config, no `dist/` change.

## Problem Statement

The integrator SOP (`content/skill-integrator.md`) can be called in any workspace, but it calls agc's tools by repo-relative path (`node scripts/<x>.mjs`). That path only works when the workspace is the agc checkout itself. The scripts do ship with agc: `package.json` has no `files` field, so the install holds the whole tracked tree. This corrects the premise of E226. The real gap is the call form. E290 set the generic form in `docs/lane-protocol.md` §5 (`node <agc 安裝位置>/scripts/fanout.mjs`, and the repo addendum may give its own call). The SOP also states this repo's facts as if they were generic (E349): the shared-artifact list, `npm run build` / `npm audit` / `dist/`, `npm run check:bookkeeping`, and `node bin/agc-init.mjs`. Its 5a evidence and new-findings rows only describe `artifacts: repo`. Under `artifacts: local` the lane cannot commit those paths (D2 = (i)). The same repo-relative `node scripts/fanout.mjs check --cut` call also appears in the PM SOP, constitution §3.1 manifest tier condition 3 and the coord-03 manifest-tier writer action (E350).

## User Stories

- As an adopter's integrator, I want every agc tool call in my SOP written against the agc install, so that I can run the SOP in a workspace that is not the agc checkout.
- As an adopter's integrator, I want the repo-specific commands and lists (shared artifacts, build, dependency audit, bookkeeping check, `agc` call form) to come from my repo's addendum, so that I never run this repo's commands in mine.
- As an integrator in an `artifacts: local` workspace, I want the 5a evidence and new-findings checks to tell me where to read files the lane could not commit, so that I can verify a lane without sending it back for something it cannot do.
- As a lane PM / coordinator in an adopter, I want the `fanout.mjs check --cut` call in my SOP and constitution written against the agc install, so that the manifest-tier check can run.
- As this repo's integrator, I want the addendum to give the repo-relative call for every agc tool the SOPs call, so that this repo keeps working unchanged.

## Acceptance Criteria

Decision record for the items the brief left open: see *Dependencies / Prerequisites → Decisions made at cut*.

- **AC-E226-1** — Given `content/skill-integrator.md`, when it is searched, then it contains no `node scripts/`. Each tool it calls (`fanout`, `mailbox-watch`, `lane-status`, `merge-invariants`, `verify-release`, `test-lock`) appears at least once as `node <agc install>/scripts/<tool>.mjs`.
  proof: `node --test test/e226-integrator-sop-portable.test.mjs` (AC-E226-1 case); spot check `grep -c "node scripts/" content/skill-integrator.md` prints `0`.
- **AC-E226-2** — Given `content/skill-integrator.md`, when it is read, then it has exactly one **Tool calls** paragraph, placed directly after the Lifecycle `Invocation:` paragraph and before `## Governance state (D11)`. That paragraph is string `sop.tool-calls` verbatim. It defines `<agc install>`, gives `node <agc install>/bin/agc-init.mjs` as the call form when `agc` is not on PATH, names `laneProtocolAddendum`, and says to use the generic forms when there is no addendum.
  proof: `node --test test/e226-integrator-sop-portable.test.mjs` (AC-E226-2 case).
- **AC-E226-3** — Given `content/skill-integrator.md`, when it is searched case-insensitively, then it contains no `this repo` and no `bin/agc-init.mjs` outside the `<agc install>/bin/agc-init.mjs` form. Stage 6 step 1 carries string `sop.stage6-finish` and points to *Tool calls* for the call form when `agc` is not on PATH.
  proof: `node --test test/e226-integrator-sop-portable.test.mjs` (AC-E226-3 case).
- **AC-E226-4** — Given the 5a lane-layer table, when the `evidence` row and the `new findings` row are read, then they carry strings `sop.5a-evidence` and `sop.5a-findings` verbatim. The evidence row says to read `<worktree>/<evidence path>` under `artifacts: "local"`. The findings row says to read the worktree's `pending-tickets.md`, and to hand-file each finding from the copy finish leaves under primary's `.current/history/<YYYY-MM>/<lane>/`. Both rows keep their `send back` mismatch cell. The Stage 6 bullet `**Findings finish did not number**` stays byte-identical.
  proof: `node --test test/e226-integrator-sop-portable.test.mjs` (AC-E226-4 case).
- **AC-E349-1** — Given `content/skill-integrator.md`, when it is searched, then it contains none of `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `npm run build`, `npm audit`, `npm run check:bookkeeping` or `dist/`. Stage 1 step 3 carries `sop.stage1-shared`. Stage 4 *Mid-wave base fix* step 5 carries `sop.basefix-5`. The 5a verifier build bullet carries `sop.verifier-build`. 5b-4, 5b-5 and 5b-6 carry `sop.5b-4`, `sop.5b-5` and `sop.5b-6`. 5c-3 carries `sop.5c-3`.
  proof: `node --test test/e349-integrator-repo-facts.test.mjs` (AC-E349-1 case).
- **AC-E349-2** — Given `docs/lane-protocol-addendum.md`, when it is read, then its `## ` heading list is unchanged (`## §1 開工`, `## §2 檔案邊界`, `## §3 執行與驗證`, `## §4 新發現`, `## §5 信箱`, `## §7 中途修 base`). The existing §5 `fanout.mjs` line is byte-identical. §5 adds `add.5-tools` and `add.5-bookkeeping` verbatim. §7 adds `add.7-basefix` verbatim. No other line changes. For every `<tool>` the integrator SOP calls as `node <agc install>/scripts/<tool>.mjs`, and for `feature-rollup`, the addendum contains `node scripts/<tool>.mjs`.
  proof: `node --test test/e349-integrator-repo-facts.test.mjs` (AC-E349-2 case); spot check `git diff main...HEAD -- docs/lane-protocol-addendum.md` shows additions only.
- **AC-E349-3** — Given the lane branch, when the hard-condition tests run, then `test/e290-lane-protocol-generic.test.mjs`, `test/e294-lane-enterworktree.test.mjs`, `test/e177a-manifest.test.mjs` (AC7 included), `test/e246-mailbox-teardown.test.mjs` and `test/e289-render-addendum.test.mjs` (AC-E289-6 included) all pass, and none of those five files is in the lane diff. The pinned strings they rely on are listed under *Dependencies / Prerequisites → Hard-condition pins*.
  proof: `node --test test/e290-lane-protocol-generic.test.mjs test/e294-lane-enterworktree.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e289-render-addendum.test.mjs` exits 0, and `git diff --name-only main...HEAD -- test/e290-lane-protocol-generic.test.mjs test/e294-lane-enterworktree.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e289-render-addendum.test.mjs` prints nothing.
- **AC-E350-1** — Given `content/skill-pm.md`, `content/const-08-chain-31-mid.md` and `content/coord-03-core-fallback.md`, when they are searched, then none contains `node scripts/`. The PM Manifest-Tier row carries `pm.manifest-row`. Constitution §3.1 manifest-tier condition 3 carries `const08.cond3`. The coord-03 manifest-tier writer action carries `coord03.writer`. The coord-03 Feature-close roll-up obligation carries `coord03.rollup`. e296 AC1–AC3 literals still hold (`check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` in skill-pm; `check --cut` in const-08 and coord-03).
  proof: `node --test test/e350-fanout-call-form.test.mjs test/e296-manifest-tier.test.mjs` exits 0.
- **AC-E350-2** — Given the edited `content/**` fragments, when the compose goldens and context budgets are checked, then `test/compose-equivalence.test.mjs`, `test/e90-golden-capture-completeness.test.mjs` and `test/context-budget.test.mjs` pass. Every golden hunk and every budget bump is explained in the qa evidence as the E350 call-form change. Each re-baselined number equals the new measured value (zero headroom, as before).
  proof: `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs` exits 0.
- **AC-X-1** — Given every task committed and a clean tree, when the full suite runs, then it is all green. `npm run build` then leaves `git status --porcelain` empty: text-only wave, no `dist/` diff. Any `dist/` diff is flagged, not committed silently.
  proof: `node scripts/test-lock.mjs -- npm test` reports `fail 0`; then `npm run build && git status --porcelain` prints nothing.

## Copy / Strings

Agent-facing SOP and addendum text this ticket introduces. sr-engineer writes each string verbatim. `<…>` are literal placeholders in the SOP text.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.tool-calls | `**Tool calls**: agc's tools are written `node <agc install>/scripts/<tool>.mjs`, where `<agc install>` is the directory agc is installed in — agc's generic `docs/lane-protocol.md` is there too; `agc …` is `node <agc install>/bin/agc-init.mjs …` when `agc` is not on PATH. When `.current/.config.json` sets `laneProtocolAddendum`, the addendum it names gives the repo's own call forms, its shared generated artifacts, and its build, dependency-audit and bookkeeping-check commands; without one, use the generic forms.` | manifest `specs/fanout-post-v4-w9.md` Decisions D1 (人類 2026-10-19); phrase `<agc install>` = English of `docs/lane-protocol.md` §5 `<agc 安裝位置>`, already used in backlog E350 |
| sop.stage1-shared | `a shared generated artifact (the repo addendum lists them) belongs to exactly one lane per wave` (replaces `a shared generated artifact (this repo: `content/**` + `test/fixtures/compose-golden/**` + `test/context-budget.test.mjs`) belongs to exactly one lane per wave`) | backlog E349; D1 |
| sop.basefix-5 | `5. Then `git -C <worktree> merge --no-ff origin/<target>`; `node <agc install>/scripts/merge-invariants.mjs HEAD <worktree>` (absolute path); the repo's build and dependency-audit commands (the addendum names them) in the worktree; a resume notice to the lane (`type: close` on the pause topic, carrying the merge sha and naming any rebuilt tracked build output the lane must commit); one Decisions row.` | backlog E349; D1 |
| sop.stage6-finish | `agc feature finish <lane> --shipped --base integ/<feature>` (`agc` not on PATH: *Tool calls*). (replaces the `(this repo: `node bin/agc-init.mjs feature finish <lane> --shipped --base integ/<feature>`)` parenthetical; the rest of step 1 unchanged) | backlog E349; D1; E352 generic fallback (manifest 派工前核對) |
| sop.5a-evidence | `` `git show <branch>:<evidence path>` — verdict line and task id match; under `artifacts: "local"` the evidence paths are excluded from the branch, so read `<worktree>/<evidence path>` instead `` (the `command` cell of the `evidence` row) | manifest Decisions D2 = (i) (人類 2026-10-19); manifest Lanes row e226 範圍切線 |
| sop.5a-findings | `` `git show <branch>:.current/<lane>/pending-tickets.md`; no block below `## Applied`; root `NEW-TICKETS.md` untouched; under `artifacts: "local"` read `<worktree>/.current/<lane>/pending-tickets.md` instead — it is never committed, so finish numbers none of it: hand-file each finding from the copy finish leaves under primary's `.current/history/<YYYY-MM>/<lane>/` (Stage 6 step 1) `` (the `command` cell of the `new findings` row) | D2 = (i); manifest 派工前核對 (finish behaviour, E287 O6 path) |
| sop.verifier-build | `- the worktree's `status --porcelain` taken **after** a local run of the repo's build command (the addendum names it) — non-empty is itself a finding (tracked build output not rebuilt at commit);` | backlog E349; D1 (build commands → addendum) |
| sop.5b-4 | in 5b step 4, `` `dist/` is never hand-resolved: rebuild after merging. `` → `Tracked build output is never hand-resolved: rebuild it after merging.`; `` After merging, rebuild `dist/` and restart the primary MCP server `` → `After merging, run the repo's build and restart the primary MCP server` (rest of the step unchanged) | D1 |
| sop.5b-5 | in 5b step 5, `` (a `dist/` or golden regeneration is not substantive) `` → `(a build-output or golden regeneration is not substantive)` | D1 |
| sop.5b-6 | in 5b step 6, `` All merged: `npm run build` (commit the rebuilt `dist/`) → `` → `All merged: the repo's build (commit the rebuilt tracked output) → ` (the `node <agc install>/scripts/verify-release.mjs` call per AC-E226-1) | D1 |
| sop.5c-3 | in 5c step 3, `` Before the bookkeeping commit, run `npm run check:bookkeeping` and require exit 0 (the check is also part of `npm test` through its test file, so the pull request's CI re-runs it). `` → `Before the bookkeeping commit, run the repo's bookkeeping check when the addendum names one, and require exit 0.` | Decision C1 below; D1 |
| add.5-tools | `- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具，在本 repo 一樣用 repo 相對路徑：`node scripts/mailbox-watch.mjs`、`node scripts/lane-status.mjs`、`node scripts/merge-invariants.mjs`、`node scripts/verify-release.mjs`、`node scripts/test-lock.mjs`（全套一律 `node scripts/test-lock.mjs -- npm test`）、`node scripts/feature-rollup.mjs`。` (new bullet directly after the existing §5 line) | D1 (補充檔 §5 擴成涵蓋全部 `scripts/*.mjs`) |
| add.5-bookkeeping | `- 整合者 5c 的記帳檢查是 `npm run check:bookkeeping`：記帳 commit 前跑、要 exit 0；它也透過測試檔在 `npm test` 裡，PR 的 CI 會再跑一次。` (new bullet after `add.5-tools`) | Decision C1 below |
| add.7-basefix | `- 整合者中途修 base 第 5 步在 worktree 裡跑的建置與相依稽核是 `npm run build` 與 `npm audit --audit-level=high`。` (new last bullet of §7) | manifest Lanes row e226 範圍切線 (Stage 4 base-fix 第 5 步的建置與相依稽核 → 補充檔) |
| pm.manifest-row | in the Manifest-Tier Self-Attestation row, `` run `node scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` `` → `` run `node <agc install>/scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` (`<agc install>` = agc's install directory; the repo addendum may give its own call form) `` | backlog E350 |
| const08.cond3 | `(3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0` (only the path token changes) | backlog E350; manifest 派工前核對 (E350 併入) |
| coord03.writer | `` `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0 on that cut `` (only the path token changes) | same |
| coord03.rollup | `` run `node <agc install>/scripts/feature-rollup.mjs <feature>` `` (only the path token changes) | Decision C2 below |

Every other `node scripts/<tool>.mjs …` in `content/skill-integrator.md` changes only its path token to `node <agc install>/scripts/<tool>.mjs …`. Arguments and the surrounding sentence stay byte-identical.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `docs/lane-protocol.md` belongs to lane e351 (E351, E352). This lane does not read e351's branch. The D2 wording follows the manifest's Decisions D2 row.
- The text generated by `tools/fanout-handoff.ts` (`## 接手步驟` still says `node scripts/fanout.mjs` / `node scripts/mailbox-watch.mjs`). This is tool output, not SOP, and is excluded by the manifest's 「不在本波」 item. E345 is likewise excluded.
- `content/skill-release-engineer.md`'s `node scripts/*.mjs` (this repo's release tooling).
- Changing any script (`scripts/**`), including making `verify-release.mjs` / `check-bookkeeping.mjs` resolve the workspace instead of their own install. Filed as finding E226-NEW-1.
- Other repo-specific facts left in the integrator SOP that the tickets do not name: `ci.yml` triggers on `feat/**` (5a), the load-sensitive test list in `docs/backlog.md` (CI flake rule), the primary MCP server restart (5b-4), root `NEW-TICKETS.md` (5a), and `npm test` as the full-suite command. Filed as finding E226-NEW-2.
- Release bookkeeping (version bump, CHANGELOG, `docs/backlog.md` done-marks). The integrator does this at 5c / release.
- `dist/**`. The wave is text-only; see AC-X-1.

## Dependencies / Prerequisites

Base: `125b552` (manifest 派工 base). No design file: mode = no-design, so no Visual Structural Assertions and no scope gate. No external references (Resource Audit: the ticket rows and the manifest contain no URL / figma / ticket-system link). Sequential within the lane: T-E226-01 → T-E226-02 → T-E349-01 share one file. T-E350-01 is independent.

### Decisions made at cut (for integrator pre-review)

- **Generic phrase.** `node <agc install>/scripts/<tool>.mjs` is the English equivalent of `docs/lane-protocol.md` §5's `node <agc 安裝位置>/scripts/fanout.mjs`. Backlog E350 already uses it. The integrator SOP defines it once (`sop.tool-calls`) and uses it everywhere. The PM SOP defines it inline in its one row. const-08 and coord-03 use the bare form, to keep the constitution and teamwork budgets small. For `agc` itself, the not-on-PATH form is `node <agc install>/bin/agc-init.mjs`, matching the E352 generic fallback the manifest approved.
- **C1 — `check:bookkeeping` is treated as a repo command and moves to the addendum.** `scripts/check-bookkeeping.mjs` hard-codes this repo's `docs/backlog.md` and `docs/v4.0.0-new-tickets.md`, and resolves its root from its own location. It is this repo's check, not an adopter tool. The SOP says "the repo's bookkeeping check when the addendum names one" (`sop.5c-3`); the addendum names `npm run check:bookkeeping` (`add.5-bookkeeping`).
- **C1b — every `npm run build` / `dist/` in the integrator SOP moves out, not only Stage 4 step 5.** That covers the 5a verifier bullet, 5b-4, 5b-5, 5b-6 and the base-fix resume notice. D1 says build commands come from the addendum. The addendum already holds them (§1 `npm run build`, §3 `dist/`), so only the dependency audit is new addendum text (`add.7-basefix`). `npm test` (inside the test-lock wrapper) stays: the tickets do not name it, and it is filed in E226-NEW-2.
- **C1c — where the dependency audit goes in the addendum.** The generic file has no 「見補充規則」 slot for a dependency audit. The manifest Lanes row tells this lane to move Stage 4 base-fix step 5's build and dependency audit to the addendum. The new line sits under addendum §7, beside §7's existing rebuilt-artifact slot (generic §7 point 3). Integrator to confirm this placement is within the "fills only 見補充規則 places" hard condition. If it is not, the alternative is to drop `add.7-basefix` and keep the SOP's "the repo's … dependency-audit commands (the addendum names them)" with nothing named here. This would change this repo's practice, so it would be a `needs human ruling` item.
- **C2 — `node scripts/feature-rollup.mjs` (coord-03 line ~11) is folded in, not filed.** It is the same file, the same class and a one-token change. coord-03 is already re-pinned in the goldens by E350. `feature-rollup.mjs` reads `process.cwd()` / its argument, so the generic form works in an adopter. Listed for integrator pre-review.
- **C3 — 5a local-mode wording.** It follows the manifest's D2 human row and 派工前核對 (i) only. Read the worktree file for excluded paths. Hand-file from the copy finish leaves under primary's `.current/history/<YYYY-MM>/<lane>/` when `pending-tickets.md` was never committed. E196 / E217 are not named in the SOP; the generic file (e351) names them.
- **Findings filed** in `.current/e226/pending-tickets.md`, above `## Applied`:
  - E226-NEW-1: `verify-release.mjs` and `check-bookkeeping.mjs` resolve the repo from their own location, so `node <agc install>/scripts/verify-release.mjs --ci-check` in an adopter queries the agc install's repo, not the workspace. The generic call form for verify-release is therefore not yet functional outside this repo. This is a tool fix and is forbidden here (`scripts/**`).
  - E226-NEW-2: repo facts the tickets do not name are still in the integrator SOP (see Out of Scope).

### Hard-condition pins (must stay green, files not in the lane diff)

- `test/e290-lane-protocol-generic.test.mjs` AC-E290-3: the addendum must keep `node bin/agc-init.mjs`, `npm run build`, `rm node_modules`, `dist/`, `.current/tasks-index-receipt.json`, `check-md-tables`, `test/e130-lane-default.test.mjs`, `NEW-TICKETS.md`, `node scripts/fanout.mjs check --cut`, `註解 proof`, `每一行改動都是註解`, `content/**`, `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs`. AC-E290-8: no addendum line over 20 characters (trimmed) may appear in the rendered prompt. AC-E290-9: no trimmed addendum line may equal a `PROMPT_TEMPLATE_3B` line. The new lines are unique sentences; qa confirms by running the test.
- `test/e246-mailbox-teardown.test.mjs`: the SOP keeps `reset`, `never reused`, `by hand`, `stop the mailbox watch` and `removes the default-location mailbox`. None of these sentences is edited.
- `test/e294-lane-enterworktree.test.mjs`, `test/e177a-manifest.test.mjs` AC7 and `test/e289-render-addendum.test.mjs` AC-E289-6 read only `docs/lane-protocol.md` and render output. This lane changes neither.
- The addendum path stays `docs/lane-protocol-addendum.md`, with no word `approval` (e296 AC10). Its heading list is unchanged (AC-E349-2).
- The SOP gains no sentence saying this repo's rules never appear in it. The e292 cut pre-review rejected such a sentence before.
- Owned addendum pins that stay true: e286 needs addendum §7 to keep `dist/`, `註解 proof` and `每一行改動都是註解`; e329 needs `test/e130-lane-default.test.mjs`.

### Planned re-pins (owned tests; qa inventory, expected reds after the sr tasks)

| test | pin | broken by | re-pin to |
|---|---|---|---|
| `test/e178a-integrator-role.test.mjs` | verifier bullet `the worktree's \`status --porcelain\` taken **after** a local \`npm run build\`` (~:348) | T-E349-01 | `sop.verifier-build` |
| `test/e178a-integrator-role.test.mjs` | `it runs \`node scripts/verify-release.mjs --ci-check …\`` (~:349) | T-E226-01 | `<agc install>` form |
| `test/e285-integrator-session-handoff.test.mjs` | RESUME sentence `… restarts \`node scripts/lane-status.mjs --watch\` …` (~:113) | T-E226-01 | `<agc install>` form |
| `test/e286-integrator-trust-and-git.test.mjs` | base-fix `need()` list `npm audit --audit-level=high` (~:56); `item(5)` `/npm run build/`, `/npm audit --audit-level=high/` (~:74–75) | T-E349-01 | `sop.basefix-5` facts (repo's build and dependency-audit commands, addendum); addendum §7 `add.7-basefix` holds the literals |
| `test/e292-integrator-sop.test.mjs` | COPY status sentence `node scripts/lane-status.mjs --repo <path>` (~:46); Stage 4 send prefix `node scripts/mailbox-watch.mjs <to-lane.md> --send` (~:73); `Read-only: \`node scripts/lane-status.mjs\`` (~:81) | T-E226-01 | `<agc install>` form |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | verifier `npm run build` sentence (~:88); AC10 `npm run check:bookkeeping` exactly once in 5c (~:100–104) | T-E349-01 | `sop.verifier-build`; `sop.5c-3` once in 5c (+ addendum `add.5-bookkeeping`) |
| `test/e329-integrator-sop-followups.test.mjs` | `STAGE6_CLOSE` (two `node scripts/fanout.mjs validate`, ~:42); `COND2` (two `node scripts/fanout.mjs …`, ~:44) | T-E226-01 | `<agc install>` form; `STAGE6_FINDINGS` (~:43) must stay unchanged |
| `test/fixtures/compose-golden/**` | build-full-* ×4, hook-full, constitution-monolith, skill-coordinator-monolith (const-08 / coord-03 text) | T-E350-01 | regenerate via `node scripts/capture-constitution-golden.mjs`, explain each hunk |
| `test/context-budget.test.mjs` | skill-pm ≤ 4823; stripped constitution ≤ 10523 / non-design ≤ 8426; teamwork bundle ≤ 21633 (all zero headroom) | T-E350-01 | new measured values, zero headroom, bump-history note |

Expected unaffected (qa confirms; re-pin only if red): `test/e288-integrator-stage0.test.mjs`, `test/e296-manifest-tier.test.mjs` (AC1–AC3 literals kept, step-4 `verify-release.mjs --ci-check --sha <HEAD>` count kept), `test/e297-main-protected-sop.test.mjs`, `test/e336-portable-pull.test.mjs`, `test/skill-frontmatter.test.mjs`. The integrator SOP is in no golden and no context budget.

### Test hygiene for new tests

New tests (`test/e226-*`, `test/e349-*`, `test/e350-*`) read only the content files and the addendum. They do not read real `specs/fanout-*.md` contents. They do not diff against a fixed base sha. They do not run `git show <rev>:<path>` / `git log` as fixtures (e178a T-E77-02 meta-test). Full-suite runs are wrapped in `node scripts/test-lock.mjs -- npm test`, after commit on a clean tree.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E226-01 | sr: integrator SOP generic tool calls: add the *Tool calls* paragraph (`sop.tool-calls`); change every `node scripts/<tool>.mjs` to `node <agc install>/scripts/<tool>.mjs`; Stage 6 step 1 (`sop.stage6-finish`) (AC-E226-1..3) | none | 1 | `content/skill-integrator.md` | — |
| T-E226-02 | sr: 5a `evidence` and `new findings` rows gain the `artifacts: "local"` reading (`sop.5a-evidence`, `sop.5a-findings`); Stage 6 findings bullet untouched (AC-E226-4) | T-E226-01 | 1 | `content/skill-integrator.md` | — |
| T-E349-01 | sr: integrator SOP repo facts point at the addendum (`sop.stage1-shared`, `sop.basefix-5`, `sop.verifier-build`, `sop.5b-4`, `sop.5b-5`, `sop.5b-6`, `sop.5c-3`); addendum §5 `add.5-tools` + `add.5-bookkeeping`, §7 `add.7-basefix`, existing lines and headings untouched (AC-E349-1..3) | T-E226-01 | 2 | `content/skill-integrator.md`, `docs/lane-protocol-addendum.md` | — |
| T-E350-01 | sr: `node <agc install>/scripts/fanout.mjs` in the PM Manifest-Tier row, const-08 condition 3 and the coord-03 manifest-tier writer action; coord-03 roll-up `feature-rollup.mjs` (C2) (AC-E350-1, AC-E350-2 source side) | none | 3 | `content/skill-pm.md`, `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md` | — |
| T-E226-03 | qa: re-pin the call-form pins in owned integrator SOP tests (e178a :349, e285 :113, e292 :46/:73/:81, e329 STAGE6_CLOSE / COND2; STAGE6_FINDINGS unchanged) | T-E226-01, T-E226-02, T-E349-01 | 4 | `test/e178a-integrator-role.test.mjs`, `test/e285-integrator-session-handoff.test.mjs`, `test/e292-integrator-sop.test.mjs`, `test/e329-integrator-sop-followups.test.mjs` | — |
| T-E226-04 | qa: new test for AC-E226-1..4 | T-E226-01, T-E226-02 | 1 | `test/e226-integrator-sop-portable.test.mjs` | — |
| T-E349-02 | qa: re-pin build / audit / bookkeeping pins (e178a :348, e286 base-fix SOP assertions, e295 :88 + AC10) and new test for AC-E349-1..2; run the AC-E349-3 hard-condition set | T-E349-01, T-E226-03 | 4 | `test/e178a-integrator-role.test.mjs`, `test/e286-integrator-trust-and-git.test.mjs`, `test/e295-hop-cap-and-sop-halves.test.mjs`, `test/e349-integrator-repo-facts.test.mjs` | — |
| T-E350-02 | qa: new test for AC-E350-1 | T-E350-01 | 1 | `test/e350-fanout-call-form.test.mjs` | — |
| T-E350-03 | qa: regenerate compose goldens (`node scripts/capture-constitution-golden.mjs`) and re-baseline `test/context-budget.test.mjs` to measured values, explaining every hunk (AC-E350-2) | T-E350-01 | 2 | `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | — |
| T-E226-05 | qa: final gate. After every task is committed on a clean tree: `node scripts/test-lock.mjs -- npm test`, then `npm run build` + `git status --porcelain` empty (no `dist/` diff). Re-pin any remaining owned-test red within its SOP-assertion limit, write verdict evidence (AC-X-1, AC-E349-3) | T-E226-03, T-E226-04, T-E349-02, T-E350-02, T-E350-03 | 0 (evidence only) | — | — |
