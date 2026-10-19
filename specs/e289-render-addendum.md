# e289-render-addendum

Fan-out lane `e289` of `specs/fanout-post-v4-w7.md` (post-v4 wave 7). Tickets: E289, E337, E338, E339.
Branch `feat/e289-render-addendum`, dispatch base `93ed15c`.

## Problem Statement

`node scripts/fanout.mjs render` writes a dispatch prompt that hard-codes the relative `docs/lane-protocol.md`, so an adopter repo has no way to point a lane at agc's generic lane rules plus its own repo-level addendum (integrator revision 2026-10-08 §4 O1, §6.3 three-layer lane protocol), and the prompt never tells the lane to move its session into the new worktree with `EnterWorktree` (§4 O12 item 5). Three small defects ride along in the same two fan-out tool files: the `HANDOFF_SUBITEMS` doc comment claims an order that `validate` never checks (E337); the closed-manifest absolute-path detector reads a backtick-quoted glob `` `**/a/b` `` as a bold-wrapped absolute path and reports `HANDOFF_ABSOLUTE_PATH` (E338); and `handoff`'s git status fact runs with git's default `core.quotePath`, so a manifest with a non-ASCII file name is printed quoted and escaped, escapes the self-exclusion, and makes a clean `handoff --check` report a difference (E339).

## User Stories

- As an integrator in an adopter repo, I want `render` to point each lane at agc's generic lane rules and at my repo's addendum, so that I stop forking the whole lane protocol every wave.
- As a lane session, I want the dispatch prompt to tell me to switch into the worktree with `EnterWorktree` right after `feature start` (and what to do when the tool is unavailable), so that no command runs on primary by accident.
- As an integrator in this repo, I want `render` with the new key unset to keep producing today's prompt plus that one line, so that existing goldens and habits do not move.
- As a maintainer, I want the `HANDOFF_SUBITEMS` comment to say what `validate` actually checks, so that nobody relies on an order check that does not exist.
- As an integrator closing a wave, I want a backtick-quoted glob such as `` `**/node_modules/x` `` in the handoff section to pass `validate`, so that a correct closed manifest is not rejected.
- As an integrator, I want `handoff --check` to stay clean right after pasting the section into a manifest whose file name is non-ASCII, so that the check does not report a difference that is not there.

## Acceptance Criteria

All test files below are new unless noted; they build fixtures in `os.tmpdir()` and never assert content of real `specs/fanout-*.md` files or diff against a fixed sha (lane rule). Proof commands that compare to the dispatch base use the three-dot form so a later merge of the target branch does not count as lane change (lane-protocol §7.4).

### E289 — config key

- **AC-E289-1** — Given a workspace whose `.current/.config.json` holds `"laneProtocolAddendum": "docs/lane-protocol-addendum.md"`, when `loadConfig(<workspace>)` runs, then the returned config has `laneProtocolAddendum === "docs/lane-protocol-addendum.md"` (byte-verbatim); given the key absent, an empty string, or a non-string value (number, array, object, `null`), then the field is absent from the returned config and `getConfigError` stays `null` (non-fatal filter, same convention as `staleDispatchNotifyFile`).
  proof: `node --test test/e289-config-key.test.mjs`
- **AC-E289-2** — Given the key is added, when the config schema version is read, then it is unchanged: `CURRENT_VERSIONS.config` is still `2`, and `schema/versions.ts`, `schema/migrations-config.ts`, `docs/schema-versions.md` and `test/config-versioning.test.mjs` are not modified by this lane.
  proof: `git diff --quiet 93ed15c...HEAD -- schema/versions.ts schema/migrations-config.ts docs/schema-versions.md test/config-versioning.test.mjs; echo "exit=$?"` prints `exit=0`, and `node --test test/e289-config-key.test.mjs` asserts `CURRENT_VERSIONS.config === 2`.
