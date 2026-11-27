# e443a-manifest-waves — manifest waves, wave-table comparison, batch render

Ticket E443a (lane e443a, wave 7 plan `specs/fanout-post-v5-w7.md`). Scope and acceptance come from `specs/ticket-cut-e443.md` section NEW-1; human rulings R1–R5 and the cut-file Q4 ruling are applied as given and not reopened here. This spec fixes the interface details that the cut file left to the cut.

## Problem Statement

A fan-out manifest's Lanes table has no wave number and its `相依` cell is free text, so nothing can check mechanically that a manifest built from an approved `spec-workshop` wave table kept the approved tickets, their dependencies and their file boundaries. The integrator therefore halts for a human approval on any change, even one that only serialises two lanes. Separately, `fanout.mjs render` only produces the hand-started prompt: it tells the session to run `feature start` and `EnterWorktree`, waits for a typed approval, and needs `--summary` / `--reading` typed by hand, so a lane started in batch cannot use it as its single prompt source. This ticket adds the `波次` column with a checked `相依` format, a `waves` comparison command with its integrator SOP rule, and a `--batch` render mode, while every existing manifest and every hand-started render stays byte-identical.

## User Stories

- As the integrator, I want `validate` to check the `波次` and `相依` cells of a wave manifest, so that a typo in a dependency is caught before dispatch, not by a lane that starts too early.
- As the integrator, I want one command that compares my manifest with the approved wave table and the ticket files, so that a manifest that only reorders or groups approved work is dispatched without stopping the human, and anything else still halts.
- As the human, I want an automatic dispatch to leave a Decisions row with its reason and to be listed in the integrator's final report, so that I can audit what was decided without me.
- As a batch-lane launcher (next ticket), I want `render --batch` to emit the batch prompt from the manifest and the ticket files alone, so that there is one prompt source and no hand-typed summary.
- As an existing adopter, I want manifests without `波次` and `render` without `--batch` to behave exactly as before, so that nothing I already run changes.

## Interface (fixed at this cut)

### I1 — the `波次` column (scope 1, 2)

- Header cell `波次` (exported as `WAVE_COLUMN`). It sits **immediately after `相依`** and before the optional `approval` column. The dispatchable Lanes header shapes are exactly these four; any other shape stays provisional exactly as today:
  1. `LANES_HEADER` (8 columns) — unchanged;
  2. `LANES_HEADER` + `approval` (9) — unchanged;
  3. `LANES_HEADER` + `波次` (9) — new;
  4. `LANES_HEADER` + `波次` + `approval` (10) — new.
- `LANES_HEADER`, `APPROVAL_COLUMN`, `APPROVAL_VALUES` and every existing error code, message and output line keep their bytes. The `approval` cell is read by header position (after `波次` when present), not by a fixed index.
- `DispatchableLane` gains `wave?: number` and `depLanes?: string[]`, both `undefined` for a row of a table without `波次`.
- The `波次` / `相依` checks apply only to rows of a Lanes table whose header has `波次`. Without it, `相依` stays free text and no new check runs (A1-3).
- **`波次` cell**: after the existing trim, must match `^[1-9][0-9]*$`. Otherwise row error `WAVE_NOT_INTEGER`.
- **`相依` cell**: exactly `無`, or a list split on `,` `，` `、` (whitespace around separators ignored). Row errors, attributed to the row's own lane, in this order:
  - `DEPS_NOT_LANE_LIST` — an empty cell, an empty entry, `無` combined with names, or an entry that does not match `LANE_ID_RE` (prose);
  - `DEPS_SELF` — the lane names itself;
  - `DEPS_LANE_UNKNOWN` — an entry that is not a lane id of a Lanes table that has the `波次` column in this manifest;
  - `DEPS_LATER_WAVE` — an entry whose lane has a larger `波次` than this lane (skipped when either wave cell is itself in error).
- Row errors use the existing row-error path (scope `row`, lane attributed), so `validate` exits 2 and prints `fanout: error: <CODE>: lane <id> (section "<heading>" line <n>): <message>`; render/check of that lane refuse as for any row error.

### I2 — ticket ids and ticket-file lookup (scope 3, 5)

