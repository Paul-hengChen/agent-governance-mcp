# e283-fanout-handoff-and-ref-check

Lane `e283` of fan-out wave `specs/fanout-post-v4-w5.md` (post-v4 queue wave 5). Three tickets batched per the integrator manifest, all in the fan-out manifest tool: **E283** (P2), **E322** (P3), **E316** (P3). The scope cut is the manifest's e283 `範圍切線` cell (human-approved 2026-10-16); this spec writes it down and records the decisions the cell delegates to PM, it does not re-open it.

Function and line references were checked against the lane dispatch base (`dac6069`) at cut time.

## Problem Statement

**E283** — A fan-out manifest records its wave's state, but nothing checks that a closed manifest tells the next integrator session how to take over. Integrator revision §3.1 Q3 / §4 P2 (`docs/integrator-revision-2026-10-08.md`; design table in `docs/integrator-session-per-wave-2026-10-07.md` §5 P2) ruled that `fanout.mjs validate` must require a `## 接手步驟` section once a manifest is closed: four mandatory sub-items (核對 primary, 已結案, 待人類決定, 進行中的背景工作), 進行中的背景工作 must read 無, no machine-local absolute path in the section; 裝置 and 工具 stay optional. Manifests carry only a free-prose bold status line, so "closed" has no machine-readable form today.
**E322** — Mid-wave base-fix condition 2 (`content/skill-integrator.md` Stage 4 *Mid-wave base fix*) asks whether any path in `git diff --name-only <lane branch>...origin/<target>` is owned by any lane. `fanout.mjs check` answers the opposite question (one lane's branch against that lane's own owned set), so condition 2 is compared by hand.
**E316** — `parseCutSection` (`tools/fanout-manifest.ts`) reads only sections that `splitSections` starts (a line beginning with `## `) and whose name is exactly `Cut`. A Markdown renderer also shows `##<TAB>Cut`, 1–3 leading spaces, and lowercase `cut` as a Cut heading; when a valid `## Cut` exists too, the table under the variant is never read, so a touches cell naming a file outside the lane can still exit 0.

## User Stories

- As an integrator closing a wave, I want `validate` to fail when the closed manifest's `## 接手步驟` section is missing, incomplete, still lists background work, or leaks a local path, so that the next session can take over from the manifest alone.
- As an integrator with an older closed manifest, I want it to keep validating exactly as before, so that the new rule does not turn history red.
- As an integrator doing a mid-wave base fix, I want one command that takes a ref range or a path list and names every lane whose `擁有` cell owns any of those paths, so that condition 2 is mechanical.
- As a lane PM, I want `check --cut` to refuse a spec whose Cut table could be shadowed by a heading variant, so that every rendered Cut table is the one that was checked.

## Decisions (delegated to PM by the manifest)

### D1 — How "closed" is detected (E283)

Survey of the status line of all 22 `specs/fanout-*.md` at the dispatch base (the first line before the first `## ` heading that, with `**` removed, starts with `狀態：`):

| status text starts with | manifests |
|---|---|
| `結案 <date>` | post-v4-w2, post-v4-w3, post-v4-w4 |
| `人類核准 …；已結案 …` (closed, mid-line) | e235, e243-e248, e246-e259, e258, e260-followups, post-v4-w1 |
| `人類核准 …；… E260 結案` | e260 |
| `已合併` / `兩段皆已合併` | e233, e234, e250 |
| `人類核准 …` / `人類已核准 …` (open or never closed) | e229, feedback-leftovers, feedback-leftovers-wave2, post-v4-w5, wave6, wave7, wave7.2, wave7.2b |
| (no status line) | wave5.1 |

No status text starts with `已結案`. None of the 22 has a `## 接手步驟` section.

**Rule**: a manifest is **closed** iff its status line exists and its text, after `狀態：` (fullwidth or ASCII colon, optional spaces), **starts with `已結案`**. The status line is the first line before the first `## ` heading that, after removing every `**`, matches `^狀態[：:]`. Any other wording (`結案 …`, `已合併`, `…；已結案`) is not closed for this check.

### D2 — Exemption for manifests closed before this ticket (E283)

