# e177a-fanout-manifest

Ticket: **E177a** (split from E177, human decision D1 2026-09-27, `specs/fanout-wave7.md`). Lane `e177a`, branch `feat/e177a-fanout-manifest`, base `98052c6`.
Deliverables (1) manifest format, (2) dispatch-prompt renderer, (3) fan-in ownership check, (6) `## Decisions` section. Deliverables (8)(9)(11) and the mailbox watcher are E177b. `agc feature start` reading a manifest row is E177c, moved to after v4.

## Problem Statement
The integrator writes each wave's fan-out manifest (`specs/fanout-<wave>.md`) by hand. It then writes every lane's dispatch prompt by hand from the integrator SOP §3b template, and at fan-in it re-derives each lane's ownership from memory against `git diff --stat`. Nothing reads the manifest mechanically. The prompts can drift from the table, and out-of-bounds files are caught only if a person happens to notice them. The Wave 7 DoD row "lane 清單可用：派工 prompt 由清單渲染、越界被機器標出" requires three things: a defined manifest format, a renderer that builds a lane's prompt from its row, and a checker that lists every out-of-bounds file of a lane branch. The manifest's `## Decisions` log also needs a checkable format. Older manifests (Wave 6, Wave 5.1) predate some of these sections. The tool must say exactly which part it cannot read and must never infer the missing part.

## User Stories
- As the integrator, I want `node scripts/fanout.mjs render <manifest> <lane>` to print a lane's dispatch prompt from its manifest row, so that prompts can no longer drift from the table and the common rules stay only in `docs/lane-protocol.md`.
- As the integrator, I want `node scripts/fanout.mjs check <manifest> <lane>` to list every file the lane branch changed outside its owned set and exit non-zero, so that fan-in boundary verification (integrator SOP 5a "越界") is mechanical.
- As the integrator, I want `node scripts/fanout.mjs validate <manifest>` to parse the whole manifest, including the `## Decisions` table, and report every format error, so that a malformed manifest fails before any prompt goes out.
- As a future E178 author, I want one documented manifest format with one parser, so that the formal integrator SOP can cite the tool instead of restating the format.

## Manifest format (normative; `specs/fanout-wave7.md` is the baseline)

Parsing is line-based markdown. A **section** is a line starting `## ` together with the lines up to the next `## ` or `# ` line. A section is identified by **prefix**, so `## Lanes（7.1，並行；假設 D1=A）` is a `Lanes` section. A **table** is the first run of lines starting with `|` inside a section. Cells are split on `|` that is not escaped as `\|`, and each cell is trimmed.