- **AC-E289-3** — Given `docs/config.md`, when it is read, then it has exactly one `### \`laneProtocolAddendum\`` section (heading text = copy `docs.heading`) that states: the value is a path relative to the repo root naming a tracked file; with the key unset `render` keeps pointing only at `docs/lane-protocol.md`; with it set, the prompt names the agc generic rules (relative `docs/lane-protocol.md` when `render` runs from the checkout that is primary, otherwise the absolute path inside the agc install) and the addendum; the four render error codes `ADDENDUM_INVALID`, `ADDENDUM_ABSENT`, `LANE_PROTOCOL_ABSENT`, `CONFIG_UNREADABLE`; and that the key is additive-optional with no `schema_version` bump.
  proof: `node --test test/e289-config-key.test.mjs` (asserts the heading occurs once and each of the four codes and the literal `docs/lane-protocol.md` occur inside that section).

### E289 — render

- **AC-E289-4** — Given `PROMPT_TEMPLATE_3B`, when it is read, then it has exactly one new line (copy `template.enter-worktree`) placed directly after the `先完整讀 …` line and before `你只負責這張票走到 qa PASS；…`; every other template line is byte-identical to base.
  proof: `node --test test/e289-render-addendum.test.mjs`
- **AC-E289-5** (hard condition: unset key ⇒ byte-identical except the new line) — Given the E177a fixture render (key unset), when the render golden is re-pinned, then the golden's diff against the dispatch base is exactly one added line and zero removed lines, and the added line equals copy `template.enter-worktree` with `<worktree>` substituted by the fixture's worktree.
  proof: `git diff --numstat 93ed15c...HEAD -- test/fixtures/e177a/render-e177a.golden.txt` prints `1	0	test/fixtures/e177a/render-e177a.golden.txt`; `node --test test/e177a-manifest.test.mjs` is green (AC6 golden, AC7 no lane-protocol text).
- **AC-E289-6** (hard condition: e177a AC7) — Given the rendered prompt (key unset and key set), when every trimmed non-blank `docs/lane-protocol.md` line longer than 20 characters is searched for in it, then none is found — the new template line is phrased as a prompt instruction, not as lane-protocol prose.
  proof: `node --test test/e177a-manifest.test.mjs` (AC7) and `node --test test/e289-render-addendum.test.mjs` (same leak check on the key-set render).
- **AC-E289-7** — Given a primary (temp git repo) whose `.current/.config.json` sets `laneProtocolAddendum` to a relative path naming an existing file, and an agc install root that is NOT primary (realpaths differ) and holds `docs/lane-protocol.md`, when `render` runs, then the `先完整讀` line reads copy `render.two-layer` with `<generic>` = the absolute `<install root>/docs/lane-protocol.md` and `<addendum>` = the configured value byte-verbatim, and every other line equals the key-unset render of the same manifest and options.
  proof: `node --test test/e289-render-addendum.test.mjs`
- **AC-E289-8** — Given the same configured primary, and an install root whose realpath equals primary's realpath (the install IS this repo), when `render` runs, then `<generic>` is the relative `docs/lane-protocol.md`.
  proof: `node --test test/e289-render-addendum.test.mjs` (injects the install root through the `RenderOptions` test seam, see Dependencies D3).
- **AC-E289-9** — Given the key is set, when its value is absolute, starts with `~`, normalizes to `.` or to a path whose first segment is `..`, then `render` exits 2 with `ADDENDUM_INVALID` on stderr, prints no prompt, and the message does not echo the value; when the value names no regular file under primary (missing, or a directory), then exit 2 with `ADDENDUM_ABSENT`; when the install root has no `docs/lane-protocol.md`, then exit 2 with `LANE_PROTOCOL_ABSENT`. Given primary's `.current/.config.json` is unparseable, then exit 2 with `CONFIG_UNREADABLE`. Given the key is unset, `LANE_PROTOCOL_ABSENT` is never raised, whatever the install root holds. Each of these errors is collected together with the other missing-source errors (render reports every missing source before returning).
  proof: `node --test test/e289-render-addendum.test.mjs`
