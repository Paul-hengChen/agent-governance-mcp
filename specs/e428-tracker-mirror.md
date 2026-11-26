# e428-tracker-mirror

Ticket E428 (`docs/backlog.md`, base text + 2026-11-18 addendum + 2026-11-19 audit amendment; the amendment wins on conflict). Wave manifest: `specs/fanout-post-v5-w5.md`, lane `e428`, base `32e7f7e`. Rulings: `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` §11.4 rulings 9 and 11, §15.2 rulings 4 and 5, §15.3, §16.1; human Q3 (B) of the wave (write-back switch in the untracked local map, no config key). Amended after code-reviewer round 1 (finding F1): see *Amendment after review round 1* under *Cut decisions*; changed: blocks `C-IN1` and `C-TF1`, AC2, AC3, AC7, AC8, the hop estimate, the Task Budget Map and the cut (T-E428-06, T-E428-07).

## Problem Statement

The ticket of record is the tracked ticket file, but teams that also work from an issue tracker have no rule for showing tickets there, for starting work from a tracker number when a ticket file already exists, or for noticing that a source item changed after the ticket was cut. Today `spec-workshop` only says "one ticket file maps to at most one tracker item" (which contradicts its own "several items may become one"), the coordinator only handles a tracker number with *no* ticket file, the integrator never touches a tracker, and the ticket format has no place for tracker numbers in a public repository. This ticket adds an opt-in, one-way mirror written purely as SOP and format text — no server code, no config key, no tracker credentials in the server, no vendor name.

## User Stories

- As an operator whose team watches an issue tracker, I want `spec-workshop` to create one tracker item per ticket file when I ask, so that the team sees the tickets where it already looks, without the tracker becoming a second source of truth.
- As an operator running a wave, I want the integrator to keep each mirrored item's state, stop reason and pull-request reference current, and to draft (never post) a stopped ticket's question, so that the tracker tells the truth and I decide what is said in public.
- As an operator, I want to start work by naming a tracker number, so that I do not have to look the ticket file up myself; and I want to hear when the item I cut a ticket from changed, so that I can rule on it before acceptance.
- As a maintainer of a public repository, I want tracker numbers kept out of the repository entirely, so that internal item numbers never leak.

## Acceptance Criteria

All tests live in `test/e428-tracker-mirror.test.mjs` (qa-engineer may split within `test/e428-*.test.mjs` and updates the `proof:` lines' file names if so); each test title starts with its AC id. Text assertions run on the raw source AND, for the two composed roles, on the served text: `buildPromptForRole` for the coordinator (`teamwork`) and for `spec-workshop`, as the e423/e445 tests already do. "Copy" names refer to the *Copy / Strings* table; placement in each file is exact.

- **AC1** — Given the human asks `spec-workshop` to mirror, when the run reaches the approval row, then the SOP tells it to create, with the host's own tracker tools, one tracker item for each ticket file that has none (holding the ticket's id, title and file path and saying the file is the record), and to record each created item in the tracker map by number, never a link: `content/skill-spec-workshop.md` has a `## Tracker mirror` section, directly after `## Outputs` (its last bullet unchanged) and directly before `## Governance state`, whose body is exactly `C-SW2`.
  proof: `node --test --test-name-pattern "^AC1" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC2** — Given a ticket cut from a tracker item (an imported ticket), when `spec-workshop` mirrors, then it creates no second item (the source item stands for it), creates one child item under the source item per ticket file only when the human asks (under one of the source items, chosen by the person who asks, when the ticket was cut from several), and never gives a ticket file a second created item while the items it was cut from do not count: the `C-SW2` sentences say so, the ticket format's first-level rule (`C-TF1` bullet 2) says so, and the map rule `A ticket has at most one \`mirror\` or \`child\` row.` is present.
  proof: `node --test --test-name-pattern "^AC2" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC3** — Given no mirror request, when tickets are filed or move, then no tracker write is made while reading an item and comparing its revision stay allowed: `C-SW2` opens with the request condition and its reading carve-out; `C-TF1` bullet 6 (`Without a mirror request nothing is written to a tracker. …`); the integrator's `C-IN1` has `No item, no write.` (amended from `No row, no write.`); the coordinator's `C-CO1` ends `Only read the tracker; never write to it.`
  proof: `node --test --test-name-pattern "^AC3" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC4** — Given the recording rule, when a ticket file is written, then it holds tracker item numbers only in `source`, never a link, and in a public repository none (the number then goes in the tracker map): the `spec-workshop` *Ticket files* bullet carries `C-SW1` in place of the old sentence `One ticket file maps to at most one tracker item; \`source\` = \`<item number> rev <revision>\`, the number only, never a link, and empty in a public repository.` (the old text is gone; the rest of the bullet is unchanged; `test/e423-spec-workshop.test.mjs` fragments `\`source\` = \`<item number> rev <revision>\`` and `empty in a public repository` stay green), and `C-TF1` bullet 3 states the rule. The ticket format's field table row for `source` is byte-identical to base.
  proof: `node --test --test-name-pattern "^AC4" test/e428-tracker-mirror.test.mjs test/e423-spec-workshop.test.mjs` exits 0.
