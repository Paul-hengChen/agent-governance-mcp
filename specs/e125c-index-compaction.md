# e125c-index-compaction

Ticket: **E125c** (v4.0.0 Wave 6.1c, lane `e125c`, branch `feat/e125c-index-compaction`, base `165b72d`), with **E195** folded in (fanout-wave6 D5). Serial after e125a/e125b; E126 follows.

## Problem Statement

After E125a the root `tasks.md` is a v2 *history index* and the `_primary` tw_* ledger is `.current/_primary/tasks.md`; after E125b a shipped lane's ledger moves to `.current/history/<YYYY-MM>/<lane>/` and `agc feature finish --shipped` appends a `lane_closed:` pointer under root `## Closed Lanes` (and removes that lane's `tasks_moved` markers). Three gaps remain. **(1) E195**: `migratePrimaryReverse` (`tools/tasks-lane-migrate.ts:459-479`) refuses unless `sha256(root body after the notice)` equals the receipt, so the very first `finish --shipped` already broke the Wave 8 reversibility gate: today the root body hashes to `9bc90da0…` while `.current/tasks-index-receipt.json` holds `4792d507…` (the pre-append body, still equal to the `_primary` ledger body). Any compaction breaks it again. **(2) Size**: both files are ~548KB (root 548452 B, `_primary` 548036 B), 71/70 `##` sections, 905 `[x]` rows, 28 `[-]` rows, **0 open rows** — ~99% closed history paid for on every read. **(3) SOP prose**: release SOP step 7a says nothing about the lane-close writeback, the D2 pointer format, the case-insensitive `git log -i --grep` fallback (X8), that root `tasks.md` / `docs/backlog.md` are history indexes, or that hand-edits to root `tasks.md` are no longer read (X4b); `content/skill-pm.md` still tells PM to bootstrap `tasks.md` by hand (X1), which on a v2 workspace is exactly the `TASKS_LEDGER_ABSENT` situation lane-protocol §3 says to stop on.

## User Stories

- As a maintainer running the Wave 8 reversibility gate, I want `_primary` reverse migration to succeed on a root index that `finish --shipped` and this lane's compaction legitimately changed, so that v4 can be rolled back.
- As a maintainer, I want the reverse to keep the `## Closed Lanes` pointers, so that rolling back does not lose the only in-tree record of where closed lanes' history lives.
- As any agent reading tasks, I want the ledgers compacted to their live content plus a per-section summary, so that tw_* reads and prompt context stop paying for ~540KB of closed rows.
- As release-engineer, I want step 7a to state how lane ledgers are archived and how to find a ticket's rows afterwards, so that I never build a second archive path or hand-edit the history index.
- As PM, I want my SOP to point at the lane-local ledger, so that I never hand-create a root `tasks.md` in a v2 workspace.

## Acceptance Criteria

Definitions used below (normative for sr-engineer):

- **CL section** — the lines from a heading matching `^##\s+Closed Lanes\s*$` up to (not including) the next line matching `^#{1,2}\s`, or EOF, **plus** the run of blank lines immediately before the heading. (Same heading/terminator regexes as `bin/agc-init.mjs:1718-1719`; re-declared locally — bin/ is not ours.)
- **Marker line** — a line matching the existing `MARKER_LANE_RE` (`/^<!-- tasks_moved: lane=([A-Za-z0-9_-]+) /`).
- **normalizeIndexBody(body)** — drop every marker line, drop the CL section, drop trailing blank lines, then end with exactly one `\n` (empty stays empty). Pure; lines split/joined on `\n`.
- **Receipt sha** — `sha256(normalizeIndexBody(body))`, exported from `tools/tasks-lane-migrate.ts` as a pure helper (suggested name `primaryIndexReceiptSha(body: string): string`), used by the forward stamp, the reverse check and the one-off compaction. No CLI, no new file.

E195 — reverse migration (`tools/tasks-lane-migrate.ts` only):

- **AC1** — Given a v1 root whose body `B` has no CL section and no marker lines, when forward then reverse run with no edits, then the restored root is byte-identical to the original (e125a AC7 unchanged), and the forward receipt equals `sha256(B)` (normalize is the identity on a canonical body).
  proof: `node --test test/e125a-lane-local-ledgers.test.mjs` stays green unmodified, plus the new `test/e125c-index-compaction.test.mjs` case "AC1 identity round trip".