- **AC-E289-10** (hard condition) — Given the doc comment directly above `PROMPT_TEMPLATE_3B`, when e178a AC15 reads it, then it still contains `content/skill-integrator.md`, `the single canonical copy` and `E177a render golden`; `test/e178a-integrator-role.test.mjs` and `test/e296-manifest-tier.test.mjs` are green and unmodified.
  proof: `node --test test/e178a-integrator-role.test.mjs test/e296-manifest-tier.test.mjs` green; `git diff --quiet 93ed15c...HEAD -- test/e178a-integrator-role.test.mjs test/e296-manifest-tier.test.mjs; echo "exit=$?"` prints `exit=0`.

### E337 — sub-item comment

- **AC-E337-1** — Given the doc comment on `HANDOFF_SUBITEMS` in `tools/fanout-manifest.ts`, when it is read, then it no longer contains `in order` and states that the order is not checked (copy `comment.subitems`); given a closed manifest whose four mandatory sub-items appear in reverse order, each once with a body (background = 無), when `validateManifest` runs, then it reports zero errors (no new `HANDOFF_*` code exists).
  proof: `node --test test/e337-subitem-order.test.mjs`

### E338 — backtick before `**`

- **AC-E338-1** — Given a closed, otherwise valid manifest whose handoff section has one of these lines, when `validateManifest` runs, then it reports no `HANDOFF_ABSOLUTE_PATH`: ``- `**/node_modules/x` ``, ``- 見 `**/src/a/b` ``, ``- ``**/a/b`` ``, ``- `**/Users/x/y**` `` (a backtick before `**` never opens bold — inside a code span `**` is literal).
  proof: `node --test test/e338-backtick-glob.test.mjs`
- **AC-E338-2** (PM decision, see Gate Summary G6) — Given the same manifest, when the line is one of `**/a/b` (line start), `- see **/src/a/b`, `- x=**/a/b`, `- 見 **/Users/x/y**`, ``- `/tmp/x/y` ``, then `validateManifest` still reports exactly one `HANDOFF_ABSOLUTE_PATH` for it: whitespace, line start and every other boundary character before `**/…` keep opening bold, unchanged from base. The detector's comment names the remedy: write a glob inside a code span.
  proof: `node --test test/e338-backtick-glob.test.mjs`
- **AC-E338-3** — Given the existing detector tests, when they run, then `test/e332-absolute-path-boundaries.test.mjs` and `test/e283-validate-handoff.test.mjs` are green and unmodified.
  proof: `node --test test/e332-absolute-path-boundaries.test.mjs test/e283-validate-handoff.test.mjs` green; `git diff --quiet 93ed15c...HEAD -- test/e332-absolute-path-boundaries.test.mjs test/e283-validate-handoff.test.mjs; echo "exit=$?"` prints `exit=0`.

### E339 — non-ASCII manifest name

- **AC-E339-1** — Given a temp git primary whose committed manifest is `specs/fanout-波次.md`, when `handoff` generates the section, the section is pasted into that manifest (so the manifest is modified and nothing else is), and `handoff --check` runs, then the `git status` fact reads `乾淨`, the primary `lane-status` row reads clean, and `--check` exits 0.
  proof: `node --test test/e339-non-ascii-manifest.test.mjs`
- **AC-E339-2** — Given that primary also has an untracked `新檔.txt`, when `handoff` runs, then the `git status` fact lists it unquoted as `?? 新檔.txt` (the git status call runs with `-c core.quotePath=false`).
  proof: `node --test test/e339-non-ascii-manifest.test.mjs`
- **AC-E339-3** — Given the git status call now starts with `-c core.quotePath=false`, when that call fails, then the `HANDOFF_GIT_FAILED` message still names the subcommand `status` (the subcommand lookup skips a `-c` option and its value).
  proof: code-reviewer reads `gitFact` and the status call in `tools/fanout-handoff.ts`; no failing-git fixture is required.