- **Ticket ids of a `票` cell**: the cell split on `,` `，` `、`, each part trimmed, empty parts dropped, order kept (exported helper `ticketIds(cell)` in `tools/fanout-manifest.ts`).
- **Lookup** (exported helper in `tools/fanout-manifest.ts`, used by both render and `waves`, so there is no circular import): ticket directory = `resolveTicketDir(<primary>)` from `tools/config.ts` (`ticketDir` in the primary checkout's `.current/.config.json`, default `docs/tickets`). Files read: every `*.md` directly in that directory (not recursive), except `README.md` in any case — the same set `check-tickets` reads. Each is parsed with `parseTicketFile` from `tools/ticket-file.ts` (imported, not modified); a file is matched by its `id` field, byte-equal to the ticket id.
- Lookup errors (input errors, exit 2), each naming the ticket; `<dir>` and `<file>` are shown relative to primary with `/` separators, never absolute:
  - `TICKET_FILE_ABSENT` — `ticket <t>: no ticket file under <dir> has id <t>` (also when the directory does not exist);
  - `TICKET_FILE_DUPLICATE` — `ticket <t>: more than one ticket file under <dir> has id <t> (<file>, <file>)`;
  - `TICKET_FILE_INVALID` — `ticket <t>: ticket file <file> does not parse: <first problem>` (any `problems` entry counts; no fallback text is used).

### I3 — `render --batch` (scope 5, 6)

- CLI: `node scripts/fanout.mjs render <manifest> <lane> --batch [--mailbox-root <dir>] [--primary <path>] [--base <sha>]`. `--batch` takes **no value** and may stand anywhere after `<lane>`'s position among the args; it is removed before the existing flag parser runs. Given twice → `USAGE` (`flag --batch given more than once`), exit 2. Given together with `--summary` or `--reading` → `USAGE` (`render --batch takes no --summary or --reading (both come from the lane's ticket files)`), exit 2. `RenderOptions` gains `batch?: boolean`; no `--template` flag is added (E343 pin).
- The batch template is **derived** from the template in use (`opts.template ?? PROMPT_TEMPLATE_3B`) by two exactly-once replacements: the first-step source line (`` `feature start` 建好 worktree 之後，呼叫 `EnterWorktree`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 `cd <worktree> &&`。 ``) → `BATCH_FIRST_STEP_LINE`, and the closing sentence `需要我核准的事，等我在這裡親手打字。` → `BATCH_CLOSING_LINE` (Copy / Strings). `PROMPT_TEMPLATE_3B` itself and its provenance doc comment are unchanged; there is no second copy of the template. If either source text does not occur exactly once → input error `TEMPLATE_BATCH_LINE_ABSENT` (`the dispatch-prompt template does not hold the <first-step line|closing line> exactly once, so batch render cannot replace it`), exit 2. The two-layer lane-rules pointer (laneProtocolAddendum) is applied to the batch template exactly as to the hand-started one.
- `<一句話>` = the `title` field of each of the lane's tickets (I2 order), joined by `；`.
- `<計劃的必讀章節> + <票面 row>` = one entry per ticket, `<file>的 ## Scenarios（<id>、<id>…）`, where `<file>` is the ticket file's path relative to primary with `/` separators and the ids are every scenario id in file order, `## Added during build` ones included; entries joined by ` + ` (the existing reading join).
- A `票` cell with no ticket id → input error `TICKET_CELL_EMPTY` (`lane <l>: 票 cell names no ticket`), exit 2. Any I2 lookup error → exit 2 naming the ticket. All render errors are collected before returning, as today.
- **Without `--batch`** every code path, error, warning and output byte is what it was before this ticket (A1-12).

### I4 — `waves` comparison (scope 3)