| element | rule | required by |
|---|---|---|
| title | First line matching `^# Fan-out: (.+)$`. Group 1 is `<plan>`. | render, validate |
| `base:` | First line matching `^base:\s*([0-9a-f]{7,40})\b`. Group 1 is `<base>`. Any trailing text (wave7 `（main = …）`, wave5.1 `(to be re-stamped …)`) is ignored. | render, validate |
| `mailbox:` (NEW, optional) | Line matching `^mailbox:\s*(\S+)`. Gives the mailbox root (the directory that holds `<lane>/to-integrator.md`). The value may be primary-relative (e.g. `../<lanes-dir>/_mailbox`) and is resolved against primary; an absolute value is taken byte-for-byte, and `validate` WARNs on it (line number only, no path); a value starting with `~` fails render with `MAILBOX_TILDE` (E248). | render (if no `--mailbox-root`); validate (absolute-value WARN only) |
| `## Lanes…` sections | One or more. A table whose header row is **exactly** `lane \| 票 \| branch \| worktree \| 擁有 \| 禁止 \| 範圍切線 \| 相依`, in that order, is a **dispatchable** table. A table whose first header cell is `lane` but whose header differs in any other way is a **provisional** table: its rows are indexed by lane id only and are never rendered or checked. A table whose first header cell is not `lane` is an error. A lane id may appear only once across all Lanes sections. | all |
| dispatchable row | Exactly 8 cells. `lane` is non-empty and matches `^[A-Za-z0-9_.-]+$`. `branch` is non-empty. `擁有` yields at least 1 path token (below) and has no unquoted path. `範圍切線` contains both `做：` and `不做：` (a full-width or ASCII colon both count). | all |
| path token | A backtick span in `擁有`/`禁止` whose trimmed content matches `^[A-Za-z0-9_.\-*/{},]+$`, does not start with `:` or `-`, and contains `/` or ends in `\.[A-Za-z0-9]+`. Every other backtick span, such as `closedLanePointerLine`, `:1727`, `sr-engineer=fable` or `git show …`, is prose and is ignored. Line/field restrictions written in prose (e.g. `（只限 …）`) are **not** machine-checked, and `check` says so. | check, validate |
| unquoted path | In `擁有` only, after backtick spans are removed: a word (split on whitespace, `,`, `、`, `，`, `；`, `;`, `（`, `）`, `(`, `)`) that matches `^[A-Za-z0-9_.\-]*/[A-Za-z0-9_.\-*/{}]*$` and contains an ASCII letter is an error. Owned paths must be backtick-quoted, and the tool never guesses at bare text. | check, validate |
| `## Dispatch pins…` | Bullets of the form `- <lane>[、,<lane>…]：<text>` (a full-width or ASCII colon). A bullet's pins are the backtick spans matching `^([a-z-]+)=(\S+)$`, and the role must be one of the 8 `dispatch_pins` roles. A bullet with zero pins must contain `無 pin` or `none`, which means explicitly none. Each dispatchable lane appears in exactly one bullet. A lane named in a bullet must exist in some Lanes table. | render, validate |
| `## Decisions…` | Exactly one section. Its table header is **exactly** `日期 \| 裁決者 \| 內容 \| 出處`. For each row: `日期` is a real calendar date `YYYY-MM-DD`; `裁決者` ∈ {`人類`, `整合者`}; `內容` and `出處` are non-empty. Zero data rows is valid. | validate |

**Two `## Lanes` headings (wave7).** Every section is parsed. The 7.1 table is dispatchable. The 7.2 table (`lane | 票 | branch | 擁有（暫定） | 範圍 | 相依`) is provisional. `render`/`check` on `e130` or `e178` fails with `LANE_PROVISIONAL`, and the message names the missing columns (`worktree`, `擁有`, `禁止`, `範圍切線`; the `擁有（暫定）` column does not count as `擁有`). The fix is the step Wave 6 already set as precedent: redo the pre-dispatch premise check and promote the row into an 8-column table. The tool never maps `擁有（暫定）`→`擁有` or `範圍`→`範圍切線` by guessing.

**Implicit lane bookkeeping** (always in bounds for `check`, printed in its output): `.current/<lane>/**`; `specs/<lane>-*.md`; any file under `qa_reports/` or `review_reports/` whose basename contains `<lane>` (case-insensitive). Examples are `review_T-E177A-01.md` and `expected-red_e177a-fanout-manifest.txt`. Nothing else is implicit, so `dist/**` must be owned explicitly.

**Glob semantics:** paths are repo-relative with `/` separators. `**` matches zero or more whole segments. `*` matches within one segment. `{a,b}` is alternation. A token ending in `/` means `<token>**`. A token with no glob characters is an exact path. A token without `/` (e.g. `package.json`) is repo-root-relative. The sr-engineer picks the implementation, but it adds no npm dependency and does not use the experimental `path.matchesGlob`.