### Lane-wide hard conditions

- **AC-HC-1** — Given every `specs/fanout-*.md` in the repo, when `node scripts/fanout.mjs validate` runs on each, then each exit code and error-code set equals the dispatch-base baseline recorded in Dependencies D5 (all exit 0 except `fanout-wave5.1.md` and `fanout-wave6.md`: exit 2, `DECISIONS_SECTION_ABSENT` + `PINS_SECTION_ABSENT`).
  proof: `for f in specs/fanout-*.md; do o=$(node scripts/fanout.mjs validate "$f" 2>&1); echo "$? $f $(echo "$o" | grep -oE '[A-Z][A-Z_]{5,}' | sort -u | tr '\n' ' ')"; done` matches the D5 table line for line for every manifest present at base.
- **AC-HC-2** — Given the lane branch, when `node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e289` runs, then it exits 0 (every changed path is inside the lane's 擁有 cell).
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e289; echo "exit=$?"` prints `exit=0`.
- **AC-HC-3** — Given the final HEAD with a clean worktree (everything committed), when the full suite runs, then it is green.
  proof: `node scripts/test-lock.mjs -- npm test`

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| template.enter-worktree | `` `feature start` 建好 worktree 之後，呼叫 `EnterWorktree`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 `cd <worktree> &&`。 `` | authored-here — integrator revision 2026-10-08 §4 O12 items 2, 3, 5; phrased as a prompt instruction so it can never equal lane-protocol §1 prose (AC-E289-6) |
| render.two-layer | `` 先完整讀 <generic>（agc 通用規則，包括信箱與回報格式）和 <addendum>（本 repo 的補充規則），再讀 <計劃的必讀章節> + <票面 row>。 `` — replaces the unset form `` 先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），再讀 <計劃的必讀章節> + <票面 row>。 `` only when the key is set | authored-here — integrator revision §6.3 (render points at the first two layers); keeps the unset wording's parenthetical so the two forms read alike |
| err.addendum-invalid | `ADDENDUM_INVALID: laneProtocolAddendum in .current/.config.json must be a path relative to the repo root and inside it — absolute, "~" and ".." paths are refused` | authored-here — value deliberately not echoed (WORKTREE_TILDE convention) |
| err.addendum-absent | `ADDENDUM_ABSENT: laneProtocolAddendum "<value>" (.current/.config.json) is not a file under primary` | authored-here — the value is already known relative, so it is echoed |
| err.lane-protocol-absent | `LANE_PROTOCOL_ABSENT: laneProtocolAddendum is set, but the agc generic rules docs/lane-protocol.md were not found in the agc install` | authored-here |
| err.config-unreadable | `CONFIG_UNREADABLE: primary's .current/.config.json cannot be used, so laneProtocolAddendum cannot be read: <getConfigError text>` | authored-here — reuses the existing `getConfigError` message as the tail |
| docs.heading | `` ### `laneProtocolAddendum` — repo lane-protocol addendum for `fanout.mjs render` (optional) `` | authored-here — mirrors the existing `### \`nodeModulesLinks\` — …` heading form in `docs/config.md` |
| comment.subitems | `Sub-items (\`### \` headings) every handoff section must hold, each exactly once with a non-empty body; their order is not checked.` | authored-here — E337 (comment follows validate) |

The error lines are written by the existing `fail()` formatter (`<CODE>: <message>`); the copy column shows the full line so the code prefix is unambiguous.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Editing `docs/lane-protocol.md`, writing this repo's addendum file, or setting `laneProtocolAddendum` in this repo's `.current/.config.json` (E290, wave 4; E294 belongs to lane e285).
- SOP references in `content/**` (E285); sister-repo declarations (E292).
- A new `render` CLI flag: the addendum comes from config only; usage text and the `scripts/fanout.mjs` header stay as they are (e296 AC12 pins five usage continuation lines).
- Pointing an unconfigured adopter at the installed generic rules: with the key unset the prompt is unchanged (hard condition).
- An order check for the handoff sub-items, and any new `HANDOFF_*` code (E337 decision).
- Changing the bold rule for whitespace, line start, `=`, `(`, `|`, quotes or any other boundary before `**` (E338 decision); a bold-pair heuristic.
- `tools/lane-status.ts`' own git status call (not owned; the handoff primary row already follows the handoff's git status fact).
- A config `schema_version` bump and its migration (Gate Summary G1).
- Release bookkeeping (version, CHANGELOG, backlog done-marks) — release-engineer after the wave.