- **AC2** — Given a post-forward `_primary` workspace, when `applyClosedLanePointer`-shaped text (blank line, `## Closed Lanes`, blank line, one or more `<!-- lane_closed: … -->` lines) is appended to the root index, then `migratePrimaryReverse` succeeds and the restored v1 root = `<!-- schema_version: 1 -->\n` + ledger body with its own CL section (if any) removed and trailing blank lines trimmed + `\n` + the root's CL section lines + trailing `\n`. **The reverse carries the Closed Lanes section across** (it is never dropped); a CL section that was not trailing in the root is moved to the end.
  proof: `node --test test/e125c-index-compaction.test.mjs` case "AC2 closed-lanes carry".
- **AC3** — Given a feat lane whose `tasks_moved` markers were in the root index at forward time (so they are also in the `_primary` ledger body), when `finish --shipped`-style removal deletes that lane's markers from the root only, then the reverse still succeeds and the restored root omits every ledger marker line that is no longer present in the root index (mirroring finish's removal); marker lines still present in the root are kept verbatim.
  proof: `node --test test/e125c-index-compaction.test.mjs` case "AC3 removed markers".
- **AC4** — Given a root index with any other change to its normalized body (a hand-edited, added or removed task row or prose line — X4b), when the reverse runs, then it refuses with the existing `body changed since the forward migration` message and touches nothing (root, ledger and receipt bytes unchanged). The existing refusals (not a v2 index with the notice; receipt missing/unreadable) are unchanged.
  proof: `node --test test/e125c-index-compaction.test.mjs` case "AC4 hand-edit refuses".
- **AC5** — Given a legacy receipt stamped before this change as `sha256(raw body)`, when the root body is still byte-identical to that raw body, then the reverse accepts it (accept `receipt === sha256(normalizeIndexBody(b))` **or** `receipt === sha256(b)`). Receipt file shape stays `{"bodySha256":"<hex>"}`.
  proof: `node --test test/e125c-index-compaction.test.mjs` case "AC5 legacy receipt".