Exempt **by construction**, no allowlist and no date cutoff: since no existing manifest's status starts with `已結案`, every manifest closed before this ticket keeps its validate result. A date cutoff was rejected because wave 4 closed on 2026-10-16 and wave 5 may close the same day; a filename allowlist was rejected because it is repo-specific and adopter repos (whose manifests already carry free-form `接手步驟` sections) would not be covered.

**Consequence (needs integrator attention)**: the rule bites only when the closing integrator writes the canonical `**狀態：已結案 <date>。…**`. Wave 5 closes in 5c with `## 接手步驟` (manifest 完成定義 row); the integrator must use the canonical status wording there. Writing it into `content/skill-integrator.md` is out of scope (E285 / later ticket).

### D3 — Handoff section grammar (E283)

- Section: a `## ` section whose name is `接手步驟`, or starts with `接手步驟（` or `接手步驟(` (so `## 接手步驟（換 session 用）` counts). More than one → `HANDOFF_SECTION_DUPLICATE`.
- Sub-items: `### ` headings inside the section, matched by the same rule (exact name, or name followed by `（` / `(`): `核對 primary`, `已結案`, `待人類決定`, `進行中的背景工作` (mandatory); `裝置`, `工具` (optional). Other `### ` headings are ignored. A sub-item's body runs to the next `### ` or the end of the section.
- Each mandatory sub-item appears exactly once (`HANDOFF_SUBITEM_ABSENT`, `HANDOFF_SUBITEM_DUPLICATE`) and has at least one non-blank body line (`HANDOFF_SUBITEM_EMPTY`).
- 進行中的背景工作: exactly one non-blank body line, equal to `無` after removing one optional leading list marker (`- ` or `* `) and one optional trailing `。` (`HANDOFF_BACKGROUND_NOT_NONE`).
- Absolute path: every line of the section (heading included) is scanned for a token that starts at a boundary (line start, whitespace, or one of `` ` `` `'` `"` `(` `[` `（` `「` `：` `，` `、` `=`) and is (a) a Windows drive path `[A-Za-z]:[\/]`, (b) `~/…` or `~<user>/…`, or (c) a POSIX path `/<seg>/<seg>…` with at least two non-empty segments. One `HANDOFF_ABSOLUTE_PATH` per offending line; the message names the line number and never echoes the path (same convention as `WORKTREE_ABSOLUTE_WARN`). Relative forms (`../<lanes-dir>/<lane>`, `.current/history/…`), `origin/main`, single-segment slash commands (`/teamwork`) and URLs (`https://…`, the `//` follows a `:`) are not hits.
- The checks run only when the manifest is closed (D1), and only in `validateManifest` — never in `parseManifest`, so `render`, `check`, `check --cut` and `owners` never see these errors. New error scope `"handoff"`.

### D4 — E322 interface

New subcommand, read-only:

- `node scripts/fanout.mjs owners <manifest> --range <a>...<b> [--repo <dir>]` — the paths are `git diff --no-renames --name-only -z <a>...<b> --` run in `--repo` (default: the manifest's directory, same as `check`). The range must be exactly `<a>...<b>` (one `...`, both sides non-empty, no whitespace, neither starting with `-`), else `RANGE_INVALID`; each side must resolve (`git rev-parse --verify --quiet <ref>^{commit}`), else `REF_NOT_FOUND`; not a git repo → `REPO_NOT_GIT`.
- `node scripts/fanout.mjs owners <manifest> --paths <file>` — one repo-relative path per line (trailing CR and surrounding whitespace trimmed, blank lines skipped, no other normalisation); `<file>` = `-` reads stdin. Unreadable → `PATHS_UNREADABLE`.
- Exactly one of `--range` / `--paths`; `--repo` only with `--range`; exactly one positional `<manifest>`. Otherwise a usage error that prints the owners usage line.
- Lanes checked: every dispatchable lane of every `## Lanes` table. A path is a **hit** for a lane when it matches one of the lane's `擁有` tokens (`matchesGlob`, same as `check`) **or** the lane's implicit bookkeeping set (`isImplicitBookkeeping`: `.current/<lane>/`, `specs/<lane>-*.md`, lane-named `qa_reports/` / `review_reports/` files). Implicit bookkeeping counts as a hit on purpose — a base fix that brings in a lane's own state or evidence is not a clean merge either.
- Manifest errors of scope `lanes` or `row` are fatal (exit 2, all listed): a dropped row could be a lane whose ownership would be missed. Pins / Decisions errors do not block.
- Output (stdout, deterministic; paths de-duplicated and sorted by code unit): one `HIT` line per hit path, then a summary line, a source note, `PROSE_NOTE`, and — only when provisional lanes exist — a note naming them. Exit 0 = no hit, 1 = at least one hit, 2 = usage / input / manifest error.
- The generic `USAGE` constant stays byte-identical: `test/e296-manifest-tier.test.mjs` AC12 (not owned by this lane) pins exactly three `       node scripts/fanout.mjs` continuation lines. The owners usage is its own constant, printed on owners usage errors, and listed in the `scripts/fanout.mjs` header comment. Adding it to the generic usage is a follow-up once e296 AC12 can be re-pinned (pending-ticket).

### D5 — E316 rule

In `parseCutSection`, every line matching `/^ {0,3}##[ \t]+cut[ \t#]*$/i` counts as a Cut heading line. More than one such line → `CUT_SECTION_DUPLICATE` (lines listed), checked before the existing section lookup. Exactly one line keeps today's behaviour (a lone variant is still `CUT_SECTION_ABSENT`, because only a `## Cut` section is read). Setext headings (`Cut` + `---`) and homoglyphs (e.g. Cyrillic `С`) remain a documented limitation in the `parseCutSection` doc comment, alongside the fenced-code-block limit. No existing `specs/*.md` has more than one matching line at the dispatch base.

## Acceptance Criteria

All fixtures are in-test manifests / specs (no assertion on the growing content of real `specs/fanout-*.md`, no diff against a fixed sha).

### E283 — validate requires `## 接手步驟` on a closed manifest

- **AC-E283-1** — Given an otherwise valid manifest whose status line is `**狀態：已結案 2026-10-17。**` and no `## 接手步驟` section, when `validate` runs, then it exits 2 and stderr has `fanout: error: HANDOFF_SECTION_ABSENT:`.
  proof: `test/e283-validate-handoff.test.mjs` case "closed without section".
- **AC-E283-2** — Given the same manifest with a section holding the four mandatory sub-items, non-empty bodies, 進行中的背景工作 = `無`, no absolute path, when `validate` runs, then it exits 0 and stdout is the unchanged `fanout: ok — …` line. The heading `## 接手步驟（換 session 用）` and sub-item headings with a `（…）` suffix are also accepted; `**狀態**：已結案 …` and an ASCII colon are also closed.
  proof: `test/e283-validate-handoff.test.mjs` case "closed with complete section".
- **AC-E283-3** — Given a closed manifest whose section lacks one mandatory sub-item (each of the four in turn), repeats one, or leaves one with only blank lines, when `validate` runs, then it exits 2 with `HANDOFF_SUBITEM_ABSENT` / `HANDOFF_SUBITEM_DUPLICATE` / `HANDOFF_SUBITEM_EMPTY` naming the sub-item.
  proof: `test/e283-validate-handoff.test.mjs` case "sub-item absent / duplicate / empty".
- **AC-E283-4** — Given 進行中的背景工作 bodies `無`, `- 無`, `* 無`, `無。`, then validate passes; given `監看 e283 信箱`, `無\n- 整合分支未刪`, or `none`, then it exits 2 with `HANDOFF_BACKGROUND_NOT_NONE`.
  proof: `test/e283-validate-handoff.test.mjs` case "background must be 無".
- **AC-E283-5** — Given a section line containing `/Users/x/repo`, `/home/user/b`, `` `/tmp/x/y` ``, `（/private/var/z）`, `C:\work\x`, or `~/lanes/e283`, then validate exits 2 with one `HANDOFF_ABSOLUTE_PATH` per offending line naming its line number, and the stderr does not contain the path; given only `../lanes/e283`, `.current/history/x`, `origin/main`, `/teamwork`, `https://github.com/a/b`, then no `HANDOFF_ABSOLUTE_PATH`.
  proof: `test/e283-validate-handoff.test.mjs` case "absolute path".
- **AC-E283-6** — Given a closed manifest with complete mandatory sub-items, with or without `### 裝置` / `### 工具`, and with an extra unknown `### 備註`, then validate exits 0.
  proof: `test/e283-validate-handoff.test.mjs` case "optional and unknown sub-items".
- **AC-E283-7** — Given a closed manifest with two `接手步驟` sections, then validate exits 2 with `HANDOFF_SECTION_DUPLICATE`.
  proof: `test/e283-validate-handoff.test.mjs` case "duplicate section".
- **AC-E283-8** — Given manifests whose status text is `結案 2026-10-15。`, `已合併（…）`, `人類核准 2026-10-07；已結案 2026-10-08`, or that have no status line, each with no or an invalid `## 接手步驟` section, then validate's exit code and error-code set equal those of the same manifest with the section removed (no handoff code ever appears).
  proof: `test/e283-validate-handoff.test.mjs` case "not closed is not checked".
- **AC-E283-9** — Given a closed manifest whose handoff section is invalid, then `render`, `check`, `check --cut` and `owners` behave exactly as for the same manifest with status `人類核准 …` (handoff errors are validate-only).
  proof: `test/e283-validate-handoff.test.mjs` case "validate-only".
- **AC-E283-10** — Given a closed manifest that also has another format error (e.g. a bad Decisions date), then validate reports both codes.
  proof: `test/e283-validate-handoff.test.mjs` case "reported with other errors".
- **AC-E283-11** (hard condition) — For every `specs/fanout-*.md` at lane HEAD that exists at the dispatch base, the validate exit code and set of error codes equal the dispatch-base result: all exit 0, except `fanout-wave5.1.md` and `fanout-wave6.md` (exit 2, `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`). `test/e296-manifest-tier.test.mjs` AC9 and `test/e235b-relative-worktree.test.mjs` R11 pass unmodified.
  proof: qa ad-hoc sweep recorded in the qa report (`for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f"; echo "$f exit=$?"; done`, codes collected from stderr) compared with this table; plus `node --test test/e296-manifest-tier.test.mjs test/e235b-relative-worktree.test.mjs`.
- **AC-E283-12** (hard condition) — `render` output is byte-identical between a `dist/` built from the dispatch base and lane HEAD for every dispatchable lane of every `specs/fanout-*.md`.
  proof: qa ad-hoc comparison recorded in the qa report (base tree extracted and built under `$TMPDIR`, same `--summary` / `--reading` / `--primary` / `--base` arguments on both sides); not a resident test.

### E322 — `owners` subcommand

- **AC-E322-1** — Given an in-test manifest with lanes `a` (`擁有` `tools/a.ts`, `test/a-*.test.mjs`) and `b` (lane ids lowercase: implicit-bookkeeping matching is case-sensitive, same as `check`), and a path list `tools/a.ts`, `test/a-x.test.mjs`, `.current/b/handoff.md`, `README.md`, when `owners <m> --paths <file>` runs, then stdout has `HIT  tools/a.ts  (a: tools/a.ts)`, `HIT  test/a-x.test.mjs  (a: test/a-*.test.mjs)`, `HIT  .current/b/handoff.md  (b: implicit bookkeeping)`, no line for `README.md`, the summary `fanout owners: 4 path(s), 3 hit(s), 2 dispatchable lane(s)`, and exit 1.
  proof: `test/e322-owners.test.mjs` case "paths with hits".
- **AC-E322-2** — Given a path owned by two lanes, then one HIT line lists both, `; `-separated in table order.
  proof: `test/e322-owners.test.mjs` case "multi-lane hit".
- **AC-E322-3** — Given a path list with no owned path (or an empty list), then there is no HIT line, the summary shows `0 hit(s)`, and exit 0.
  proof: `test/e322-owners.test.mjs` case "no hits".
- **AC-E322-4** — Given `--paths -` with the list on stdin, then the result equals the file form.
  proof: `test/e322-owners.test.mjs` case "stdin".
- **AC-E322-5** — Given a temp git repo where `<target>` adds/changes `tools/a.ts` and `docs/x.md` after the merge-base with `<lane>`, when `owners <m> --range <lane>...<target> --repo <repo>` runs, then the HITs are exactly the owned paths among that diff, the source note names the range, and exit 1; a rename is reported as both old and new path (`--no-renames`).
  proof: `test/e322-owners.test.mjs` case "range".
- **AC-E322-6** — Given `--range a..b`, `--range ...b`, `--range -x...b` → `RANGE_INVALID`; an unresolvable side → `REF_NOT_FOUND`; `--repo` outside git → `REPO_NOT_GIT`; unreadable `--paths` file → `PATHS_UNREADABLE`; all exit 2.
  proof: `test/e322-owners.test.mjs` case "input errors".
- **AC-E322-7** — Given neither or both of `--range` / `--paths`, `--repo` with `--paths`, or zero / two positionals, then exit 2 and stderr has `fanout: error: USAGE:` and the owners usage line.
  proof: `test/e322-owners.test.mjs` case "usage".
- **AC-E322-8** — Given a manifest with a Lanes row error, then exit 2 listing it; given only a Decisions or Dispatch pins format error, then owners runs normally. Given a provisional Lanes table, then a note names its lanes as not checked.
  proof: `test/e322-owners.test.mjs` case "manifest errors and provisional lanes".
- **AC-E322-9** — The generic usage (no subcommand / unknown subcommand) is byte-identical to the dispatch base; `scripts/fanout.mjs` header comment lists the owners form; `test/e296-manifest-tier.test.mjs` AC12 passes unmodified. owners writes nothing (manifest, path file and repo unchanged; only read-only git commands).
  proof: `test/e322-owners.test.mjs` case "usage unchanged and read-only" plus `node --test test/e296-manifest-tier.test.mjs`.

### E316 — Cut heading variants count toward `CUT_SECTION_DUPLICATE`

- **AC-E316-1** — Given a spec with a valid `## Cut` table plus a second line that is `##<TAB>Cut`, ` ## Cut`, `   ## Cut`, `## cut`, `## CUT`, or `## Cut ##` (each case alone), when `check --cut` runs, then it exits 2 with `fanout: error: CUT_SECTION_DUPLICATE:` naming both line numbers.
  proof: `test/e316-cut-heading-variants.test.mjs` case "variants are duplicates".
- **AC-E316-2** — Given a valid `## Cut` plus `    ## Cut` (4 spaces), `### Cut`, `## Cut Decisions`, or `##Cut` (no space), then the result equals the spec without that line.
  proof: `test/e316-cut-heading-variants.test.mjs` case "non-variants unchanged".
- **AC-E316-3** — Given a spec whose only Cut-like line is a variant (e.g. `## cut`), then the error is `CUT_SECTION_ABSENT` as before.
  proof: `test/e316-cut-heading-variants.test.mjs` case "lone variant".
- **AC-E316-4** — The `parseCutSection` doc comment names the setext and homoglyph limitation; `test/e296-manifest-tier.test.mjs` (AC11 `CUT_SECTION_DUPLICATE` case) passes unmodified.
  proof: `grep -n -i 'setext' tools/fanout-manifest.ts` hits inside the parseCutSection comment; `node --test test/e296-manifest-tier.test.mjs`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| handoff.err.absent | `HANDOFF_SECTION_ABSENT: manifest is closed (status 已結案) but has no "## 接手步驟" section` | authored-here — error code + message; code avoids the gate-suffix vocabulary of test/error-code-contract.test.mjs (FANOUT_CODES precedent) |
| handoff.err.duplicate | `HANDOFF_SECTION_DUPLICATE: <n> "## 接手步驟" sections found (lines <l>, …); exactly one is allowed` | authored-here — mirrors CUT_SECTION_DUPLICATE wording |
| handoff.err.subitem-absent | `HANDOFF_SUBITEM_ABSENT: "## 接手步驟" (line <l>) has no "### <name>" sub-item` | authored-here |
| handoff.err.subitem-duplicate | `HANDOFF_SUBITEM_DUPLICATE: "### <name>" appears <n> times (lines <l>, …)` | authored-here |
| handoff.err.subitem-empty | `HANDOFF_SUBITEM_EMPTY: "### <name>" (line <l>) is empty` | authored-here |
| handoff.err.background | `HANDOFF_BACKGROUND_NOT_NONE: "### 進行中的背景工作" (line <l>) must read 無 when the manifest is closed` | authored-here — rule from integrator-session-per-wave §5 P2 |
| handoff.err.abspath | `HANDOFF_ABSOLUTE_PATH: "## 接手步驟" line <l> has a machine-local absolute path — write it relative to primary or as a placeholder` | authored-here — never echoes the path (WORKTREE_ABSOLUTE_WARN convention) |
| owners.hit | `HIT  <path>  (<lane>: <token>[; <lane>: <token>…])`, bookkeeping hit `(<lane>: implicit bookkeeping)` | authored-here — two-space separators like check's `OUT` lines |
| owners.summary | `fanout owners: <N> path(s), <H> hit(s), <L> dispatchable lane(s)` | authored-here — mirrors `fanout check:` summary |
| owners.note.range | `note: paths from git diff --no-renames --name-only <a>...<b> (committed changes only).` | authored-here |
| owners.note.paths | `note: paths from the list <file> (taken verbatim, not normalised).` | authored-here |
| owners.note.provisional | `note: <k> provisional lane(s) not checked: <lane>, …` | authored-here |
| owners.usage | `usage: node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] \| --paths <file\|->)` | authored-here — separate constant; generic USAGE unchanged (D4) |
| owners.err | `RANGE_INVALID`, `PATHS_UNREADABLE` (new); `REF_NOT_FOUND`, `REPO_NOT_GIT` (reused) | authored-here |
| cut.err.duplicate | existing `CUT_SECTION_DUPLICATE` message; line list now includes variant heading lines | existing (E296) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `content/skill-integrator.md` wording (canonical `已結案` status for Stage 6, condition 2 switching to `owners`) — E285 / a later ticket.
- E284 `handoff` command (skeleton + `--check`); E314 / E315.
- `docs/lane-protocol.md`, any `specs/fanout-*.md`, `test/e296-manifest-tier.test.mjs`, `test/e178a-integrator-role.test.mjs`.
- Handoff checks on manifests that are not closed (mid-wave handoff sections are not validated).
- Setext / homoglyph Cut headings and fenced code blocks (documented limits).
- Adding `owners` to the generic usage text (needs a re-pin of e296 AC12, not owned here).

## Dependencies / Prerequisites

- Resource Audit: no external references (only in-repo docs and specs are cited); `external_refs` omitted.
- Routing: pm → sr-engineer (T-E316-01 → T-E283-01 → T-E322-01, serial: one source file) → code-reviewer → qa-engineer. No architect hop: one module, no new data model, no cross-cutting API. Dispatch pin `sr-engineer=opus` (manifest).
- New test files are qa-only (Constitution §2): `test/e283-validate-handoff.test.mjs`, `test/e322-owners.test.mjs`, `test/e316-cut-heading-variants.test.mjs`.
- Pending-tickets for the lane's `.current/e283/pending-tickets.md` at close: (1) skill-integrator Stage 6 names the canonical `**狀態：已結案 …**` status; (2) list `owners` in the generic usage after e296 AC12 is re-pinned; (3) skill-integrator condition 2 uses `owners --range` (already planned by the manifest).
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E316-01 | sr: parseCutSection counts every `/^ {0,3}##[ \t]+cut[ \t#]*$/i` line toward CUT_SECTION_DUPLICATE; doc-comment limit; rebuild dist. qa: new test (AC-E316-1..4) | none | 6 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e316-cut-heading-variants.test.mjs` | — |
| T-E283-01 | sr: closed detection (status starts 已結案) + validate-only `## 接手步驟` checks (D1–D3); rebuild dist. qa: new test + hard-condition sweeps (AC-E283-1..12) | T-E316-01 | 6 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e283-validate-handoff.test.mjs` | — |
| T-E322-01 | sr: `owners` subcommand (`--range` / `--paths`, D4) + route and header in the wrapper; rebuild dist. qa: new test (AC-E322-1..9) | T-E283-01 | 7 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`、`test/e322-owners.test.mjs` | — |