## Dependencies / Prerequisites

- E284 (`handoff`) and E291 (config key precedent `nodeModulesLinks`) are shipped at base `93ed15c`. No external references (resource audit: zero hits — every source is an in-repo document).
- **D1 — config read path.** `render` reads the key with `loadConfig(<primary>)` from `tools/config.ts` (shared semantics: future-version refusal, mtime cache, heal-on-read of an older `schema_version` — an existing behaviour of every config reader). The config is read only once primary is known; with no primary, `PRIMARY_NOT_FOUND` stays the only report (same skip rule as the worktree and mailbox resolution). `getConfigError(<primary>) !== null` ⇒ `CONFIG_UNREADABLE`.
- **D2 — install root.** The agc install root is the package root that holds the running `dist/tools/fanout-manifest.js` (two directories up from the compiled module; the package ships the whole repo, `docs/` included). Generic rules = `<install root>/docs/lane-protocol.md`. Same checkout test: `fs.realpathSync` of install root and primary are equal (fall back to `path.resolve` when realpath throws) ⇒ relative `docs/lane-protocol.md`; else the absolute path. The absolute path appears only in the rendered prompt (chat), never in a tracked file.
- **D3 — test seam.** `RenderOptions` gains an optional install-root override used only by tests (the CLI never sets it); the default is D2. The prompt-assembly approach (extra substitution key vs post-pass) is sr-engineer's choice as long as AC-E289-4/5/7 hold and the template literal changes by exactly the one added line.
- **D4 — addendum path.** Written into the prompt byte-verbatim as configured (relative, so it resolves the same in primary and in the lane worktree). Validation per AC-E289-9; the addendum should be a tracked file so it exists in each worktree — documented in `docs/config.md`, not checked.
- **D5 — validate baseline at dispatch base `93ed15c`** (AC-HC-1): exit 0 for `fanout-e229`, `fanout-e233`, `fanout-e234`, `fanout-e235`, `fanout-e243-e248`, `fanout-e246-e259`, `fanout-e250`, `fanout-e258`, `fanout-e260-followups`, `fanout-e260`, `fanout-feedback-leftovers-wave2`, `fanout-feedback-leftovers`, `fanout-post-v4-w1` … `fanout-post-v4-w7`, `fanout-wave7.2`, `fanout-wave7.2b`, `fanout-wave7` (all `.md`, no codes); exit 2 with `DECISIONS_SECTION_ABSENT` + `PINS_SECTION_ABSENT` for `fanout-wave5.1.md` and `fanout-wave6.md`.
- **D6 — cross-lane note for E290.** `test/e296-manifest-tier.test.mjs` AC10 renders with primary = repo root. When E290 sets `laneProtocolAddendum` in this repo's `.current/.config.json`, the addendum file must land in the same commit, or that render exits 2 with `ADDENDUM_ABSENT`. Integration CI re-runs e177a AC7 after e285 lands its lane-protocol §1 sentence.
- Architect hop skipped: the three code changes are independent and local (one config field, one render branch, one regex, one git flag); D1–D4 fix every design choice, so no new data model or cross-cutting API remains to design.

## Gate Summary (option choices)