- **AC5** — Given the tracker map, when an adopter keeps it as documented, then it is untracked without any ignore rule and every linked worktree reads the same file: `docs/ticket-format.md` has `## Tracker mirror` (intro + six bullets) and `### Tracker map` exactly as `C-TF1`, placed after `## Where ticket files are listed` (unchanged) and before `## Named tests checked in CI`, so `test/e425-stop-ticket-batch.test.mjs` AC6 (`Named tests → Batch summary → Example ticket`, tooling last) and `test/e455-ticket-checker-strict.test.mjs` AC8 (explanations hold no id but `E900`/`E899`) stay green; and a behavioural test builds a throwaway git repository in `os.tmpdir()` with one linked worktree, writes `agc-tracker-map.md` into the directory `git rev-parse --git-common-dir` prints (from the primary), then asserts `git status --porcelain --ignored` is empty in both checkouts and the linked worktree's own `git rev-parse --git-common-dir` resolves to the same file. The map example in `C-TF1` parses as: one `write-back: off` line, one table with header `| ticket | item | kind | revision |`, kinds only from `source`/`mirror`/`child`, no link in any cell.
  proof: `node --test --test-name-pattern "^AC5" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC6** — Given a ticket with a `mirror` or `child` row in the map, when the integrator dispatches, stops, opens the pull request for, or merges it, then it updates that item with the host's tracker tools: in progress at dispatch; the stopped state and the reason after `stopped — ` at a stop; the pull request's number once open; done at merge — `content/skill-integrator.md` has a `## Tracker items` section directly after the *Your own commits* paragraph that closes `## Stage 6` and directly before `## Git operations`, whose text is exactly `C-IN1`. No other line of the file changes; `### Sessions outside a lane` is still followed directly by `## Stage 5 — Verify and integrate` (`test/e430-mailbox-outside-lane.test.mjs` AC1 stays green).
  proof: `node --test --test-name-pattern "^AC6" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC7** — Given a ticket that stops, when the integrator records it, then the tracker item (a mirrored one, or a source one with write-back on) shows the stopped state and the reason, and the question is drafted for the human, never posted, whatever the item's kind: `C-IN1` bullet 3 (`… is never posted, whatever the item: …`) and `C-TF1` bullet 5 (`A stop's open question is never posted by a tool: it is drafted for a person to post or not.`).
  proof: `node --test --test-name-pattern "^AC7" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC8** — Given a ticket whose only tracker item is a source item — listed in a `source` row of the tracker map (public repository) or only in the ticket file's `source` field with no map row at all (private repository) — when it moves, then the integrator writes to that source item (to each, when `source` lists several) only when the map's `write-back` line reads `on`; it is off by default (a missing file, a missing line or any other value means `off`) and only a person turns it on: `C-IN1`'s intro counts an item the ticket file's `source` field lists as a tracker item (`Only a ticket with a tracker item gets tracker writes: an item its ticket file's \`source\` field lists, or a row in the tracker map`), `C-IN1` bullet 2 (`**Source item** (one the ticket file's \`source\` field lists, or a \`source\` row)` … `whether or not the map has a row for the ticket`), the `C-SW2` switch sentence, and the `C-TF1` map bullet on `write-back`. Private-repository case the test spells out: ticket `E900` with `source: [1234 rev 7]`, a map file holding only `write-back: on` and no `E900` row → the raw and served integrator text direct the updates to item 1234 (the intro admits it, bullet 2 applies with no row); the same ticket with `write-back: off`, the line missing, or no map file → no write. No `.current/.config.json` key and no `tools/config.ts` change (human Q3 (B)).
  proof: `node --test --test-name-pattern "^AC8" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC9** — Given a human starts work by a tracker number that has a ticket file (its `source` field or the tracker map lists it), when the lane's coordinator takes the request, then it works from the ticket file and, where the item's content differs, keeps to the file and reports the difference: `content/coord-01-core-head.md` carries `C-CO1` as its own paragraph directly after the unchanged no-ticket-file paragraph (`A tracker number (an issue or work-item id) with no ticket file → …`, byte-identical; `test/e433-test-first-rules.test.mjs` stays green) and before `## Auto-Routing`; the served `teamwork` prompt contains `C-CO1`.
  proof: `node --test --test-name-pattern "^AC9" test/e428-tracker-mirror.test.mjs test/e433-test-first-rules.test.mjs` exits 0.