- CLI: `node scripts/fanout.mjs waves <manifest> <wave-table> [--primary <path>]`, logic in the new module `tools/fanout-waves.ts` (`runWaves`), loaded by `scripts/fanout.mjs` on demand like `handoff`. Primary: `--primary`, else the first `git worktree list --porcelain` entry from the manifest's directory (as render); none → `PRIMARY_NOT_FOUND`, exit 2.
- **Exit codes**: 0 = all three conditions hold; 1 = at least one broken condition; 2 = usage or any parse/input error (`fanout: error: <CODE>: <message>` lines on stderr).
- **Manifest preconditions (exit 2)**: any `validateManifest` error is printed as `validate` prints it; a provisional lane, or a Lanes table without `波次` → `WAVES_COLUMN_ABSENT` (`section "<heading>" (line <n>) has no 波次 column — waves compares only a manifest whose every Lanes table has it`).
- **Wave table** (the `spec-workshop` discussion record; any Markdown file): exactly one table whose header cells, trimmed, are exactly `wave`, `ticket`, `depends on`. Rows: `wave` matches `^[1-9][0-9]*$`; `ticket` non-empty and unique; `depends on` is empty, `—`, `-`, `none` or `無` (= no dependency), else a list split on `,` `，` `、` whose every entry is another ticket of the same table. Errors (exit 2): `WAVE_TABLE_UNREADABLE` (`cannot read wave table "<file>": <reason>`), `WAVE_TABLE_ABSENT` (`no | wave | ticket | depends on | table found in <file>`), `WAVE_TABLE_DUPLICATE` (`more than one | wave | ticket | depends on | table in <file> (lines <a>, <b>)`), `WAVE_TABLE_ROW_MALFORMED` (`<file> line <n>: <what is wrong>`).
- **Ticket files**: looked up (I2) for every ticket of the wave table; any lookup error → exit 2. Tickets that are only in the manifest are not looked up; they are reported by condition 1.
- **Condition 1 — same ticket set** (manifest tickets = `ticketIds` of every dispatchable lane's `票` cell). One FAIL line per instance:
  - `FAIL  TICKET_ADDED: ticket <t> is in lane <l>'s 票 cell but not in the wave table`
  - `FAIL  TICKET_REMOVED: ticket <t> is in the wave table but in no lane's 票 cell`
  - `FAIL  TICKET_IN_TWO_LANES: ticket <t> is listed more than once across 票 cells (lanes <l1>, <l2>)`
- **Condition 2 — every approved dependency kept.** For each wave-table pair "X depends on Y" where X and Y each sit in exactly one lane: kept when (a) both are in one lane and Y's position in its `票` cell is before X's, or (b) Y's lane is reachable from X's lane along `相依` edges (one or more steps). Otherwise:
  - `FAIL  DEPENDENCY_DROPPED: <X> depends on <Y> (wave table), but lane <lx> does not reach lane <ly> through 相依`
  - `FAIL  DEPENDENCY_DROPPED: <X> depends on <Y> (wave table), but both are in lane <l> and <Y> is not listed before <X> in its 票 cell`
- **Condition 3 — owned paths inside allowed paths.** Per lane, the `擁有` tokens (`ownedTokens`) minus bookkeeping tokens: a token equal to `tasks.md`, starting with `.current/`, `qa_reports/` or `review_reports/`, or for which `isImplicitBookkeeping(token, lane)` holds. A remaining token is inside when it is byte-identical to an `allowed paths` entry of one of the lane's tickets that are in the wave table, or it is not a glob (`isGlobToken` false) and `matchesGlob(token, entry)` holds for such an entry. A glob token is never inside a different glob. Otherwise:
  - `FAIL  OWNED_OUTSIDE_ALLOWED: lane <l>: 擁有 token <token> is not inside the allowed paths of <t1>、<t2>` (or `… of any approved ticket of the lane` when the lane holds none).
- **Output on stdout.** Exit 1: the FAIL lines (condition 1, then 2, then 3), then `fanout waves: <k> broken condition(s) — halt for human approval`. Exit 0: `fanout waves: ok — <n> ticket(s) in <m> lane(s), <d> approved dependency(ies) kept`, then the reason line `WAVES_REASON_LINE` (Copy / Strings) as the last line. The integrator pastes that reason line as the Decisions row's `內容`.
- The new codes above are CLI codes; none ends in a gate-code suffix (`test/error-code-contract.test.mjs`), and none appears backtick-quoted in `content/**`.

## Acceptance Criteria

Ticket: `specs/ticket-cut-e443.md` section NEW-1 (backlog E443a). It is a ticket-cut file, not a ticket-format file (this repository has no ticket directory), so the scenarios are restated below one-to-one with the cut file's A1-1..A1-12, with the interface above filled in. Fixtures are synthetic (`test/fixtures/e443a/**`); every test copies the ticket-file fixtures into a temporary primary and passes `--primary`, so no tracked fixture is ever rewritten.

- **A1-1** — Given a manifest whose Lanes table has `波次` (header shape 3 and shape 4) with integer waves and `相依` cells that are `無` or lane names of the same or an earlier wave (including a list `a, b` and the `、` separator), when `fanout.mjs validate` runs and `check <manifest> <lane>` runs against a temporary repo, then validate exits 0 with the existing `fanout: ok — …` line, check reports no format error, and `parseManifest` gives each lane its `wave` and `depLanes`.
  proof: `node --test test/e443a-wave-columns.test.mjs` (A1-1 tests) passes.
- **A1-2** — Given that manifest with, one at a time, a `波次` cell `0`, `1.5`, `二` or empty; a `相依` cell holding prose (`e1 merged`), `—`, an unknown lane name, the lane itself, or a lane of a later wave, when `fanout.mjs validate` runs, then it exits 2 and stderr has one `fanout: error:` line with `WAVE_NOT_INTEGER`, `DEPS_NOT_LANE_LIST`, `DEPS_LANE_UNKNOWN`, `DEPS_SELF` or `DEPS_LATER_WAVE` respectively, naming `lane <id>` and the cell (`波次` or `相依`).
  proof: `node --test test/e443a-wave-columns.test.mjs` (A1-2 tests) passes.
- **A1-3** — Given every `specs/fanout-*.md` at the dispatch base (none has `波次`), when `fanout.mjs validate` runs on each, then each exit code equals the one recorded at base; and given synthetic 8-column and 9-column-with-`approval` manifests (valid, and with a `相依` cell of free prose), validate stdout and exit code are the pinned pre-ticket values.
  proof: `for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f" >/dev/null 2>&1; echo "$f $?"; done | diff qa_reports/validate-baseline_e443a-manifest-waves.txt -` prints nothing (qa records that file from the same loop before any build change), and `node --test test/e443a-wave-columns.test.mjs` (A1-3 tests) passes.
- **A1-4** — Given an approved wave table where tickets A and B are parallel in wave 1 and C depends on A in wave 2, ticket files for A, B, C, and a manifest that serialises A and B (B's lane gets `相依` = A's lane, or a later `波次`), when `fanout.mjs waves` runs, then it exits 0 and its last stdout line is exactly `WAVES_REASON_LINE` with `<n>` = 3 and `<d>` = 1. Also exit 0 when A and C sit in one lane with A listed first.
  proof: `node --test test/e443a-wave-compare.test.mjs` (A1-4 tests) passes.
- **A1-5** — Given a manifest that drops the approved dependency C→A (C's lane neither reaches A's lane through `相依`, nor holds A before C), when `fanout.mjs waves` runs, then it exits 1 and stdout has `FAIL  DEPENDENCY_DROPPED: C depends on A (wave table)…`; the same-lane reversed order (C listed before A) also exits 1 with the same-lane message.
  proof: `node --test test/e443a-wave-compare.test.mjs` (A1-5 tests) passes.
- **A1-6** — Given a manifest that adds ticket D, removes ticket B, or lists A in two lanes, when `fanout.mjs waves` runs, then it exits 1 and stdout has `TICKET_ADDED` naming D, `TICKET_REMOVED` naming B, or `TICKET_IN_TWO_LANES` naming A, respectively.
  proof: `node --test test/e443a-wave-compare.test.mjs` (A1-6 tests) passes.
- **A1-7** — Given a lane whose `擁有` holds a literal path outside its tickets' `allowed paths` (and, separately, a glob token that is not byte-identical to an allowed glob), when `fanout.mjs waves` runs, then it exits 1 and stdout has `FAIL  OWNED_OUTSIDE_ALLOWED: lane <l>: 擁有 token <path> …`; bookkeeping tokens (`.current/<lane>/**`, `specs/<lane>-*.md`, `qa_reports/`, `review_reports/`) never fail; a wave-table ticket with no ticket file exits 2 with `TICKET_FILE_ABSENT` naming it.
  proof: `node --test test/e443a-wave-compare.test.mjs` (A1-7 tests) passes.
- **A1-8** — Given `content/skill-integrator.md`, when it is read, then Stage 1 step 6 ends with `SOP_STAGE1_WAVES` verbatim; the Stage 2 line carries `SOP_STAGE2_WAVES` verbatim in place of the old *Wave table approved in `spec-workshop`* text (the earlier Stage 2 sentences unchanged); that text says a passing comparison dispatches without a stop with an `整合者` row starting `自動：只改順序或分組` and a failing one halts for human approval; the file's set of backtick-quoted gate error codes is unchanged; the added text names no repo-only path and no bare ticket id; the file's line count is unchanged.
  proof: `node --test test/e443a-integrator-sop.test.mjs` passes.
- **A1-9** — Given a batch-eligible fixture (manifest, ticket files in a temporary primary), when `render <manifest> <lane> --batch …` runs, then it exits 0, the prompt ends with `BATCH_CLOSING_LINE` followed by one newline, and does not contain `需要我核准的事，等我在這裡親手打字。`.
  proof: `node --test test/e443a-batch-render.test.mjs` (A1-9 tests) passes.
- **A1-10** — Given a lane of two tickets whose ticket files have titles and scenarios (one with an `## Added during build` scenario), when `render --batch` runs with no `--summary` and no `--reading`, then the first line's `（…）` holds the two titles joined by `；`, and the reading line holds `<file>的 ## Scenarios（<ids>）` for each ticket joined by ` + `. Given a lane ticket with no ticket file, then render exits 2 and stderr names it with `TICKET_FILE_ABSENT`; `--batch` with `--summary` exits 2 with `USAGE`.
  proof: `node --test test/e443a-batch-render.test.mjs` (A1-10 tests) passes.
- **A1-11** — Given batch use, when `render --batch` runs, then the line after the reading line is `BATCH_FIRST_STEP_LINE` with `<worktree>` and `<branch>` filled, and the prompt contains neither `feature start` nor `EnterWorktree`; with `laneProtocolAddendum` set in the temporary primary, the two-layer pointer still appears.
  proof: `node --test test/e443a-batch-render.test.mjs` (A1-11 tests) passes.
- **A1-12** — Given the existing arguments with no `--batch`, when `render` runs, then the output is byte-identical to the output before this ticket.
  proof: `node --test test/e177a-manifest.test.mjs test/e289-render-addendum.test.mjs test/e343-render-pointer-guard.test.mjs test/render-structure.test.mjs test/e376-render-omits-tier.test.mjs test/e235b-relative-worktree.test.mjs test/e248-relative-mailbox-header.test.mjs test/e294-lane-enterworktree.test.mjs` passes, and `git diff --exit-code <dispatch base> -- test/fixtures/e177a/render-e177a.golden.txt test/e289-render-addendum.test.mjs test/e343-render-pointer-guard.test.mjs test/render-structure.test.mjs test/e376-render-omits-tier.test.mjs test/e235b-relative-worktree.test.mjs test/e248-relative-mailbox-header.test.mjs test/e294-lane-enterworktree.test.mjs` exits 0 (`<dispatch base>` = `.current/e443a/base-sha`).

## Copy / Strings

`content/**` ships to adopters: the SOP strings below name no repo-only path, no bare ticket id and no backtick-quoted gate error code.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| SOP_STAGE1_WAVES | block `SOP_STAGE1_WAVES` below — appended to the end of Stage 1 step 6's line after one space (same line, no new line) | ticket-cut NEW-1 scope 4 (Stage 1) + scope 2; authored-here wording. On step 6's line, not a new step, so the file's line count and line numbers stay put (probe: a new line turns `test/e430-mailbox-outside-lane.test.mjs` and `test/e410-task-alias-content-tail.test.mjs` red) |
| SOP_STAGE2_WAVES | block `SOP_STAGE2_WAVES` below — replaces the Stage 2 line's text from `**Wave table approved in `spec-workshop`** — ` to the end of that line; the earlier Stage 2 sentences stay | ticket-cut NEW-1 scope 4 (Stage 2, ruling 16) + fan-out plan Decisions (Q4 ruling: the row is listed in the final report next to the batch summary; batch summary script unchanged); authored-here wording |
| BATCH_FIRST_STEP_LINE | block `BATCH_FIRST_STEP_LINE` below | ticket-cut NEW-1 scope 5 (proposed text, adopted verbatim); `<worktree>` / `<branch>` are filled by render's single substitution pass |
| BATCH_CLOSING_LINE | block `BATCH_CLOSING_LINE` below | ticket-cut NEW-1 scope 5 (proposed text, adopted verbatim) |
| WAVES_REASON_LINE | `自動：只改順序或分組 — 票組與核准的波次表相同（<n> 張票），核准的 <d> 條相依都保留，每條 lane 的擁有檔都在其票的允許路徑內` | ticket-cut NEW-1 scope 3/4 (prefix `自動：只改順序或分組 — ` from scope 4); reason wording authored-here |
| WAVES_OK_LINE | `fanout waves: ok — <n> ticket(s) in <m> lane(s), <d> approved dependency(ies) kept` | authored-here — mirrors `fanout: ok — …` of validate |
| WAVES_FAIL_SUMMARY | `fanout waves: <k> broken condition(s) — halt for human approval` | authored-here — mirrors the `fanout check --cut:` summary line |
| waves FAIL lines | the five `FAIL  …` shapes in I4 | authored-here — `FAIL  <CODE>: <message>` shape of `check --cut` |
| waves / render input errors | the messages of `WAVES_COLUMN_ABSENT`, `WAVE_TABLE_*`, `TICKET_FILE_*`, `TICKET_CELL_EMPTY`, `TEMPLATE_BATCH_LINE_ABSENT` and the two `USAGE` messages in I2–I4 | authored-here — `fanout: error: <CODE>: <message>` shape of every fanout input error |
| row errors | the messages of `WAVE_NOT_INTEGER`, `DEPS_NOT_LANE_LIST`, `DEPS_SELF`, `DEPS_LANE_UNKNOWN`, `DEPS_LATER_WAVE`: `波次 cell is "<v>" — must be a positive integer`; `相依 cell "<cell>" is not 無 or a comma-separated list of lane names — notes go in 範圍切線`; `相依 cell names the lane itself`; `相依 cell names "<x>", which is not a lane of a Lanes table with 波次 in this manifest`; `相依 cell names "<x>", which is in a later wave (<wx> > <w>)` | authored-here — each names the lane (row-error prefix) and the cell |
| usage lines | block `USAGE_LINES` below; the same two lines go in the `scripts/fanout.mjs` header comment, which keeps its `handoff [--check] <manifest>` and `--closing` text | authored-here |

Verbatim blocks (each block's content is exactly one line; no trailing space):

`SOP_STAGE1_WAVES`

```text
**Wave and dependency columns**: when the tickets come with an approved wave table (`| wave | ticket | depends on |`), add the optional `波次` column to the Lanes table, right after `相依`, and fill both columns from that table. `波次` is the lane's wave, a positive integer; a lane holding tickets of several waves takes the latest of them. `相依` is `無` or the comma-separated names of the lanes whose tickets this lane's tickets depend on, each in the same or an earlier wave; a dependency between two tickets of one lane is kept by listing the depended-on ticket first in the `票` cell. Notes go in `範圍切線`, never in `相依`: while the `波次` column is present, `validate` refuses any other `相依` value.
```

`SOP_STAGE2_WAVES`

```text
**Wave table approved in `spec-workshop`** — a stated exception to Constitution §3.1's rule that only a directly witnessed approval counts. When the manifest was built from a committed `spec-workshop` wave table and carries the `波次` column, run `node <agc install>/scripts/fanout.mjs waves <manifest> <wave-table file>`. It compares the manifest with the approved wave table and the lanes' ticket files, and passes only when the manifest holds exactly the approved tickets, each in one lane; keeps every approved dependency (it may add dependencies: a later wave, an extra `相依` entry, or two tickets in one lane with the depended-on one listed first); and every owned path of a lane is inside its tickets' allowed paths. On a pass (exit 0), Stage 2 does not halt: write two Decisions rows, `人類` (`出處` = the wave-table file and its commit sha) and `整合者`, whose `內容` is the reason line the command printed, starting `自動：只改順序或分組 — `; list that `整合者` row in your final report next to the batch summary. On a failure (non-zero exit), on a manifest without the `波次` column, or with any open choice, halt here as above and name each condition the command reported.
```

`BATCH_FIRST_STEP_LINE`

```text
worktree 已建好，這個 session 就開在裡面；先用兩次各自獨立的 Bash 呼叫跑 `pwd` 與 `git branch --show-current`，確認前者是 <worktree>、後者是 <branch>，不符就停下來回報。
```

`BATCH_CLOSING_LINE`

```text
需要人類裁定的事一律停票：照 lane 規則的「批次 lane」把問題寫進票檔的 `## Open question`、回報整合者，不等打字核准。
```

`USAGE_LINES` (the render line replaces the current render line; the waves line goes right after the `check --cut` line)

```text
       node scripts/fanout.mjs render <manifest> <lane> (--summary <text> --reading <text>... | --batch) [--mailbox-root <dir>] [--primary <path>] [--base <sha>]
       node scripts/fanout.mjs waves <manifest> <wave-table> [--primary <path>]
```

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Tasks

- [ ] T-E443A-01 [P0] qa-engineer: write `test/e443a-wave-columns.test.mjs` (A1-1..A1-3), `test/e443a-wave-compare.test.mjs` (A1-4..A1-7), `test/e443a-integrator-sop.test.mjs` (A1-8), `test/e443a-batch-render.test.mjs` (A1-9..A1-11) and fixtures under `test/fixtures/e443a/`; record `qa_reports/validate-baseline_e443a-manifest-waves.txt` at base; re-pin the four owned tests the change turns red (Test impact); write `qa_reports/expected-red_e443a-manifest-waves.txt` | depends_on: none
- [ ] T-E443A-02 [P0] sr-engineer: `波次` column and restricted `相依` checks in `tools/fanout-manifest.ts` (I1: header shapes, approval by position, `wave`/`depLanes`, five row errors) + build (A1-1, A1-2, A1-3) | depends_on: T-E443A-01
- [ ] T-E443A-03 [P0] sr-engineer: ticket-id splitter, ticket-file lookup and `render --batch` in `tools/fanout-manifest.ts` (I2, I3: derived batch template, title/reading from ticket files, `--batch` parsing, usage line) + build; hand-started render untouched (A1-9, A1-10, A1-11, A1-12) | depends_on: T-E443A-01
- [ ] T-E443A-04 [P0] sr-engineer: `waves` comparison in new `tools/fanout-waves.ts` + route and header comment in `scripts/fanout.mjs` + usage line (I4: wave-table parse, three conditions, outputs, exit codes) + build (A1-4, A1-5, A1-6, A1-7) | depends_on: T-E443A-02, T-E443A-03
- [ ] T-E443A-05 [P1] sr-engineer: integrator SOP text in `content/skill-integrator.md` — `SOP_STAGE1_WAVES` and `SOP_STAGE2_WAVES` verbatim (A1-8) | depends_on: T-E443A-01

Size: T-02 ≈ 2 source files' worth (one `.ts` + its regenerated `dist/`), ~120 lines; T-03 ≈ same file, ~150 lines; T-04 = one new `.ts` (~250 lines) + `scripts/fanout.mjs` (~6 lines) + one usage line; T-05 = one content file, 2 lines. Each is within the `task_size` budget (≤ 5 source files / 300 lines; `dist/` is build output). Release bookkeeping (version, CHANGELOG, backlog done-mark) is not cut onto any task: the integrator and release-engineer own it.

## Test impact (PM probe)

Method: literal and regex grep of `test/` for readers of `content/skill-integrator.md` Stage 1 / Stage 2, of the Lanes-table parser and of render / USAGE / source text of `tools/fanout-manifest.ts` and `scripts/fanout.mjs`; then a **real run** of every `skill-integrator.md` reader (29 files) and every test that globs `content/` (16 files) on a copy of the base tree with `SOP_STAGE1_WAVES` / `SOP_STAGE2_WAVES` applied verbatim, against the same copy unmodified. The code change cannot be run before it exists; its readers are classified by reading the assertions. Base full suite: see the Dependencies section.

(a) already in the lane's 擁有 column — will need a re-pin (qa, T-E443A-01):
- `test/e423-spec-workshop.test.mjs` — real-run red: AC12 pins the old Stage 2 exception text (`converted from a committed …`, `the conversion changed nothing`, `Any change … halts here as above.`). Re-pin to `SOP_STAGE2_WAVES`; keep its other assertions (earlier Stage 2 sentences, no `relax`/ticket id).
- `test/e428-tracker-mirror.test.mjs` — real-run red: AC6 and AC12 compare a sha256 of `skill-integrator.md` minus its Copy with the frozen cut base. Re-pin that base hash to the file with this spec's two strings applied.
- `test/e292-integrator-sop.test.mjs` — real-run red: AC-E292-9 asserts Stage 1 step 6 *ends with* its copy. Re-pin so step 6 ends with that copy followed by `SOP_STAGE1_WAVES`.
- `test/e296-manifest-tier.test.mjs` — by reading: AC12 asserts five `       node scripts/fanout.mjs` usage continuation lines; the `waves` line makes six. Re-pin 5 → 6 (its 9th-header provisional and render-ignores-approval assertions stay green by I1).

(a) in 擁有, real-run green with the SOP text, no re-pin expected: `test/e178a-integrator-role.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e453-served-text-v5.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/e447-served-text.test.mjs`, `test/e329-integrator-sop-followups.test.mjs`, `test/e288-integrator-stage0.test.mjs`, `test/e349-integrator-repo-facts.test.mjs`, `test/e410-task-alias-content-tail.test.mjs`, `test/e246-mailbox-teardown.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e425-stop-ticket-batch.test.mjs`. Lanes-table parse readers in 擁有 — `test/e177a-manifest.test.mjs`, `test/e177a-check-cli.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e283-validate-handoff.test.mjs`, `test/e284-fanout-handoff.test.mjs`, `test/e292-external-deps-validate.test.mjs`, `test/e316-cut-heading-variants.test.mjs`, `test/e322-owners.test.mjs`, `test/e337-subitem-order.test.mjs`, `test/e338-backtick-glob.test.mjs`, `test/e381-owned-clause-tokens.test.mjs`, `test/e390-check-recorded-base.test.mjs`, `test/e447-cut-reseed.test.mjs`, `test/e447-mode-off.test.mjs` — must stay green unmodified (A1-3: no 8/9-column byte changes); a red one there is an A1-3 defect, not a re-pin. Source-text readers in 擁有 that sr must keep green: `test/e178a-integrator-role.test.mjs` and `test/e433-test-first-rules.test.mjs` (the `PROMPT_TEMPLATE_3B` provenance doc comment), `test/e316-cut-heading-variants.test.mjs` (`parseCutSection` comment), `test/e337-subitem-order.test.mjs` (`HANDOFF_SUBITEMS` comment).

(b) newly found, outside 擁有 — none needs a re-pin, so no ownership request. Two read this lane's files and must stay green unmodified; listed for the integrator's cut pre-review:
- `test/e285-integrator-session-handoff.test.mjs` reads the `scripts/fanout.mjs` source for `handoff [--check] <manifest>` and `--closing` — the header comment keeps both (Copy / Strings, usage lines).
- `test/e430-mailbox-outside-lane.test.mjs` pins `skill-integrator.md`'s line count (269); `test/e410-task-alias-content-tail.test.mjs` (in 擁有) pins its line count and a line number. The probe showed a new Stage 1 line turns both red, which is why `SOP_STAGE1_WAVES` sits on step 6's line; with that placement both are real-run green.
- The other skill-integrator readers outside 擁有 (`test/e226-integrator-sop-portable.test.mjs`, `e262`, `e286`, `e295`, `e297`, `e336`, `e355`, `e393`, `e407`, `e416`, `e438`) and the 16 `content/` globbers (incl. `test/error-code-contract.test.mjs`, `test/context-budget.test.mjs`, `test/compose-equivalence.test.mjs`) were real-run unchanged by the SOP text (`e295` and `release-staging` fail one test each in the copy both before and after the edit: the copy has no git metadata).

(c) in the 禁止 column — must stay green **unmodified** (A1-12): `test/fixtures/e177a/render-e177a.golden.txt`, `test/e289-render-addendum.test.mjs`, `test/e343-render-pointer-guard.test.mjs` (also: no `--template` string may appear in `tools/fanout-manifest.ts`), `test/render-structure.test.mjs`, `test/e376-render-omits-tier.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e248-relative-mailbox-header.test.mjs`, `test/e294-lane-enterworktree.test.mjs`. None is expected red: `--batch` is opt-in and the hand-started template is untouched. No design problem found.

## Hop estimate

pm → qa-engineer → sr-engineer (T-02..T-05, one or two sessions) → code-reviewer: 4–5 hops nominal; 7 with one code-reviewer FAIL round; 9 worst case (sr split into two sessions plus one fix round). Within the hop cap (14); the lane starts at hop 1.

## Gate Summary

| gate | result |
|---|---|
| architect hop | **not needed** — one existing module extended, one small new module beside it (`tools/fanout-waves.ts`, same family, no new data model, no cross-cutting API, no server/gate change); interface fixed in this spec |
| schema change | none (no handoff / tasks / SQLite / config schema change; `ticketDir` is read through the existing loader) |
| design-armed | none (no `design/` file; every `design-link` is `—`) |
| external refs | none — the inputs are repository files only (no URL, design-tool, tracker or `see <ticket>` reference outside the repo); `external_refs` left empty |
| scope decision | `single-feature` — one ticket, one lane, one spec; the four sr tasks share `tools/fanout-manifest.ts` and are cut serially |
| Visual / geometric split | not applicable (no visual surface) |
| cut approval | lane `approval` = `human`: the cut is presented to the human in the lane session after the integrator's mailbox pre-review; PM does not set `cut_approved` |

## Out of Scope

- The launcher, session start, the parallel-limit config key, launch state, dependency-met evaluation (next ticket).
- `docs/lane-protocol.md`, `docs/config.md`, `content/coord-03-core-fallback.md`, any other `content/**` file, compose goldens, `test/context-budget.test.mjs`.
- Integrator Stage 3 render text (`--batch` is used by the launcher, next ticket).
- Migrating existing `specs/fanout-*.md`; a format check of the `票` cell.
- `scripts/batch-summary.mjs` and the stop rule (cut-file Q4 ruling: the integrator lists the automatic Decisions row in its final report).
- Any server, gate, error-code or `GATE_REGISTRY` (33) / pipeline (17 steps) change.
- `PROMPT_TEMPLATE_3B`'s hand-started bytes and the E177a render golden.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark).

## Dependencies / Prerequisites

- Done: ticket files (`tools/ticket-file.ts`, `resolveTicketDir`), batch-lane rules (`docs/lane-protocol.md` §3 *批次 lane*); depends on no other lane.
- Base: `.current/e443a/base-sha` (990084f). Base full suite (`node scripts/test-lock.mjs -- npm test` in the lane worktree): 4842/4844 pass, 0 fail, 2 skipped (exit 0).
- Interface decisions taken at this cut (the cut file left them to the cut): `波次` after `相依`; `--batch` without a value and refusing `--summary` / `--reading`; `waves` as its own subcommand in its own module; lookup by `id` over the ticket directory's top-level `*.md`; exit codes 0/1/2; the message shapes above. None changes a human ruling.
- `CLAUDE.md` is not touched: its `tools/fanout-*.ts` Layout glob row covers `tools/fanout-waves.ts` (`test/e395-claude-md-tail.test.mjs` AC-E395-5 accepts the glob).
- `node scripts/fanout.mjs check --cut specs/fanout-post-v5-w7.md e443a specs/e443a-manifest-waves.md` at cut time: exit 1 — 1 ticket, 18 tokens, 0 out of bounds; the only FAIL is `APPROVAL_HUMAN` (the lane's `approval` cell is `human`, so the cut goes to the human after pre-review).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E443a | Fan-out manifest waves and batch render: `波次` column (after `相依`) and restricted `相依` checked by `validate`; `fanout.mjs waves <manifest> <wave-table>` comparison (same ticket set, approved dependencies kept, owned paths inside allowed paths; exit 0 prints the Decisions reason line, exit 1 names each broken condition) and its Stage 1 / Stage 2 integrator SOP text; `render --batch` (confirm-worktree first step, stop-the-ticket closing line, summary and reading list from the ticket files); hand-started render byte-identical | none | 4 source (`tools/fanout-manifest.ts`, `tools/fanout-waves.ts`, `scripts/fanout.mjs`, `content/skill-integrator.md`) + 8 `dist/` outputs + 4 re-pinned tests + new tests and fixtures | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.js`、`dist/tools/fanout-manifest.js.map`、`dist/tools/fanout-manifest.d.ts`、`dist/tools/fanout-manifest.d.ts.map`、`tools/fanout-waves.ts`、`dist/tools/fanout-waves.js`、`dist/tools/fanout-waves.js.map`、`dist/tools/fanout-waves.d.ts`、`dist/tools/fanout-waves.d.ts.map`、`scripts/fanout.mjs`、`content/skill-integrator.md`、`test/e443a-*.test.mjs`、`test/fixtures/e443a/**`、`test/e423-spec-workshop.test.mjs`、`test/e428-tracker-mirror.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e296-manifest-tier.test.mjs` | — |

## Open Questions

None needing a human ruling. For the integrator's cut pre-review: `test/e430-mailbox-outside-lane.test.mjs` and `test/e285-integrator-session-handoff.test.mjs` read this lane's files but are outside 擁有; both are expected to stay green unmodified (see Test impact (b)), so no re-assignment is requested.

manifest-tier: no option choice, no needs-human-ruling item