| # | choice | decision | why |
|---|---|---|---|
| G1 | config `schema_version` bump? | **No bump** (stays 2) | additive-optional key; precedent `host`, `driftBaselineIds`, `staleDispatchNotifyFile`, `nodeModulesLinks`; older readers drop the unknown key from the typed view and keep it on disk |
| G2 | key name and shape | `laneProtocolAddendum`: string, path relative to the repo root; `loadConfig` surfaces only a non-empty string, `render` validates it loudly (AC-E289-9) | config.ts keeps its non-fatal filter convention; `render` keeps its "absent source is an error, never a default" rule |
| G3 | "resolved to the agc install location" when the install IS this repo | integrator recommendation adopted: key unset ⇒ unchanged single pointer `docs/lane-protocol.md`; key set ⇒ generic = relative `docs/lane-protocol.md` when install-root realpath = primary realpath, else absolute `<install root>/docs/lane-protocol.md` (D2) | hard condition (unset ⇒ byte-identical but one line); relative pointer stays valid inside the lane worktree of the same repo |
| G3b | primary config unparseable | `render` exits 2 `CONFIG_UNREADABLE` (not a silent fallback to "unset") | a broken config would otherwise drop the addendum pointer without a trace |
| G4 | E337: comment vs order check | **Comment fix**, no new `HANDOFF_*` code | an order check could change `validate` results of closed manifests (AC-HC-1 risk) and widens scope |
| G5 | E338: backtick before `**` | never opens bold | inside a code span `**` is literal, so the glob is not a bold-wrapped path |
| G6 | E338: whitespace (and line start, other boundaries) before `**/a/b` | **still a hit — unchanged from base** | `見 **/Users/x/y**` (pinned hit in e332) must stay caught; a glob has a cheap remedy (code span); a bold-pair heuristic is out of scope |
| G7 | E339 side fix | `gitFact`'s subcommand lookup skips `-c <value>` so `HANDOFF_GIT_FAILED` still names `status` | adding `-c` would otherwise make the message name `core.quotePath=false` |
| G8 | template line placement | one new line directly after the `先完整讀 …` line | the lane reads it before the fields block; wording per copy `template.enter-worktree` |
| G9 | architect hop | **skipped** | see Dependencies (last bullet) |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E289-01 | sr: `laneProtocolAddendum` in `WorkspaceConfig` + non-fatal filter in `loadConfig` (no schema bump, G1); `docs/config.md` section (AC-E289-3); rebuild dist. qa: new config test (AC-E289-1..3) | none | 7 | `tools/config.ts`、`dist/tools/config.*`、`docs/config.md`、`test/e289-config-key.test.mjs` | — |
| T-E289-02 | sr: `PROMPT_TEMPLATE_3B` gains the `EnterWorktree` line (provenance comment keeps the three e178a AC15 strings); render reads the key from primary's config and emits the two-layer pointer with the D2 install-root resolution and the four errors; rebuild dist. qa: re-pin the E177a render golden (one added line only), new render test (AC-E289-4..10) | T-E289-01 | 7 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/fixtures/e177a/render-e177a.golden.txt`、`test/e289-render-addendum.test.mjs` | — |
| T-E337-01 | sr: `HANDOFF_SUBITEMS` comment drops "in order", states order is not checked (G4); rebuild dist. qa: new test (AC-E337-1) | T-E289-02 | 6 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e337-subitem-order.test.mjs` | — |
| T-E338-01 | sr: a backtick before `**` never opens bold in the handoff absolute-path start pattern; every other boundary unchanged (G5); comment names the code-span remedy; rebuild dist. qa: new test (AC-E338-1..3) + validate baseline sweep (AC-HC-1) | T-E337-01 | 6 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e338-backtick-glob.test.mjs` | — |
| T-E339-01 | sr: git status fact runs `git -c core.quotePath=false …`; the `HANDOFF_GIT_FAILED` subcommand lookup skips `-c <value>` (G7); rebuild dist. qa: new non-ASCII manifest fixture test (AC-E339-1..3) | none | 6 | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*`、`test/e339-non-ascii-manifest.test.mjs` | — |