## Render field sources (3b template)
Template text is `.claude/commands/integrator.md` §3b at base `98052c6`, copied into `tools/fanout-manifest.ts` as one constant, with a source comment naming `.claude/commands/integrator.md @98052c6` §3b (integrator pre-review to-lane#1 clarification 3; E178 will collapse to one copy). Common rules stay in `docs/lane-protocol.md`, and the prompt only points at that file.

| 3b placeholder | source | when absent |
|---|---|---|
| `<計劃或 feature>` | title (`# Fan-out: …`) | `MANIFEST_TITLE_ABSENT` |
| `<lane>`, `<票>`, `<branch>`, `<worktree>`, `<擁有>`, `<禁止>` | the row's cells, **byte-verbatim** — including prose such as `（只限 …）`. Never rebuilt from the parsed path-token set; that set is for `check` only (integrator pre-review to-lane#1 clarification 2) | row-level errors above |
| 做／不做 | the row's `範圍切線` cell, verbatim (it already carries `做：…不做：…`) | `SCOPE_CUT_MARKERS_ABSENT` |
| `<一句話>` | CLI `--summary "<text>"` (required) | `SUMMARY_ABSENT` |
| `<計劃的必讀章節> + <票面 row>` | CLI `--reading "<text>"`, repeatable, joined with ` + ` (at least 1) | `READING_ABSENT` |
| `primary` | CLI `--primary <path>`; else the first `worktree` entry of `git worktree list --porcelain` run in the repo that holds the manifest (git guarantees the main worktree is listed first) | `PRIMARY_NOT_FOUND` (not inside a git repo) |
| `base` | CLI `--base <sha>` (override — integrator pre-review to-lane#1 Q1: a pre-dispatch manifest commit cannot record its own sha); else manifest `base:` line. Never inferred from git. | `BASE_ABSENT` |
| `ticket-slug` | `branch` with the `feat/` prefix removed (same convention as `agc feature start <ticket-slug>` → `feat/<ticket-slug>`) | `BRANCH_NOT_FEAT` |
| `信箱` | CLI `--mailbox-root <dir>` (wins; taken byte-for-byte, never resolved); else manifest `mailbox:` line — a relative value resolved against primary, an absolute value byte-for-byte (E248). Rendered as `<root>/<lane>/`. | `MAILBOX_ROOT_ABSENT`; `MAILBOX_TILDE` (header starts with `~`). The root is never derived from the worktree path. |
| `dispatch pins` | `## Dispatch pins` bullet for the lane, rendered `role=tier[, role=tier]` or `無` | `PINS_SECTION_ABSENT` / `PINS_LANE_ABSENT` / `PINS_ROLE_UNKNOWN` |

## Acceptance Criteria
Fixtures: `test/fixtures/e177a/fanout-wave7.md`, `fanout-wave6.md` and `fanout-wave5.1.md` are byte copies of the tracked specs at base `98052c6`. Any other fixture is synthetic. `$F` = `test/fixtures/e177a`. `$T` = the new `test/e177a-*.test.mjs` files.

- **AC1 (format: wave7 parses)**: Given `$F/fanout-wave7.md`, when `parseManifest` runs, then it returns title `v4.0.0 Wave 7（翻開關）` and base `3f648bd`. It returns dispatchable lanes `e204, e180, e177a, e177b` in table order and provisional lanes `e130, e178`. `e177a`'s owned tokens include `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, `dist/**`, `test/e177a-*.test.mjs`, `test/fixtures/e177a/**` and `.current/e177a/`. They exclude the prose spans `closedLanePointerLine` (e180) and `:1727`.
  proof: `node --test test/e177a-*.test.mjs` — test "AC1 wave7 parses".
- **AC2 (validate: wave7 is clean)**: Given `$F/fanout-wave7.md`, when `node scripts/fanout.mjs validate $F/fanout-wave7.md` runs, then it prints `fanout: ok — 4 dispatchable lane(s), 2 provisional, 5 decision(s)` and exits 0.
  proof: test "AC2 validate wave7 exit 0".
- **AC3 (two Lanes headings, explicit)**: Given wave7, when `render` or `check` targets `e130`, then it exits 2 with a `LANE_PROVISIONAL` error that names the section heading `## Lanes（7.2，序列，暫定 —— 派工前重新核對）` and the missing columns `worktree, 擁有, 禁止, 範圍切線`. Stdout stays empty.
  proof: test "AC3 provisional lane refused".
- **AC4 (old formats fail loudly, never guessed)**: Given `$F/fanout-wave6.md` and `$F/fanout-wave5.1.md`, when `validate` runs, then each exits 2 and reports `DECISIONS_SECTION_ABSENT`. For wave6 the message adds the hint that a `## 人類裁決` heading was found but is not the `## Decisions` format. When `render` runs on `e125a` (wave6) or `e179` (wave5.1) with every CLI flag supplied, then it exits 2 with `PINS_SECTION_ABSENT` and prints no prompt. When `check` runs on those lanes against a synthetic repo, their 8-column rows are read. That behaviour is documented, and the check is not refused.
  proof: test "AC4 legacy manifests fail loudly".
- **AC5 (malformed input is loud)**: Given synthetic manifests, then each of these exits 2 with its code and never falls back to a default: a Lanes table whose first header cell is not `lane` (`LANES_HEADER_UNKNOWN`); a duplicate lane id across sections (`LANE_DUPLICATE`); a dispatchable row with ≠8 cells (`ROW_CELL_COUNT`); an `擁有` cell with a bare `templates/**` (`OWNED_UNQUOTED_PATH`, which quotes the word); an `擁有` cell with no path token (`OWNED_EMPTY`); an unknown lane (`LANE_NOT_FOUND`); no Lanes section (`LANES_SECTION_ABSENT`). `validate` reports **all** errors in one run, one line each.
  proof: test "AC5 malformed manifests".
- **AC6 (render: prompt from row + 3b)**: Given wave7 and `render $F/fanout-wave7.md e177a --summary S --reading R1 --reading R2 --mailbox-root /m --primary /p`, then stdout is the 3b template with: `primary: /p    base: 3f648bd    ticket-slug: e177a-fanout-manifest`; `branch: feat/e177a-fanout-manifest    worktree: <lanes-root>/e177a    lane: e177a`; `信箱: /m/e177a/`; `dispatch pins: sr-engineer=fable`. The 擁有, 禁止 and 範圍切線 cells appear verbatim, and `再讀 R1 + R2`. Exit is 0. For `e204` the pins line reads `dispatch pins: 無`.
  proof: test "AC6 render e177a" (exact-string golden in `$F/`).
- **AC7 (render: common rules pointed at, not copied)**: Given the AC6 output, then it contains `docs/lane-protocol.md` and none of the non-blank lines of `docs/lane-protocol.md` longer than 20 characters.
  proof: test "AC7 no lane-protocol text in prompt".
- **AC8 (render: every non-row field has a stated source)**: Given wave7 `e177a` with exactly one input missing each time, then exit is 2 and no prompt is printed. The missing inputs and codes are `--summary` (`SUMMARY_ABSENT`), `--reading` (`READING_ABSENT`), both mailbox sources (`MAILBOX_ROOT_ABSENT`), a manifest without a `base:` line (`BASE_ABSENT`), and a row branch `wip/x` (`BRANCH_NOT_FEAT`). A manifest `mailbox: /hdr` line with no flag renders `信箱: /hdr/e177a/`, and `--mailbox-root` wins over the header. With `--primary` omitted inside a git repo, primary is that repo's first `git worktree list --porcelain` entry. `--base 98052c6` renders `base: 98052c6` and wins over the manifest `base:` line; without it the manifest value (`3f648bd`) is rendered. The rendered 擁有 cell for `e180` contains the text ``（只限 `finish --abandoned` 路徑`` byte-for-byte (verbatim cell, not the parsed set).
  proof: test "AC8 render field sources".
- **AC9 (check: in bounds)**: Given a temp git repo whose branch `feat/e177a-fanout-manifest` changed only `tools/fanout-manifest.ts`, `dist/tools/fanout-manifest.js`, `.current/e177a/tasks.md`, `specs/e177a-fanout-manifest.md` and `qa_reports/review_T-E177A-01.md` versus `main`, when `check $F/fanout-wave7.md e177a --repo <tmp>` runs, then it prints the owned globs, the implicit bookkeeping globs, `fanout check: e177a — 5 file(s) changed, 0 out of bounds` and the E158 line, and exits 0.
  proof: test "AC9 check in bounds".
- **AC10 (check: every out-of-bounds file listed, non-zero)**: Given the same repo plus commits touching `bin/agc-init.mjs`, `docs/backlog.md`, `tools/lane-status.ts` and a rename of `tools/x.ts`→`tools/fanout-manifest.ts` (the old path is outside the owned set), when `check` runs, then each out-of-bounds path is printed on its own `OUT  <path>` line, in sorted order. The deleted rename source is included because the diff runs with `--no-renames`. A line that also matches a `禁止` token carries `  (禁止: <token>)`. The summary gives the count, and the exit code is 1.
  proof: test "AC10 check out of bounds".
- **AC11 (check: E158 explicit)**: Given any `check` run that reaches the diff, then stdout contains the exact line `note: only committed changes were checked (git diff --no-renames --name-only <base>...<branch>); uncommitted and untracked work in the worktree was NOT checked (E158).` with `<base>`/`<branch>` substituted, and also `note: prose restrictions inside 擁有 (e.g. （只限 …）) are not machine-checked.` The note prints on both exit 0 and exit 1.
  proof: test "AC11 E158 disclaimer".
- **AC12 (check: base + refs)**: Given `--base` omitted, then the base is `main`. Given `--base other`, then the diff uses `other...<branch>`. Given a branch or base that does not resolve (`git rev-parse --verify`), then exit is 2 with `REF_NOT_FOUND` naming the ref.
  proof: test "AC12 check base and refs".
- **AC13 (Decisions format)**: Given synthetic Decisions tables, then `validate` exits 2 in each of these cases: `日期` `2026-02-30` or `27/09/2026` (`DECISION_DATE_INVALID`); `裁決者` `coordinator` (`DECISION_DECIDER_UNKNOWN`); empty `內容` or `出處` (`DECISION_FIELD_EMPTY`); header `日期 | 誰 | 內容 | 出處` (`DECISIONS_HEADER_DIFFERS`); two `## Decisions` sections (`DECISIONS_SECTION_DUPLICATE`). A header-only table is valid (0 decisions). Each error names the row number.
  proof: test "AC13 decisions validation".
- **AC14 (Dispatch pins format)**: Given synthetic pins sections, then `validate` exits 2 in each of these cases: a dispatchable lane in no bullet (`PINS_LANE_ABSENT`); a lane in two bullets (`PINS_LANE_DUPLICATE`); `` `tester=fable` `` (`PINS_ROLE_UNKNOWN`); a bullet with neither a pin nor `無 pin`/`none` (`PINS_EMPTY_UNDECLARED`); a bullet naming a lane in no table (`PINS_LANE_UNKNOWN`).
  proof: test "AC14 pins validation".
- **AC15 (thin CLI, exit contract)**: Given `scripts/fanout.mjs`, then it only imports `../dist/tools/fanout-manifest.js`, routes `validate|render|check`, prints results and sets the exit code. Exit codes are 0 = ok/in bounds, 1 = out of bounds (check only), 2 = usage or any parse/input error. Errors go to stderr as `fanout: error: <CODE>: <message>`. No subcommand or an unknown one prints the usage block and exits 2.
  proof: test "AC15 CLI contract" + `grep -c "from \"../dist/tools/fanout-manifest.js\"" scripts/fanout.mjs` prints `1`.
- **AC16 (build + suite)**: Given the committed branch, when `npm run build && npm test` runs, then it is green. The pass/total is recorded in the QA report.
  proof: `npm test` summary line (run after commit on a clean tree, lane-protocol §3).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| prompt.template | the §3b block, from `開始做 <計劃或 feature>，你只負責 …` to `…等我在這裡親手打字。`, placeholders substituted per the Render field sources table | `.claude/commands/integrator.md` §3b @ 98052c6 |
| prompt.pins.none | `無` | authored-here — mirrors wave7's `無 pin` wording in the 3b `dispatch pins:` slot |
| err.format | `fanout: error: <CODE>: <message>` | authored-here — grep-able, one line per error |
| validate.ok | `fanout: ok — <n> dispatchable lane(s), <m> provisional, <k> decision(s)` | authored-here |
| check.summary | `fanout check: <lane> — <n> file(s) changed, <k> out of bounds` | authored-here |
| check.out | `OUT  <path>` / suffix `  (禁止: <token>)` | authored-here |
| check.owned | `owned (from 擁有): <glob>, …` | authored-here |
| check.implicit | `implicit lane bookkeeping: .current/<lane>/**, specs/<lane>-*.md, qa_reports\|review_reports/*<lane>* (case-insensitive)` | authored-here |
| check.note.e158 | `note: only committed changes were checked (git diff --no-renames --name-only <base>...<branch>); uncommitted and untracked work in the worktree was NOT checked (E158).` | authored-here — E158 (integrator SOP 5a 工作樹乾淨 row) |
| check.note.prose | `note: prose restrictions inside 擁有 (e.g. （只限 …）) are not machine-checked.` | authored-here |
| err.LANE_PROVISIONAL | `lane <lane> is in a provisional table (<heading>) missing column(s): <cols> — redo the pre-dispatch premise check and promote it to the 8-column Lanes table` | authored-here — Wave 6 6.1c/6.2 precedent |
| err.DECISIONS_SECTION_ABSENT.hint | ` (found "<heading>" — not the ## Decisions table format)` | authored-here — wave6 `## 人類裁決` |
| usage | `usage: node scripts/fanout.mjs validate <manifest>` / `render <manifest> <lane> --summary <text> --reading <text>... [--mailbox-root <dir>] [--primary <path>] [--base <sha>]` / `check <manifest> <lane> [--base main] [--repo <dir>]` | authored-here |

The remaining error codes (listed in the ACs) use `authored-here` messages that name the offending section, lane, row number or cell. The sr-engineer writes their wording, and each one must name the thing it could not read.

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Lane status, the cross-lane roll-up and the mailbox watcher (E177b). `agc feature start` reading the manifest (E177c, post-v4).
- Editing `.claude/commands/integrator.md`, `docs/lane-protocol.md`, or any existing `specs/fanout-*.md`. The integrator switches SOP 3b/5a to the tool after the merge, and E178 cites it.
- Checking uncommitted work (E158 is stated, not solved), and checking line-range or field-level ownership written as prose.
- Auto-converting legacy manifests, or treating `擁有（暫定）`/`範圍` as their 8-column equivalents.
- Validating that `worktree`/owned paths exist on disk (integrator SOP 3a is a human/integrator premise check).
- Known over-permission from prose backtick spans that are path-shaped (e.g. wave6 e125a `tasks.md` in "其他解析 `tasks.md` 路徑的…"). `check` prints the parsed owned set, so a reader can see it. Tightening this needs quoting discipline in future manifests, not guessing.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark) is release-engineer and integrator work after PASS.

## Dependencies / Prerequisites
- Base `98052c6`. Everything needed is on the base: `.claude/commands/integrator.md` §3b, and `specs/fanout-wave{7,6,5.1}.md` as the fixture sources.
- No architect hop: a single new module plus a thin script, no new data model, no cross-cutting API (PM SOP step 8 threshold).
- Dispatch pins: `sr-engineer=fable` (human D4, `specs/fanout-wave7.md` `## Dispatch pins`).
- Resource audit: the inputs hold no external references (no URLs, Figma or tickets outside this repo). `external_refs` is omitted.
- Mode: no-design (no `design/e177a-fanout-manifest.md`), so the Scope Decision is recorded as `single-feature`.