- **AC6** — (per human ruling **R1**, recommended option A) Given a v1 root whose body ends in a CL section, when the forward runs, then the `_primary` ledger receives the body **without** the CL section (canonical trailing newline), the root index keeps it, and the receipt is `primaryIndexReceiptSha(body)`; consequently both round trips are byte-exact: v1 → forward → reverse = original v1, and post-forward state → reverse → forward = the same three files byte-for-byte. (If R1 = B: the forward ledger copy is untouched, and the second round trip is required to be byte-exact only after one reverse/forward cycle — a fixpoint — with the ledger carrying an inert zero-row `## Closed Lanes` section.)
  proof: `node --test test/e125c-index-compaction.test.mjs` case "AC6 double round trip".
  Integrator conditions on R1 = A (to-lane#1, 2026-09-25): (i) the e125a test files pass unmodified; (ii) for a v1 root with NO CL section, the forward ledger and root index are byte-identical to the pre-change forward; the receipt value may differ (it is now sha256 of the normalized body), and a legacy raw-sha receipt stays valid (AC5) — amended by the integrator, to-lane#2 — proof: case "AC6 forward unchanged without CL"; (iii) T-E125C-04 review focus includes the forward-runner diff.

Compaction (data; one-off, no new tools/ or scripts/ file):

- **AC7** — Given the worktree at base, when the compaction runs, then `.current/_primary/tasks.md` = line 1 v2 sentinel, lines 2-3 verbatim (`# Tasks: qa-flow-enforcement`, the `feature_id` comment), a blank line, `## Active` + `_(No active tasks — ready for the next feature.)_`, a blank line, `## Compacted History` + one `compacted:` comment line (Copy `e125c.compacted-comment`) + one summary line per compacted `##` section in original order (Copy `e125c.summary-line`, heading text verbatim), then every **kept** section verbatim in original order. A section is **kept** iff it has an open `[ ]` row, or its bytes differ from the same-heading section in the last release tag's root `tasks.md` (`git describe --tags --abbrev=0` → `v3.118.0` at cut time), or it has no counterpart there — expected kept set at cut time: `## e145-md-tables-cited-donemark`, `## e125a-lane-local-ledgers` (sr records the actual set). Every other section (including the old `## Active` body and `## Completed`) is compacted.
  proof: `node --input-type=module -e` count check recorded in `.current/e125c/compaction-procedure.md`: kept + compacted = 70 original `##` sections of `_primary`, summary `done`/`voided` totals sum to (905 − kept `[x]`) / (28 − kept `[-]`), 0 open rows before and after.
- **AC8** — Given AC7, then the root `tasks.md` = v2 sentinel + `TASKS_INDEX_NOTICE` line + the exact compacted `_primary` body + the pre-compaction root CL section byte-for-byte (the `lane_closed: ticket=e125b …` pointer unchanged), and `.current/tasks-index-receipt.json` is re-stamped to `{"bodySha256": primaryIndexReceiptSha(<root body after the notice>)}` (which equals `sha256(<compacted _primary body>)`).
  proof: `node --input-type=module -e` one-liner recorded in the procedure file: root body after notice, normalized, equals the `_primary` body; receipt matches; `grep -c 'lane_closed: ticket=e125b' tasks.md` = 1.
- **AC9** — X7: the compaction drops (does not summarize-as-kept) any `_primary` section the D12 ownership filter treats as foreign (a live `.current/<lane>/tasks.md` or a history-bucket ledger for that heading's lane); at cut time the expected count is 0 (only `e125b` is in history and `_primary` has no `e125b` section). The procedure file records the count.
  proof: the procedure file's X7 line (`foreign sections removed: <n>`).
- **AC10** — Round-trip gate on real data (Wave 8): given a `$TMPDIR` copy of the post-compaction `tasks.md`, `.current/_primary/tasks.md`, `.current/tasks-index-receipt.json` (plus a `.git` HEAD on `main` so the lane resolves to `_primary`), when `migratePrimaryReverse` then the forward migration (first tw_* read, or `ensureTasksMigrated`) run from `dist/`, then the reverse succeeds and the forward reproduces all three files byte-for-byte (R1 = A; under R1 = B, after one extra cycle).
  proof: qa's test case "AC10 real-data round trip" (reads the repo's committed files into `$TMPDIR`; never writes the repo).
- **AC11** — No tw_* consumer regresses on the compacted ledger: `parseTasksFromFile` returns exactly the kept sections' rows (same ids/states as before compaction for those sections); `getNextTaskFromFile` reports `allComplete: true` before and after; `tw_detect_drift` on the lane worktree `_primary` shape reports no new drift string (every remaining id is a subset of the pre-compaction set, so no new vibe/handoff-ahead entries); `emitFeatureMetrics`' `tickets` for `E125A` is unchanged (7) because its rows are kept.
  proof: qa's test case "AC11 consumers" against a `$TMPDIR` copy.

SOP prose (`content/**`):

- **AC12** — `content/skill-release-engineer.md` step 7a gains ONE sub-bullet (Copy `e125c.7a-writeback`) stating: (a) lane ledgers are archived only by `agc feature finish --shipped` (`.current/<lane>/` → `.current/history/<YYYY-MM>/<lane>/` + one `lane_closed:` pointer under root `tasks.md` `## Closed Lanes`) — that is the ledger arm of 7a, release-engineer creates no second archive path and never writes root `tasks.md`; (b) root `tasks.md` and `docs/backlog.md` are history indexes, tw_* reads only `.current/<lane>/tasks.md`, and hand-edits to root `tasks.md` are not read by any tool after the v2 upgrade (X4b) and make the `_primary` reverse migration refuse; (c) D2 pointer format: primary key `ticket=` + `branch=`, `pr=` optional, `base_sha=` auxiliary and invalidated by a history rewrite (E104); (d) universal fallback `git log -i --grep <ticket-id>` — case-insensitive because pointers carry lowercase lane names (`ticket=e125b`) while commits say `E125b` (X8); (e) the convention that every lane commit subject carries its ticket id.
  proof: `grep -c 'git log -i --grep' content/skill-release-engineer.md` ≥ 1 and `grep -c 'history index' content/skill-release-engineer.md` ≥ 1.
- **AC13** — X1: `content/skill-pm.md` `## Artifacts` Tasks bullet and SOP step 7 point at the lane-local ledger: tasks go through `tw_add_task` into `.current/<lane>/tasks.md` (created by the tool when absent); root `tasks.md` is a history index PM never writes; the "create it directly" bootstrap wording is removed. The final-reply string `Done. Tasks in tasks.md.` is unchanged.
  proof: `grep -c 'bootstrap .tasks.md. directly\|create it directly' content/skill-pm.md` = 0 and `grep -c '.current/<lane>/tasks.md' content/skill-pm.md` ≥ 1.
- **AC14** — Goldens and budget: no `test/fixtures/compose-golden/**` file changes (neither edited file is composed into a golden bundle; if a golden goes red → stop and report, do not re-baseline). The only budget floor moved is the one actually pushed (expected: the `skill-pm stripped body ≤ 4401` cap in `test/context-budget.test.mjs`, raised by qa to the exact new measurement, plan §2.2).
  proof: `node scripts/capture-constitution-golden.mjs && git diff --stat -- test/fixtures/compose-golden/` prints nothing, and `npm test` is green after commit with zero untracked files.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e125c.compacted-comment | `<!-- compacted: E125c <YYYY-MM-DD> — <S> sections, <X> [x] rows, <V> [-] rows summarized below; full rows: git log -i --grep <ticket-id>, or git log -p -- .current/_primary/tasks.md (pre-compaction commit <sha> is auxiliary and invalidated by a history rewrite, E104) -->` | authored-here — pointer wording follows D2/X8 (fanout-wave6) |
| e125c.summary-line | `- <original heading text>: <x> done, <v> voided` | authored-here — no checkbox, so no task-pattern parser matches it |
| e125c.compacted-heading | `## Compacted History` | authored-here — carries no ticket id so `resolveLaneName` maps it to `_legacy` (verified), never to a lane |
| e125c.7a-writeback | step 7a sub-bullet, content per AC12 (a)-(e); sr drafts, reviewer checks each clause is present | authored-here — AC12 enumerates the required clauses |
| e125c.pm-ledger | skill-pm Tasks bullet / step 7 wording per AC13 | authored-here — X1 (fanout-wave6) |
| e195.refuse-changed | unchanged: `… body changed since the forward migration` | e125a spec (existing string) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Moving `qa_reports/` / `review_reports/` evidence (E168).
- Compacting `docs/backlog.md` (D3; post-v4 ticket).
- CHANGELOG, including the X4b MAJOR upgrade-path entry (Wave 8).
- `specs/<feature>` path prose (D-A).
- `bin/**` — including finish's pointer string, which still says `git log --grep` without `-i` (filed as E125c-NEW-1).
- Release step 8a staging of `.current/_primary/tasks.md` (filed as E125c-NEW-2).
- Constitution (`content/const-*.md`) wording — the §5-level "PM bootstrapping write" exemption and the generic `tasks.md` mentions stay (human ruling R2; filed as E125c-NEW-3).
- `docs/lane-protocol.md` mirror of the commit-message convention (integrator; E125c-NEW-4).
- Any new `tools/` or `scripts/` file; any edit to `tools/` other than `tools/tasks-lane-migrate.ts`.

## Owned Files (this ticket)

`tools/tasks-lane-migrate.ts` (reverse + receipt path; forward runner CL peel — ownership expansion accepted by the integrator, to-lane#1), `dist/**`, `content/skill-release-engineer.md`, `content/skill-pm.md`, root `tasks.md`, `.current/_primary/tasks.md`, `.current/tasks-index-receipt.json`, `specs/e125c-*.md`, `.current/e125c/**`, qa's own `test/e125c-index-compaction.test.mjs` and `test/context-budget.test.mjs`.

## Dependencies / Prerequisites

- e125a and e125b merged (base `165b72d`). Read-only consumers verified at cut: `tools/tasks-file.ts` (D12 filter already checks history buckets, e125b AC8), `tools/drift.ts` (ids not in the ledger are ignored on both drift directions), `tools/metrics.ts` (dedups ids across root + lane ledgers; only the active feature's code is counted at PASS time), `bin/agc-init.mjs:1742-1764` (`applyClosedLanePointer` — the CL shape AC2 carries).
- Compaction method (decided): a one-off `node --input-type=module` script written in `$TMPDIR`, importing `primaryIndexReceiptSha` from `dist/tools/tasks-lane-migrate.js`; the exact script text, the kept/compacted/X7 counts and before/after byte sizes are committed as evidence in `.current/e125c/compaction-procedure.md`. It must run after T-E125C-01 is built into `dist/`. No MCP tw_* call touches `_primary` in this worktree (the lane resolves to `e125c`), so no lock contention.
- Human rulings requested at cut (see the PM reply): **R1** forward peels the CL section (A, recommended) vs forward untouched (B); **R2** no constitution edit (recommended) vs a one-sentence history-index declaration in `const-05`; **R3** architect skipped (recommended).
- Resource Audit: zero external references (no URLs/Figma/ticket-system refs in the inputs); `external_refs` omitted.