- **AC10** — Given a ticket cut from a tracker item, when work starts and again before each code-reviewer dispatch (so before the code-reviewer PASS), then the coordinator compares the item's current revision with the recorded one and reports a change, never copying it into the ticket file: `C-CO1` sentence 2, and `C-TF1` bullet 4.
  proof: `node --test --test-name-pattern "^AC10" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC11** — Given tracker content that differs from the ticket file, when any role meets it, then the file wins and the difference is reported, never read back: `C-TF1` bullet 1, `C-IN1` bullet 4, `C-CO1` sentence 1.
  proof: `node --test --test-name-pattern "^AC11" test/e428-tracker-mirror.test.mjs` exits 0.
- **AC12** — Given every line this lane adds or changes in `content/skill-spec-workshop.md`, `content/skill-integrator.md`, `content/coord-01-core-head.md` and `docs/ticket-format.md` (diffed against base text frozen in the test), when it is scanned, then it holds no URL (`://`), no repo-only path (only `<agc install>/…`, `git rev-parse --git-common-dir` and the file name `agc-tracker-map.md`), no bare ticket id other than the format doc's existing example ids `E900` and `E899`, no version label, no backtick-quoted error code, and no tracker vendor or product name (case-insensitive, whole-word deny list kept in the test, at least: jira, azure devops, azure boards, ado, github issues, gitlab, linear, asana, trello, youtrack, bugzilla, redmine, clickup, monday, notion, shortcut); the tracker actions are named by capability only (`create`, `update an item's state`, `add a comment`).
  proof: `node --test --test-name-pattern "^AC12" test/e428-tracker-mirror.test.mjs` exits 0, and `node --test test/e437-repo-only-paths.test.mjs test/error-code-contract.test.mjs` exits 0.
- **AC13** — Given the build is done, when the full suite runs, then it is green: `test/fixtures/compose-golden/skill-coordinator-monolith.txt` is re-captured (it holds coord-01; no other golden holds a touched file), the zero-headroom caps the Copy moves in `test/context-budget.test.mjs` (AC21 spec-workshop 1415, teamwork coordinator bundle 19559) are set to the measured values with one comment line each naming the Copy ids and the delta, the four unowned pins listed in *PM probe* (`e445` AC10, `e462` AC6, `e410` AC2 ×2, `e430` AC8) are re-pinned to the Copy, `GATE_REGISTRY` still has 33 entries and `UPDATE_STATE_GATE_PIPELINE` 17 steps, and no file outside the lane's owned set changed.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0, and `git diff --name-only 32e7f7e -- '*.ts' dist templates tools .current/.config.json docs/config.md docs/lane-protocol.md` prints nothing.

## Copy / Strings

Every row is `authored-here` from the E428 row (audit amendment items 2–5 win), §15.2 rulings 4 and 5, §15.3 and the wave's Q3 (B). All rows ship to every adopter: no repo-only path, no bare ticket id (the format doc's existing example ids `E900` and `E899` aside), no tracker vendor name, URL or internal project name; `<agc install>` = agc's install directory, as those files already define it. Placement is exact. The exact text of each row is the block of the same id below the table (each block's four-tilde fence belongs to this spec, not to the text; the three-backtick fence inside block `C-TF1` is part of the text).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| C-SW1 | block `C-SW1` — replaces, inside the `content/skill-spec-workshop.md` *Ticket files* bullet (the line starting `- **Ticket files** — written only by this role`), the sentence `` One ticket file maps to at most one tracker item; `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository. ``; the rest of the line is unchanged | authored-here — §11.4 ruling 11 and amendment (4): the one-item limit now counts only created items, so it moves into `C-SW2`; keeps both fragments `test/e423-spec-workshop.test.mjs` pins |
| C-SW2 | block `C-SW2` — a new `## Tracker mirror` section in `content/skill-spec-workshop.md`, between the last `## Outputs` bullet (`- After the approval row is written, commit …`) and `## Governance state`, one blank line before and after it | authored-here — E428 base text (create on request), §15.2 ruling 5 + amendment (4) (imported tickets, child items, one created item), amendment (3) (no write without a request; reads allowed), Q3 (B) (switch in the local map) |
| C-IN1 | block `C-IN1` — a new `## Tracker items` section in `content/skill-integrator.md`, between the *Your own commits* paragraph that closes Stage 6 and `## Git operations`, one blank line before and after it | authored-here — E428 base text (integrator updates state, stop reason, pull-request reference), §15.2 ruling 4 + amendment (2) (question drafted for mirrored and imported items alike), Q3 (B); placed after Stage 6 because the updates span stages 3–6, and so that the line-numbered pins up to line 191 and the `### Sessions outside a lane` → `## Stage 5` adjacency stay put; amended after review round 1 (F1): the intro and bullets 2–3 also count an item the ticket file's `source` field lists, rewritten inside the same lines (the section stays 9 lines) |
| C-CO1 | block `C-CO1` — a new paragraph in `content/coord-01-core-head.md`, directly after the unchanged paragraph that starts `A tracker number (an issue or work-item id) with no ticket file → reply only with`, one blank line between them, and before the blank line and `## Auto-Routing` | authored-here — amendment (5) (the lane's coordinator resolves a tracker number at work start; the compare runs before the code-reviewer PASS; the coord fragment does the resolve), §15.3 (compare before work and before acceptance, report only) |
| C-TF1 | block `C-TF1` — a new `## Tracker mirror` section (with its `### Tracker map` subsection) in `docs/ticket-format.md`, between `## Where ticket files are listed` (its paragraph unchanged) and `## Named tests checked in CI`, wrapped at the doc's width exactly as shown | authored-here — §11.4 rulings 9 and 11, §15.2 rulings 4 and 5, §15.3, amendment (2)–(4), Q3 (B); location precedent: agc's install guide already keeps a never-tracked per-repository file (the hygiene keyword list) directly in the git common directory; placed before `## Named tests checked in CI` so the `Named tests → Batch summary → Example ticket` order and the closing tooling section stay as pinned; amended after review round 1 (reviewer nit): bullet 2 names which source item a child item goes under, rewrapped inside the same three lines |

Block `C-SW1`:

~~~~
`source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository, where the tracker map holds the item instead (*Tracker mirror*).
~~~~

Block `C-SW2` (the paragraph is one line):

~~~~
## Tracker mirror

Only when the human asks for it in this session; without that request write nothing to any tracker (reading the items the human names stays allowed). After the approval row is written, use the host's own tracker tools to create one item for each ticket file that has none, holding the ticket's id, title and file path and saying the file is the record. A ticket cut from a tracker item gets no new item: its source item stands for it, and one child item under that source item per ticket file is created only when the human asks. A ticket file never gets a second created item; the items it was cut from do not count. Record each created item in the tracker map, by number, never a link: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked. Its `write-back` switch, which lets the integrator update source items, stays `off` unless the human turns it on. Format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*.
~~~~

Block `C-IN1` (the paragraph and each bullet are one line):

~~~~
## Tracker items

Only a ticket with a tracker item gets tracker writes: an item its ticket file's `source` field lists, or a row in the tracker map — `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked (format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*). No item, no write. Use the host's own tracker tools (update an item's state, add a comment):

- **`mirror` or `child` row** — update that item as the ticket moves: in progress at dispatch; at a stop, the stopped state and the reason after `stopped — `; the pull request's number once it is open; done at merge.
- **Source item** (one the ticket file's `source` field lists, or a `source` row) — the same updates to each, only when the map's `write-back` line reads `on`, whether or not the map has a row for the ticket. It is off by default; only the human turns it on.
- **A stop's question** (the ticket's `## Open question`) is never posted, whatever the item: draft it in your report; the human decides whether to post it.
- **One way only** — never copy tracker content into a ticket file. Where an item and its ticket file differ, the file wins; report the difference.
~~~~

Block `C-CO1` (one line):

~~~~
A tracker number that has a ticket file (the file's `source` field lists it, or the tracker map does: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints) → work from the ticket file; where the item's content differs from it, keep to the file and report the difference to the human. For a ticket cut from a tracker item, compare the item's current revision with the recorded one at work start and again before each code-reviewer dispatch; report a change, never copy it into the ticket file. Only read the tracker; never write to it.
~~~~

Block `C-TF1`:

~~~~
## Tracker mirror

The ticket file is the record. A team that also wants its tickets on an issue tracker may ask for a one-way
mirror; nothing is mirrored unless a person asks for it.

- Direction is fixed, repository to tracker. Content edited on the tracker is never read back into a ticket
  file; when an item and its ticket file differ, the file wins and the difference is reported to a person.
- A ticket file gets at most one tracker item created for it: a mirror item, or, for a ticket cut from
  items, one child item under one of them, chosen by the person who asks for it. The items a ticket was
  cut from (its `source`) are not counted, and a ticket cut from an item gets no mirror item.
- A ticket file holds tracker item numbers only in its `source` field, never a link; in a public repository
  it holds none. Every other number, and in a public repository the source items too, goes in the tracker map.
- Before work starts and again before acceptance, a source item's current revision is compared with the
  recorded one; a change is reported to a person, never copied into the ticket file.
- Writing to a source item (its state, stop reason and pull-request number) is off unless the tracker map
  turns it on. A stop's open question is never posted by a tool: it is drafted for a person to post or not.
- Without a mirror request nothing is written to a tracker. Reading an item and comparing its revision stay
  allowed.

### Tracker map

The tracker map is a local file named `agc-tracker-map.md`, directly in the directory that
`git rev-parse --git-common-dir` prints. That directory is git's own storage, so git never tracks the file
and no ignore rule is needed, and every linked worktree of the repository reads the same file. It does not
travel with a clone. Never keep it in the working tree. For example:

```
write-back: off

| ticket | item | kind | revision |
|---|---|---|---|
| E900 | 1234 | source | 7 |
| E899 | 1240 | mirror | — |
```

- `write-back` is `on` or `off`. A missing file, a missing line or any other value means `off`; only a
  person turns it on.
- Each table row pairs one ticket id with one tracker item number, never a link. `kind` is `source` (an
  item the ticket was cut from), `mirror` (the item created for the ticket) or `child` (the item created
  for the ticket under its source item). `revision` is a source item's revision when the ticket was written,
  and `—` for the other kinds.
- A ticket has at most one `mirror` or `child` row.
~~~~

### Cut decisions recorded here (no option for the human)

- **Map location `agc-tracker-map.md` directly in `git rev-parse --git-common-dir`.** Needed by Q3 (B) ("untracked local file") and amendment (5) (a lane's coordinator resolves tracker numbers): a file in the working tree would be visible only in the checkout that wrote it, while lanes run in linked worktrees. The git common directory is shared by every linked worktree and is never tracked, so adopters add no `.gitignore` or `info/exclude` rule; it does not travel with a clone (each clone keeps its own, like `info/exclude`). `.current/` was rejected: some workspaces track it (`artifacts: "repo"`). Precedent: `docs/install.md` already places the hygiene keyword list there.
- **Mirror- and child-item numbers live only in the map, in every repository.** The ticket format refuses any field it does not define, and `tools/ticket-file.ts` / `templates/ticket.md` are out of scope, so no new field is possible; the recording rule ("may hold the number only") is satisfied by holding none. The tracker item itself names the ticket file's path, so the link exists from the tracker side. Source-item numbers keep using the existing `source` field in private repositories.
- **The revision compare before acceptance stays in `content/coord-01-core-head.md`** ("before each code-reviewer dispatch"): the coordinator dispatches code-reviewer, so the compare lands before the PASS without touching `content/skill-code-reviewer.md` or `content/coord-07-core-sop.md` (both forbidden by the manifest).
- **Source items with write-back on get the same updates as mirrored items** (state, stop reason, pull-request number). §15.2 ruling 4 names state and PR number at completion; the E428 row names state, stop reason and PR reference for the integrator's updates; the stop question is drafted, never posted, for both (amendment (2)).

### Amendment after review round 1 (2026-11-26)

Finding F1 (code-reviewer round 1, `review_reports/review_T-E428-01.md`): in a private repository a source item sits only in the ticket file's `source` field (`C-TF1` bullet 3), while the approved `C-IN1` wrote only for tickets with a tracker-map row ("No row, no write."), so `write-back: on` never reached a source item there, contradicting the ticket ("enabled per workspace") and cut decision 4 above. The coordinator's `C-CO1` already resolves from either place; only the integrator missed the `source` field.

- **Fix: option (a), recommended; the human picks (a) or (b) in the lane session.** (a) `C-IN1` counts an item the ticket file's `source` field lists as a tracker item, mirroring `C-CO1` (`source` field or map): the intro, bullet 2 (renamed **Source item**: "the same updates to each … whether or not the map has a row for the ticket") and bullet 3 ("whatever the item") are rewritten inside their own lines. The map stays the only place for mirror and child numbers and for public-repository source numbers; the ticket file stays the record. `content/skill-integrator.md` keeps 269 lines and sits in no golden and under no cap, so the e410/e430 line pins and every re-baselined artifact stay put; no planned return. (b) The alternative: `C-TF1` bullet 3 and `C-SW2` also record source items in the map, in every repository, whenever a mirror is asked for, making the map the integrator's only input. It moves the spec-workshop cap and the e445/e462 frozen text, needs a second planned return (about two more hops), and keeps private-repository source numbers in two places. Both satisfy the ticket; they differ in where an adopter's source numbers live, so the choice is the human's. This spec, the tasks and the probe below are written for (a); choosing (b) sends the cut back to pm.
- **Reviewer nit (optional), fixed in-lane:** `C-TF1` bullet 2 said "one child item under that item" although `source` is a list; it now reads "for a ticket cut from items, one child item under one of them, chosen by the person who asks for it", rewrapped inside the same three lines (widths 102/103/93). The same phrase in `C-SW2` ("under that source item") is left as is: changing it moves the spec-workshop cap and the e445/e462 frozen text; listed for the closing report, not done.
- **ACs changed:** AC2 (several source items), AC3 (`No item, no write.`), AC7 ("whatever the item"), AC8 (private-repository case: `source: [1234 rev 7]`, no map row, `write-back: on` → the integrator updates item 1234; `off` or missing → no write). No other AC changes; AC12's scan covers the amended lines as written.
- **Amendment probe** (same method as the *PM probe* below: the two files backed up to `$TMPDIR`, the amended `C-IN1` and `C-TF1` applied, `node scripts/test-lock.mjs -- npm test`, files copied back, `git status --porcelain` empty before this spec was edited): 4791 tests, 4782 pass, 7 fail, 2 skipped (exit 1). Every red is in `test/e428-tracker-mirror.test.mjs` (owned): AC2, AC3, AC5 (format text), AC6, AC7, AC8, AC12; each holds the approved Copy constants (`IN_INTRO`, `IN_B`, `C_TF1`) or rebuilds the base from them. No red in `context-budget`, `skill-manifest` (golden), `e445`, `e462`, `e410`, `e430`, `e423`, `e425`, `e455` or any other reader, so no re-pin and no re-baseline is planned.
- **Tasks and hops:** T-E428-06 (qa-engineer: update the e428 Copy constants and the AC2/AC3/AC7/AC8 assertions, add the AC8 private-repository case, refresh the expected-red manifest) → T-E428-07 (sr-engineer: apply the amended `C-IN1` and `C-TF1` byte-exact, full suite green, hand to code-reviewer). From `hop_count` 6: pm (7) → qa-engineer T-E428-06 (8) → sr-engineer T-E428-07 (9) → code-reviewer (10); a separate coordinator `cut_approved` write makes it 11. `sr_return` stays 1 of 2 (no planned return). Option (b) would add a planned return and a re-baseline hop (about 12 to 13). Hop cap 14.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any `.current/.config.json` key, `tools/config.ts`, `docs/config.md` (human Q3 (B)).
- `tools/ticket-file.ts`, `templates/ticket.md`, any new ticket field; the `source` row of the field table is unchanged.
- Any server, gate, error-code, `GATE_REGISTRY` (33) or `UPDATE_STATE_GATE_PIPELINE` (17 steps) change; any `.ts` or `dist/**` change.
- The E443 lane launcher and its coord-03 line; `docs/lane-protocol.md`; E420.
- Pulling items from a tracker automatically (§15.2 ruling 6); tracker writes outside a wave run by the integrator (a plain `/teamwork` chain reads the tracker only).
- A script or tool that reads or writes the tracker map; the map is read and written by the roles through the host's tools.
- `content/skill-code-reviewer.md`, `content/coord-07-core-sop.md`, `content/skill-pm.md`, every other `content/**` and `docs/**` file.

## Dependencies / Prerequisites

No `design/e428-tracker-mirror.md`: mode no-design, so Visual Structural Assertions are omitted. No ticket file for E428 (no `docs/tickets/`), so this spec carries Given/When/Then ACs with `proof:` lines. Resource audit: the backlog row, the manifest and the discussion file cite only tracked in-repo documents; the grep hits for `tracker`, `link`, `URL` are the subject matter, not external references; no URL, design file or external ticket — `external_refs` is empty. Dependencies E422, E423, E425 are done-marked and on `main` (manifest pre-dispatch check). Not bugfix mode.

**Shipped-text constraints checked at the cut.** `content/**` and `docs/ticket-format.md` ship to every adopter: the Copy cites only `<agc install>/docs/ticket-format.md`, the command `git rev-parse --git-common-dir` and the file name `agc-tracker-map.md` — no repo-only path, no URL, no vendor name; the only ticket ids are the format doc's existing example ids `E900` and `E899`. The served `teamwork` text carries `C-CO1` verbatim (no origin or rationale fence in it). `cutApprovalAutoTier`, `GATE_REGISTRY` (33) and the pipeline (17 steps) are untouched; no `.ts`, `dist/**`, `templates/**` or config file is in any task.

**PM probe (full suite, `node scripts/test-lock.mjs -- npm test`, run in the worktree).** The four shipped files were copied to a scratch backup, every Copy block was applied, the suite ran, and the files were copied back from the backup; afterwards `git diff --stat` is empty and `git status --porcelain` shows only `.current/e428/` and this spec. A first draft (the integrator section as `### Tracker items` at the end of Stage 4, the format section between `## Batch summary` and `## Example ticket`, the second example id `E901`, and `C-SW1` without the literal `empty in a public repository`) turned 12 tests red; four of those were placement or wording collisions — `test/e423-spec-workshop.test.mjs` AC9 (`empty in a public repository` fragment), `test/e425-stop-ticket-batch.test.mjs` AC6 (`Named tests → Batch summary → Example ticket` adjacency), `test/e430-mailbox-outside-lane.test.mjs` AC1 (`### Sessions outside a lane` → `## Stage 5` adjacency), `test/e455-ticket-checker-strict.test.mjs` AC8 (explanations allow only `E900`/`E899`) — and the final Copy places and words the text so all four stay green; `test/e410-task-alias-content-tail.test.mjs` line 187/191 pins also stay put. With the final Copy: 4778 tests, 4768 pass, 8 fail, 2 skipped (exit 1). The base was not re-run in this probe; 4778 = 4768 + 8 + 2, and every red below is caused by the Copy. Red test files, one by one:

| test file | red tests | why it turns red | reader of a touched file (manifest literal-grep table)? | in the owned set? | fixed by |
|---|---|---|---|---|---|
| `test/context-budget.test.mjs` | 2 | zero-headroom caps: AC21 spec-workshop stripped 1415 → 1663 (+248: `C-SW1`, `C-SW2`); teamwork coordinator bundle (design arm) 19559 → 19699 (+140: `C-CO1`) | yes | yes | T-E428-04 re-baseline |
| `test/skill-manifest.test.mjs` | 1 (`t-golden-byte-identity`) | the frozen coordinator monolith golden holds coord-01 | yes (coord-01 through composition) | its golden `test/fixtures/compose-golden/skill-coordinator-monolith.txt` is; the test file is not edited | T-E428-04 re-capture |
| `test/e445-spec-workshop-questioning.test.mjs` | 1 (AC10 unchanged sections) | freezes the base SOP outside steps 2–5 byte for byte (`BASE_SOP`); `C-SW1` changes the *Ticket files* bullet and `C-SW2` adds a section. Its own header comment says a later tracker-mirroring edit must re-pin it | yes | **no** → integrator pre-review, standing unowned-red-file rule | T-E428-01: re-pin `BASE_SOP` to the Copy text with a re-pin comment (red until T-E428-02) |
| `test/e462-stale-comments-wording.test.mjs` | 1 (AC6 "no other line of the SOP changes") | freezes the whole spec-workshop SOP (`FROZEN_SW_SOP`) | yes | **no** → integrator pre-review | T-E428-01: re-pin `FROZEN_SW_SOP` to the Copy text with a re-pin comment (red until T-E428-02) |
| `test/e410-task-alias-content-tail.test.mjs` | 2 (AC2 site row, AC2 line count) | pins `content/skill-integrator.md` **by line number**: the row at line 260 (`is not a subagent,`) moves to 269, and the file count 261 → 270 (`C-IN1` adds 9 lines after line 218; the pins at lines 40/41/78/81/187/191 do not move) | yes | **no** → integrator pre-review | T-E428-01: re-pin 260 → 269 and 261 → 270 with a one-line re-pin comment like the E425/E430 ones (red until T-E428-03) |
| `test/e430-mailbox-outside-lane.test.mjs` | 1 (AC8 line count) | asserts `content/skill-integrator.md` has 260 newlines; `C-IN1` makes it 269 | yes | **no** → integrator pre-review | T-E428-01: re-pin 260 → 269 with a re-pin comment (red until T-E428-03) |

No other red. In particular these readers stay green with the final Copy: `e423-spec-workshop` (both `source` fragments, the composed coordinator's design-source section), `e433-test-first-rules` (the no-ticket-file tracker line byte-identical), `e425-stop-ticket-batch` (format section order, stopped-batch-lane bullet), `e422-ticket-format-doc`, `e427-ticket-format-doc`, `e455-ticket-checker-strict`, `e424-per-scenario-acceptance`, `e426-ticket-scenarios-fixed`, `e430-mailbox-outside-lane` AC1, `e437-repo-only-paths`, `e453-served-text-v5`, `error-code-contract`, every other integrator reader (27 files) and every other coord-01 reader (8 files). The four unowned red files are all frozen-text or line-number pins on owned files, red only because of this lane — they go to the integrator's cut pre-review under the standing rule (green at base, red under the Copy), and their re-pins are planned in T-E428-01.

**Shared-artifact plan (wave rule R3 (b)).** Goldens and caps exist only after the edits: after T-E428-03, the last implementation task, sr-engineer makes one planned return to qa-engineer (`sr_return` 1 of its cap 2); qa-engineer runs T-E428-04 (re-capture `skill-coordinator-monolith.txt`, set the two moved caps to the measured values — expected 1663 and 19699 if the Copy lands verbatim — with one comment line each naming the Copy ids and the delta, and explain every golden hunk in its report), then hands back to sr-engineer, which runs T-E428-05 and hands to code-reviewer. Comment discipline: each new or changed comment block in a test file stays within seven lines.

**Hop estimate (current `hop_count` 1, the coordinator's opening write).** pm (this write, 2) → qa-engineer T-E428-01 (3) → sr-engineer T-E428-02 + T-E428-03 in one hop, planned return (4) → qa-engineer T-E428-04 (5) → sr-engineer T-E428-05 (6) → code-reviewer PASS (7). The coordinator's `cut_approved` attestation write, if it is a separate write, makes it 8; sr writing T-E428-02 and T-E428-03 as two hops adds 1. One review round of rework adds 2–3 (code-reviewer → sr-engineer → code-reviewer, or via qa-engineer): 10–12. All within the hop cap 14; the planned return is counted.

## Gate Summary and Task Budget Map

Gate Summary: `scope_decision` single-feature — one ticket, one lane, one cut by the human's wave ruling (manifest Decisions 2026-11-26); no design source (`design-link` `—` throughout); `external_refs` empty; feature mode (no `dispatch_mode`); `next_role` qa-engineer, no architect (no gate, pipeline, schema or `.ts` change). No `chain_path` field is set.

**Task Budget Map** (every sr task is two files and well under the `task_size` budget of 5 files / 300 lines; T-E428-04 is a qa task — goldens are captured, not hand-written). Order: qa T-E428-01 → sr T-E428-02 → sr T-E428-03 → planned return → qa T-E428-04 → sr T-E428-05 → code-reviewer judges all five ids. Every AC has an implementing task: AC1, AC2, AC3 (spec-workshop + format parts), AC4, AC5 → T-E428-02; AC3 (integrator + coordinator parts), AC6, AC7, AC8, AC9, AC10, AC11 → T-E428-03 (AC7, AC8, AC10, AC11's format-doc sentences are in `C-TF1`, built by T-E428-02); AC12 → T-E428-02 and T-E428-03 (each task's own strings); AC13 → T-E428-02/03 (content), T-E428-04 (artifacts, re-pins), T-E428-05 (bounds and full-suite confirmation). After review round 1: qa T-E428-06 → sr T-E428-07 → code-reviewer judges all seven ids; AC2, AC3, AC7, AC8 (amended) and AC5, AC6, AC12 (Copy constants) → T-E428-06 (tests) and T-E428-07 (text); T-E428-07 is two files, inside the `task_size` budget.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E428-01 | qa-engineer: write AC1–AC12 as tests in `test/e428-tracker-mirror.test.mjs` (red at base; AC4's e423 fragments and AC9's e433 line are green at base and stay so), list the reds in `qa_reports/expected-red_e428-tracker-mirror.txt`; re-pin every frozen-base pin the *PM probe* table assigns to T-E428-01 to the Copy text (red until T-E428-02/03; integrator-assigned under the standing unowned-red-file rule); test report with the Scenario → Test Map | none | 5 | `test/e428-tracker-mirror.test.mjs`, `test/e445-spec-workshop-questioning.test.mjs`, `test/e462-stale-comments-wording.test.mjs`, `test/e410-task-alias-content-tail.test.mjs`, `test/e430-mailbox-outside-lane.test.mjs` | — |
| T-E428-02 | sr-engineer: spec-workshop and ticket format text — `C-SW1`, `C-SW2` in `content/skill-spec-workshop.md`; `C-TF1` in `docs/ticket-format.md` (AC1, AC2, AC3, AC4, AC5, AC7, AC8, AC10, AC11, AC12) | T-E428-01 | 2 | `content/skill-spec-workshop.md`, `docs/ticket-format.md` | — |
| T-E428-03 | sr-engineer: integrator and coordinator text — `C-IN1` in `content/skill-integrator.md`; `C-CO1` in `content/coord-01-core-head.md` (AC3, AC6, AC7, AC8, AC9, AC10, AC11, AC12); last implementation task → the planned return to qa-engineer | T-E428-01 | 2 | `content/skill-integrator.md`, `content/coord-01-core-head.md` | — |
| T-E428-04 | qa-engineer (planned return): re-capture `test/fixtures/compose-golden/skill-coordinator-monolith.txt`; set the AC21 spec-workshop cap and the teamwork coordinator bundle cap in `test/context-budget.test.mjs` to the measured values with one comment line each (Copy ids, delta); explain every golden hunk in the test report (AC13) | T-E428-02, T-E428-03 | 2 | `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | — |
| T-E428-05 | sr-engineer: confirm nothing is left to build — full suite green, every `expected-red` entry green, `git diff --name-only 32e7f7e` inside the owned set and nothing under `*.ts`, `dist`, `templates`, `tools`; hand to code-reviewer (AC13) | T-E428-04 | 0 | — | — |
| T-E428-06 | qa-engineer (amendment after review round 1): update `test/e428-tracker-mirror.test.mjs` to the amended `C-IN1` and `C-TF1` (Copy constants; AC2, AC3, AC7, AC8 assertions; the AC8 private-repository case), list the reds in `qa_reports/expected-red_e428-tracker-mirror.txt`, update the Scenario → Test Map in the test report; no other test file moves (amendment probe) | T-E428-05 | 1 | `test/e428-tracker-mirror.test.mjs` | — |
| T-E428-07 | sr-engineer (amendment after review round 1): apply the amended `C-IN1` in `content/skill-integrator.md` (same 9 lines, file stays 269 lines) and `C-TF1` bullet 2 in `docs/ticket-format.md` (same 3 lines) byte-exact; full suite green, every expected-red entry green, diff vs `32e7f7e` inside the owned set; hand to code-reviewer (AC2, AC3, AC7, AC8, AC12, AC13) | T-E428-06 | 2 | `content/skill-integrator.md`, `docs/ticket-format.md` | — |
