# e423-spec-workshop

Backlog ticket E423 (`docs/backlog.md` E423 row: the body, the 2026-11-18 addendum, the 2026-11-19 audit
amendment items 1–5 and the ruling-16 amendment; the audit amendment wins where it conflicts with the body).
Fan-out lane `e423` of `specs/fanout-v5-w2.md` (row, ownership split, test-file allocation and ruling 1 = (a)
are human-approved there and are not re-asked here). Rulings this cut implements:
`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` §11.4 rulings 3, 7, 8; §11.5; §15.2 rulings 1–3 and 6;
§15.3 (the E423 row and the entry-condition points); §16.1 rulings 9, 10 and 16. Ruling 18 (§16.1): merges to
`main`, ships only in v5.0.0 with E435 — no release in this lane.

## Problem Statement

The only planning step today is the pm role's single-pass cut: the human first sees acceptance scenarios when
approving the cut, and the multi-round question-and-ruling work that a large feature, a design source or an
issue-tracker item needs happens ad hoc, with rulings reconstructed after the fact. There is also no route for a
design-tool prototype export: the coordinator does not detect it, the design-auditor has no mode for it, and the
server silently leaves the visual checks unarmed when a design file declares a mode it does not recognise
(adopter B: 4 of 5 prototype-sourced design files declared `mockup` or a dual-source prose line and were left
unarmed). This ticket adds a thirteenth, prompt-only role `spec-workshop` that runs that discussion with the
human in the session and writes dated rulings, ticket files in the tool-neutral ticket format and a compact wave
table with the human's approval row; lets the integrator's Stage 2 stand on that committed approval when its
conversion changes nothing; routes local prototype exports (no ticket file → `spec-workshop` hint, ticket file →
design-auditor); adds the design mode `prototype` with the Figma + prototype dual-source rule; and makes the
server arm the visual checks for a declared but unrecognised mode and name the value.

## User Stories

- As the operator, I want a role I start myself that turns a spec, design source, issue-tracker item or bare idea
  into rulings recorded as they are made, so that the scenarios I approve are the ones I actually ruled on.
- As the operator, I want one run to take several tracker item numbers and produce ticket files plus one wave
  table that I approve once, so that the integrator can fan the wave out without asking me again when it
  changes nothing.
- As the operator with a small, clear tracker item, I want a one-pass short form, so that a small bug does not
  cost a multi-round discussion.
- As the integrator, I want a stated rule for when a committed `spec-workshop` approval covers Stage 2, so that I
  neither halt needlessly nor relay an approval the rules forbid.
- As the coordinator, I want local prototype exports detected as design sources and routed by whether a ticket
  file exists, so that untriaged prototypes go to discussion first.
- As the design-auditor, I want a `prototype` mode and a dual-source rule, so that a Figma file and a prototype
  that disagree produce ruling items instead of a silent pick.
- As an adopter, I want a design file whose declared mode the server does not recognise to arm the visual checks
  and name the value, so that a typo or an invented mode never silently skips visual verification.

## Decisions (each needs human approval with this cut)

| # | decision | choice | why |
|---|---|---|---|
| D1 | `recommended_model` for `spec-workshop` | `opus` | Multi-round reasoning over conflicting sources with the human present; the same tier as `integrator`, the other prompt-only cross-cutting role. Bulk reading is delegated to subagents, so the strong tier is spent on judgment only. |
| D2 | Architect hop | **not needed** — chain pm → sr-engineer → code-reviewer → qa-engineer | Two code modules only (`gates/visual.ts` one parser function; `prompts/spec-workshop.ts` + one `PROMPT_REGISTRY` row, a copy of the `integrator` pattern). No new data model, no new error code, no orchestrator or gate-registry change (forbidden anyway); everything else is SOP text and doc counts. Below the ≥ 3 modules / new data model / cross-cutting API threshold. |
| D3 | Unrecognised declared mode | A candidate Mode line whose declared token is not a known mode (and not `<known>-…`) no longer yields nothing: the parser remembers the FIRST such token and returns it only when no candidate yields a known mode. A known mode on any candidate still wins (AC-E384-6 behaviour kept). Lines with no declared token keep the earliest-known-mode scan; a line with neither stays undeclared (`null`). The returned unknown value is the token, cut to its first 40 characters plus `…` when longer (bounds the rejection text). `hasDesignModeRequiringVisual` is unchanged (`required = mode !== null && mode !== "no-design"`), so an unknown mode arms every check that reads it — the PASS-time visual gates, `SCOPE_DECISION_REQUIRED` and the design-armed constitution composition in `prompts/build.ts`. `checkSourceCredibility` keeps its fetch-based inclusion list, so an unknown mode never arms the Figma-only check (E384 protection unchanged). | Ruling 10 ③. The rejection already prints `mode=${armCheck.mode}` (`tools/handoff-orchestrator.ts`, VISUAL_BASELINES_REQUIRED / VISUAL_ASSERTIONS_REQUIRED), so naming the value needs no orchestrator change and no new code. Adopter-visible: a design file declaring e.g. `code (not from Figma)` now arms the visual checks — intended (ruling 10), noted for the v5.0.0 CHANGELOG by release-engineer. |
| D4 | `prototype` in the parser | Add `"prototype"` to `KNOWN_MODES`; NOT to `FETCH_BASED_MODES`. | Ruling 10 ②: the source-credibility check does not apply (every prototype page is a full screen); the volume check is SOP-level and applies only when the remote project is readable. |
| D5 | Dual-source declaration | A design with a prototype export AND a Figma source declares mode `prototype` and lists both media in `## Source`. Figma fixes which states exist; the prototype fixes how each behaves; every divergence is a ruling item (in `spec-workshop` before a ticket file exists; a design-auditor STOP after). The design-auditor still runs its step-2b classification on the Figma rows (SOP), but the server's credibility check keys on the declared mode and stays dormant for `prototype`. | One declared mode per design file (the parser reads one); ruling 10 ② names `prototype` as the mode for these sources. |
| D6 | Coordinator routing scope | The new detection and the no-ticket-file hint cover **local prototype exports only**. Other design sources (Figma URL, images, …) route to design-auditor as today. With no ticket file the coordinator replies only with the hint and stops (no chain), mirroring §15.2 ruling 2's "reply only" form. | The human-approved lane scope line ("coordinator 的設計來源偵測涵蓋本機原型匯出") and the ticket body ("widens the coordinator's design-source detection to local prototype exports"). The general "no ticket file → `spec-workshop`" coordinator line for tracker items is E433's (§15.3 table), not this ticket's. |
| D7 | Where `spec-workshop` writes | Discussion record default `docs/discussions/<YYYY-MM-DD>-<topic>.md` (the human may name another path); it holds the rulings table, the compact wave table and the approval row. Ticket files go in the workspace's ticket directory (`ticketDir` in `.current/.config.json`, default `docs/tickets/`). After the approval row is written, `spec-workshop` commits the record and the ticket files together per the repository's commit rules (branch + pull request where `main` is protected), so the integrator can cite the commit. | Ruling 9 names "the approval already committed in `spec-workshop`"; the integrator needs a file and a commit sha to cite. |
| D8 | Integrator exception wording | Appended to `content/skill-integrator.md` Stage 2 as a new paragraph; existing sentences stay byte-identical. Any change to tickets, grouping or order, or any open choice, halts as today; the SOP does not mention a later relaxation (ruling 16's mechanical check is E443's to add). On the no-halt path the integrator writes two Decisions rows: `人類` (出處 = the wave-table file + its commit sha) and `整合者` (the conversion changed nothing). | Ruling 9 + ruling 16 ("until E443 lands, any change halts"). A `人類` Decisions row is what `fanout.mjs check --cut` and the manifest tier consume. Shipped `content/**` cites no backlog ids. |
| D9 | Context-budget caps | NEW test entry `skill-spec-workshop stripped token count ≤ N`, measured like the pm cap (`stripRationale(stripOriginTags(expandSkill(body)))`, frontmatter stripped), N = measured value, zero headroom (E336/E365 convention). Not measurable now (file does not exist) — qa measures after T-E423-02 and writes the number into the test and its evidence (T-E423-07). The teamwork coordinator bundle cap (18465 today) grows by the coord-01 addition — qa re-baselines it to the measured value, zero headroom, with a history comment. No other cap moves: no `const-*.md` is edited, and `skill-integrator.md` / `skill-design-auditor.md` have no cap. | Manifest "交給各 lane 的 PM" item for e423. |
| D10 | Golden re-capture | Only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` changes (coord-01 text). The eight `build-*` goldens, `constitution-monolith.txt` and the two `hook-*` goldens capture the constitution (+ lite skill) only and do not change. No per-role golden exists, so the new prompt gets none (`test/e90-golden-capture-completeness.test.mjs` stays green). qa re-captures via `node scripts/capture-constitution-golden.mjs` and explains each hunk in the evidence. | §16 audit "no per-role compose golden exists, coord-01 text lives in `skill-coordinator-monolith.txt`". |
| D11 | `CLAUDE.md` edits | 8 lines change in place, **0 lines added, 0 removed** → total stays 250, no merge needed. Lines 7, 10, 33, 38, 41, 42 (header + layer-1 prompt list) and 122, 130 (Layout rows). Pinned lines 13, 44, 64, 195, 220, 221, the `agc-version` stamp and the e395 11-row block are untouched. Exact new text in *Copy / Strings* (`claude.*`). | Manifest: total 250, e436 / e395 green, e178a:208–213 sentences re-pinned by qa. |
| D12 | `docs/architecture.md` range | (a) Change line 18 (count) **and** re-flow lines 20–21 (the prompt-name list inside the same box) so the list names `spec-workshop`; the box gains no line and keeps its 60-column interior (`arch.L20`, `arch.L21`; line 19 unchanged). **needs human ruling** — the manifest gives e423 line 18 only and e431 "line 18 以外"; lines 20–21 are far from e431's sections (37, 47, 67–99, 128, 242–243), so no merge conflict is expected. (b) Change line 18 only and leave the name list one prompt short. Recommendation: (a). | A count of 13 over a list of 12 is a stale fact the next audit would flag. |

## Acceptance Criteria

**A. Prompt registration**

- **AC1** — Given the built server, when `PROMPT_REGISTRY` is read, then it has 13 entries, the first 12 are
  unchanged in order and content, and the 13th is `{ name: "spec-workshop", description: <prompt.description>,
  skillFile: "skill-spec-workshop.md", arguments: [workspace_path] }`.
  proof: `test/e423-*.test.mjs` (qa names it) — registry-entry test; plus the re-pinned `test/e178a-integrator-role.test.mjs` AC3.
- **AC2** — Given the server, when `prompts/list` is requested over stdio, then `spec-workshop` is listed with its
  description, and `prompts/get` for `spec-workshop` returns one message containing the constitution and the
  `# Skill: spec-workshop` body.
  proof: `test/e423-*.test.mjs` — stdio `prompts/list` + `prompts/get` test (pattern: `test/teamwork-lite.test.mjs` AC3).
- **AC3** — Given the `tw_switch_role` tool schema, when it is called with `role: "spec-workshop"`, then the input
  is rejected; and `tools/role.ts` and `tools/transitions.ts` do not mention `spec-workshop`.
  proof: `test/e423-*.test.mjs` — zod `safeParse` of the `tw_switch_role` registry entry fails + source scan.
- **AC4** — Given `prompts/spec-workshop.ts`, when read, then it exports `buildSpecWorkshopPrompt` as a thin
  `buildPromptForRole("skill-spec-workshop.md", …)` wrapper (the `prompts/integrator.ts` pattern), and no
  `templates/claude-code-agents/spec-workshop.md` exists.
  proof: `test/e423-*.test.mjs` — source match + `fs.existsSync` false.

**B. The `spec-workshop` SOP (`content/skill-spec-workshop.md`)**

- **AC5** — Given the SOP, when parsed, then its frontmatter carries `recommended_model: opus` and the skill-file
  count in `content/` is 13.
  proof: `node --test test/skill-frontmatter.test.mjs` (count re-pinned 12 → 13 by qa) and `test/e178a-integrator-role.test.mjs:463` regex re-pinned with it.
- **AC6** — Given the composed `spec-workshop` prompt (`buildPromptForRole("skill-spec-workshop.md", …)`), when
  rendered, then it contains every SOP step unit: the six numbered steps under `## Steps` (entry check; check what
  exists first; delegate bulk reading; ask in batches and record each ruling as made; done condition; end without
  filing) AND the `## Short form` section — seven step units in all, each found by its heading/anchor in
  *Copy / Strings* `sop.*`. (Counts the steps including the short form, not "exactly six" — §16.1 audit point 5.)
  proof: `test/e423-*.test.mjs` — composed-prompt anchor test over `sop.step1`…`sop.step6` + `sop.short-form`.
- **AC7** — Given the SOP body, when scanned, then it contains the `sop.no-handoff` prohibition line verbatim and
  no instruction to call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task`
  or `tw_sync` (any mention of these names is inside the prohibition line), and it states the role is not
  subagent-dispatched.
  proof: `test/e423-*.test.mjs` — SOP-body scan (the constitution part of the bundle is out of this AC's scope; it legitimately names `tw_update_state`).
- **AC8** — Given the SOP, when read, then its entry condition covers (a) a spec or design source to break down,
  (b) an idea that needs several rounds, (c) an issue-tracker item with no ticket file, whatever its size; it
  takes several item numbers in one run, never pulls items the human did not name, may cut one item into several
  tickets (and merge several into one), and sends work that fits one or two files and is not a tracker item to the
  ordinary coordinator intake.
  proof: `test/e423-*.test.mjs` — anchors `sop.entry.*`.
- **AC9** — Given the SOP, when read, then the outputs section names: the discussion record with a rulings table,
  each ruling dated as made and a replacing ruling naming the one it replaces; ticket files in the ticket format,
  written only by this role, `source` = `<item number> rev <revision>` and empty in a public repository; the
  compact wave table `| wave | ticket | depends on |`; the approval row `| date | decided by | content | source |`;
  and that the short form produces no wave table.
  proof: `test/e423-*.test.mjs` — anchors `sop.out.*`.
- **AC10** — Given the SOP, when read, then the done condition is: every scenario has one verification (automated
  test, command, or device-or-person), every device-or-person scenario sets `needs device or person: yes`, and
  every conflict between sources (including each Figma/prototype divergence) has a ruling; and the run may end
  with `not doing` or `not ready to cut` (listing the open questions) and file nothing.
  proof: `test/e423-*.test.mjs` — anchors `sop.done`, `sop.end`.
- **AC11** — Given `content/skill-spec-workshop.md`, `content/coord-01-core-head.md`,
  `content/skill-design-auditor.md` and `content/skill-integrator.md`, when scanned, then none cites a path that
  exists only in this repository: the ticket format and template are cited as
  `<agc install>/docs/ticket-format.md` and `<agc install>/templates/ticket.md` with the inline definition
  ``(`<agc install>` = agc's install directory, not the workspace)``; no `specs/<feature>`, `research/`,
  `docs/discussion-*`, `docs/backlog.md`, `tools/*.ts`, `gates/*.ts` or `scripts/*.mjs` path appears unprefixed
  in the added text; no backlog ticket id (`E\d{3}`) appears in the added text.
  proof: `test/e423-*.test.mjs` — repo-only-path scan over the added lines (pattern: `test/e437-repo-only-paths.test.mjs`).

**C. Integrator Stage 2 exception (`content/skill-integrator.md`)**

- **AC12** — Given the integrator SOP, when read, then Stage 2 carries the `integ.exception` paragraph: when the
  manifest was converted from a committed `spec-workshop` wave table and the conversion changes none of the
  approved tickets, their grouping or their order and leaves no open choice, Stage 2 does not halt, and the two
  Decisions rows (`人類` citing the wave-table file + commit sha; `整合者` stating nothing changed) are written;
  any change or open choice halts as before; it is named a stated exception to Constitution §3.1's rule against
  relayed approval. Every pre-existing Stage 2 sentence is byte-identical.
  proof: `test/e423-*.test.mjs` — anchor test + `node --test test/e288-integrator-stage0.test.mjs test/e296-manifest-tier.test.mjs` stay green.

**D. Coordinator design-source detection (`content/coord-01-core-head.md`)**

- **AC13** — Given the composed coordinator SOP, when a request cites a local design-prototype directory or
  exported `.html` page, then the *Design-source detection* section matches it (`coord.match-prototype`), and
  states: no ticket file → reply only with `coord.hint` and stop; ticket file present → route to `design-auditor`
  like any other design source. The existing match bullets and the "If ≥ 1 hit" paragraph are byte-identical.
  proof: `test/e423-*.test.mjs` — `composeSkill("skill-coordinator.md", …)` anchor test; `node --test test/design-auditor-volume-guard.test.mjs test/feature-scope-gate.test.mjs test/feature-split-lifecycle.test.mjs` stay green.

**E. Design mode `prototype` (`content/skill-design-auditor.md`)**

- **AC14** — Given the design-auditor SOP, when read, then the Mode list names `prototype`, the mode-detection
  table has the `da.detect-row` row, step 2a carries `da.volume` (runs only when the remote project is readable),
  step 2b carries `da.credibility` (skipped), step 3 carries `da.extract`, the dual-source rule `da.dual` is
  present, and the Escalation Routes table has the `da.escalation` row. The existing sentence
  `` `image`/`pdf`/`paper`/`no-design` skip this gate`` stays byte-identical in 2a and 2b.
  proof: `test/e423-*.test.mjs` — anchors `da.*`; `node --test test/design-auditor-volume-guard.test.mjs test/source-credibility-gate.test.mjs` stay green.

**F. Server mode parsing (`gates/visual.ts`)**

- **AC15** — Given a design file declaring `mode: prototype` (any of the inline, bullet or H2 forms), when the
  arm and credibility checks run, then `mode = "prototype"`, `required = true`, and `checkSourceCredibility`
  returns `ok: true` even with an audited row lacking `full-page-composite`.
  proof: `test/e423-*.test.mjs` — the `both()` helper pattern of `test/e384-design-mode-declared.test.mjs`.
- **AC16** — Given a design file declaring an unrecognised mode (`mode: mockup`, `- **Mode** — code (not from
  Figma)`, `## Mode` + `freehand`), when the arm check runs, then `mode` is that token (`mockup`, `code`,
  `freehand`), `required = true`, and `checkSourceCredibility.ok = true` (E384: the Figma-only check stays
  unarmed); a 100 000-character token returns its first 40 characters plus `…` and does not throw.
  proof: `node --test test/e384-design-mode-declared.test.mjs` (re-pinned by qa) + `test/e423-*.test.mjs`.
- **AC17** — Given a qa-engineer PASS write on a feature whose design file declares `mode: mockup` and has no
  `## Visual Baselines`, when `tw_update_state` runs, then it is rejected with `VISUAL_BASELINES_REQUIRED` and the
  text contains `mode=mockup`.
  proof: `test/e423-*.test.mjs` — end-to-end write test (pattern: `test/visual-gate-e2e.test.mjs`).
- **AC18** — Given the pre-existing behaviours, when the suite runs, then a known mode on a later candidate still
  beats an unknown earlier one (`## Mode\n\nfigma` + `- mode: dark` → `figma`), a line with no declared token
  still uses the earliest-known-mode scan (`mode: <figma> (see board)` → `figma`), no Mode line / no file / empty
  feature still give `mode: null, required: false`, and `mode: —` stays `null`.
  proof: `node --test test/e384-design-mode-declared.test.mjs test/visual-evidence-gate.test.mjs test/visual-gate-e2e.test.mjs test/baseline-manifest-gate.test.mjs test/pixel-gate-attestation.test.mjs test/source-credibility-gate.test.mjs`.

**G. Counts, docs, budget, goldens, suite**

- **AC19** — Given `CLAUDE.md`, when read, then it is 250 lines, carries `claude.*` text exactly, and
  `test/e436-stale-handoff-paths.test.mjs`, `test/e395-claude-md-tail.test.mjs` and the re-pinned
  `test/e178a-integrator-role.test.mjs` AC5 are green.
  proof: `wc -l < CLAUDE.md` prints `250`; `node --test test/e436-stale-handoff-paths.test.mjs test/e395-claude-md-tail.test.mjs test/e178a-integrator-role.test.mjs`.
- **AC20** — Given `README.md`, `docs/install.md`, `docs/architecture.md`, `CONTRIBUTING.md`, when read, then the
  prompt / single-file-role counts read 13 and `spec-workshop` is listed (`readme.*`, `install.*`, `arch.*`,
  `contrib.*`), with no stale `12 registered prompts` / `All 12` / `twelve single-file` / `11 prompts registered`.
  proof: `grep -nE 'All 12 registered|12 registered prompts|twelve single-file|11 prompts registered' README.md docs/install.md docs/architecture.md CONTRIBUTING.md` prints nothing.
- **AC21** — Given the context-budget test, when it runs, then the new `skill-spec-workshop` cap and the
  re-baselined teamwork bundle cap pass at their measured values with zero headroom (numbers in qa evidence).
  proof: `node --test test/context-budget.test.mjs`.
- **AC22** — Given the compose goldens, when the suite runs, then only `skill-coordinator-monolith.txt` differs
  from base and `test/skill-manifest.test.mjs` t-golden-byte-identity passes; qa evidence explains each hunk.
  proof: `git diff --stat <base>..HEAD -- test/fixtures/compose-golden/` lists only `skill-coordinator-monolith.txt`; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs`.
- **AC23** — Given the lane branch, when the full suite runs, then it passes (baseline total + new tests), no
  e431-owned test changed, and `dist/` contains only this lane's outputs (`dist/prompts/spec-workshop.*`,
  `dist/gates/visual.*`, `dist/tools/registry.*`).
  proof: `node scripts/test-lock.mjs -- npm test`; `git diff --name-only <base>..HEAD -- dist/`.

## Copy / Strings

All agent-facing prose is authored here (no PRD/Figma source); the rows below are the anchors tests pin. sr may
write surrounding prose freely within the AC shapes; the anchor text is exact.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| prompt.description | `Spec workshop — turn specs, design sources, issue-tracker items or an idea into dated rulings, ticket files and a wave table, in rounds with the human. Human-started; writes no handoff state.` | authored-here — mirrors the integrator description's "Cross-lane; writes no handoff state." shape |
| sop.title | `# Skill: spec-workshop` | authored-here — every SOP's H1 shape |
| sop.steps-heading | `## Steps` | authored-here |
| sop.step1 | `1. **Entry check**` | authored-here — §11.5 entry condition + §15.3 |
| sop.step2 | `2. **Check what exists first**` | authored-here — §11.5 rule "先查現況再提問" |
| sop.step3 | `3. **Delegate bulk reading**` | authored-here — §11.5 |
| sop.step4 | `4. **Ask in batches, record as you go**` | authored-here — §11.5 rule "裁定邊談邊落檔" |
| sop.step5 | `5. **Done condition**` | authored-here — §11.4 ruling 3 |
| sop.step6 | `6. **End without filing**` | authored-here — §11.5 rule "允許以「不做」或「還不能切」結束" |
| sop.short-form | `## Short form` | authored-here — §15.3 short flow |
| sop.no-handoff | `**Never call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task` or `tw_sync`**, and never write any `.current/` file; `tw_get_state` and `tw_detect_drift` are allowed for reading.` | authored-here — integrator's "**Never call `tw_update_state`**" shape |
| sop.no-subagent | `This role is never dispatched as a subagent: a subagent has no channel for rounds of dialogue with the human.` | authored-here — §11.5 |
| sop.entry.tracker | `an issue-tracker item that has no ticket file, whatever its size` | authored-here — §15.2 ruling 2, §15.3 |
| sop.entry.named-only | `Work only on the items the human names; never pull items from the tracker yourself.` | authored-here — §15.2 ruling 6 |
| sop.entry.small | `Work that fits one or two files and is not a tracker item goes to the ordinary coordinator intake.` | authored-here — §11.5 |
| sop.out.record | `## Rulings` | authored-here — rulings table heading in the discussion record: `\| # \| date \| question \| ruling \| replaces \|` |
| sop.out.wave | `\| wave \| ticket \| depends on \|` | authored-here — §16.1 ruling 9 compact wave table |
| sop.out.approval | `\| date \| decided by \| content \| source \|` | authored-here — approval row table; the human's row has `decided by` = `human` |
| sop.out.format | `` `<agc install>/docs/ticket-format.md` `` and `` `<agc install>/templates/ticket.md` `` with ``(`<agc install>` = agc's install directory, not the workspace)`` | authored-here — E437 prefix convention |
| sop.done | `every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling` | authored-here — §11.4 ruling 3 |
| sop.end | `` `not doing` `` and `` `not ready to cut` `` | authored-here — §11.5 |
| sop.short-no-wave | `The short form writes no wave table.` | authored-here — §16.1 audit point 5 |
| integ.exception | `**Wave table approved in `spec-workshop`** — a stated exception to Constitution §3.1's rule that only a directly witnessed approval counts:` | authored-here — §16.1 ruling 9 |
| integ.halt | `Any change to the approved tickets, their grouping or their order, or any open choice, halts here as above.` | authored-here — §16.1 rulings 9 and 16 |
| coord.match-prototype | `- Local prototype exports: a local directory or `.html` page exported from a design tool as a prototype (a single-screen prototype page or a runnable demo app), or local files the prose calls a `prototype`, `原型` or `プロトタイプ` of the design.` | authored-here — §16.1 ruling 10 ① |
| coord.hint | `No ticket file for this design prototype — start the `spec-workshop` prompt first.` | authored-here — §16.1 ruling 10 ①, §15.2 ruling 2 reply-only form |
| coord.ticket-file | `A ticket file is a Markdown file in the ticket format, by default under `docs/tickets/` (`ticketDir` in `.current/.config.json`).` | authored-here — ticket directory default |
| da.mode-list | `- **Mode** — one of `figma`, `sketch`, `xd`, `penpot`, `pdf`, `image`, `paper`, `prototype`, `no-design`. One line.` | authored-here — existing line plus `prototype` |
| da.detect-row | `\| local prototype export (a single-screen prototype page or a runnable demo app exported from a design tool) \| `prototype` \|` | authored-here — §16.1 ruling 10 ② |
| da.volume | `` `prototype` runs this gate only when the design tool's remote project is readable (count its screens from project metadata); a local-only export skips it. `` | authored-here — ruling 10 ② |
| da.credibility | `` `prototype` skips this gate: every prototype page is a full screen. `` | authored-here — ruling 10 ② |
| da.extract | `` - `prototype`: open the exported page or run the demo app locally; capture each state as a screenshot for *Visual Baselines*; record each state's behaviour (transitions, inputs) from the prototype's own logic. `` | authored-here |
| da.dual | `**Dual source (`prototype` + Figma)**: declare mode `prototype` and list both in `## Source`. Figma fixes which states exist; the prototype fixes how each state behaves. Every divergence is a ruling item: before a ticket file exists it is ruled in `spec-workshop`; after, STOP per *Escalation Routes: dual-source divergence*. A divergence already ruled in the ticket's discussion record is not raised again.` | authored-here — ruling 10 ② |
| da.escalation | `\| dual-source divergence (mode `prototype` with Figma) \| Blocked \| `design-auditor: dual-source divergence — <n> item(s) between Figma and the prototype need a human ruling` \| pm \|` | authored-here — mirrors the two existing Blocked rows |
| claude.L7 | `into a workspace by invoking one of the 13 registered role prompts (`teamwork`,` | authored-here — count 12 → 13 |
| claude.L10 | `` `release-engineer`, `integrator`, `spec-workshop`) or, if you opt in, the SessionStart hook. `` | authored-here |
| claude.L33 | `   Thirteen prompts are registered. `teamwork` serves the full Coordinator` | authored-here |
| claude.L38 | `   design, no `agent_id` in the routing chain; the other eleven` | authored-here |
| claude.L41 | `   `integrator`, `spec-workshop`) use matching `content/skill-<role>.md` file names` | authored-here |
| claude.L42 | `   (`integrator` and `spec-workshop` are prompt-only — not `tw_switch_role` / `agent_id` roles).` | authored-here |
| claude.L122 | `         qa-engineer,doc-writer,release-engineer,integrator,spec-workshop}.ts   the other eleven role prompts` | authored-here |
| claude.L130 | `content/skill-*.md        the other 12 role SOPs, one file per role` | authored-here — 12 skill files + spec-workshop = 13; "other" excludes coordinator-lite listed on L129 |
| readme.count | `in `content/skill-<role>.md` for the thirteen single-file roles` | authored-here — line 93 |
| readme.rows | `\| integrator       \| high   \| `opus`            \| Cross-lane fan-out and fan-in; prompt-only.                          \|` and `\| spec-workshop    \| high   \| `opus`            \| Rounds of rulings with the human; prompt-only.                       \|` | authored-here — integrator row was missing; added with the new row |
| install.count | `All 13 registered prompts (`tools/registry.ts` → `PROMPT_REGISTRY`):` | authored-here |
| install.row | `- `/mcp__agent-governance-mcp__spec-workshop` — rounds of rulings with the human into ticket files and a wave table (prompt-only)` | authored-here |
| arch.count | `│  13 registered prompts (tools/registry.ts):                │` | authored-here — box width kept (60 columns inside the frame as today) |
| arch.L20 | `│    design-auditor, sr-engineer, code-reviewer, qa-engineer,│` | authored-here — D12 (a) only |
| arch.L21 | `│    doc-writer, release-engineer, integrator, spec-workshop │` | authored-here — D12 (a) only |
| contrib.count | `13 prompts registered` (replacing `11 prompts registered` on line 138) | authored-here |

Note on `claude.L130`: today's line reads "the other 11 role SOPs" with 12 `skill-*.md` files on disk (L129 lists
`skill-coordinator-lite.md` separately); adding one file makes it "the other 12".

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Implementation notes for sr-engineer

- **Append, don't rewrite.** In `content/coord-01-core-head.md`, `content/skill-design-auditor.md` and
  `content/skill-integrator.md`, add new sentences/rows/paragraphs; leave every existing sentence byte-identical
  except the design-auditor Mode-list line (`da.mode-list`, one token inserted). Many tests pin existing sentences
  (e226, e262, e286, e288, e295, e296, e329, e336, e416, e438 on the integrator SOP; design-auditor-volume-guard,
  source-credibility-gate, pixel-perfect-*, render-structure, widget-shape-spec on the design-auditor SOP).
- **Content constraints every new line must satisfy** (enforced by existing corpus tests): no
  `pre-v3.20.0` / `is REMOVED` / `is retired` / `no remaining routing convention` (e440); no new
  `legacy … inert` sentence (e440 counts 4); every line must pass the `qa_review` trailing-tag check (e92 corpus
  sweep — no line ending in an unclosed HTML-tag fragment); no origin labels or ticket ids in shipped text (e438
  style); rationale only inside `<!-- rationale:start -->…<!-- rationale:end -->` fences, never fencing a
  normative sentence.
- **`gates/visual.ts`**: only `KNOWN_MODES` (+ `"prototype"`), `parseDesignMode` (D3) and the comment block above
  it. Do not touch `FETCH_BASED_MODES`, `hasDesignModeRequiringVisual`'s body, `checkSourceCredibility` or any
  other predicate. Truncation constant 40 characters + `…` (U+2026).
- **`tools/registry.ts`**: one new object appended at the tail of `PROMPT_REGISTRY` (after `integrator`), nothing
  else in the file (e431 edits the `tw_update_state` schema in the same file).
- **`prompts/spec-workshop.ts`**: copy `prompts/integrator.ts` (header comment says prompt only — not a
  `tw_switch_role` / `agent_id` role); function `buildSpecWorkshopPrompt`; description = `prompt.description`.
- **SOP shape** (`content/skill-spec-workshop.md`, target ≤ 140 lines, frontmatter `recommended_model: opus`):
  `# Skill: spec-workshop` → Purpose (one paragraph; human-started, prompt-only, not a routing-chain role, holds
  no feature lease) → `## Steps` 1–6 (anchors `sop.step1`…`sop.step6`; step 1 holds the entry condition with
  `sop.entry.*`, several item numbers per run, one item → several tickets or several → one; step 2: read the
  current code and docs and say what already exists before the first question — with no source, the code and
  docs are the source; step 3: subagents for design extraction and codebase surveys, keep summaries; step 4:
  questions in batches of at most 4, each with a recommendation and a worked example, all addressed to the
  operator (the tracker item's author is not in the session); write each ruling to the record when made, with its
  date; a ruling that replaces one names it; step 5: `sop.done`, Figma/prototype divergences are conflicts;
  step 6: `sop.end`, list open questions for `not ready to cut`) → `## Short form` (a small, clear tracker item:
  read it, check the code, write scenarios + verifications, one confirmation, write the ticket file;
  `sop.short-no-wave`; anything unclear or needing a split goes back to the full steps) → `## Outputs`
  (D7 paths; rulings table; ticket files per `sop.out.format`, one ticket file maps to at most one tracker item,
  internal URLs / codenames / names described by class, item number only, none in a public repository; backlog
  index line per ticket when the project keeps a backlog; wave table `sop.out.wave`; approval table
  `sop.out.approval`; commit after the approval row) → `## Governance state` (`sop.no-handoff`,
  `sop.no-subagent`). The discussion record is the formal output; tickets carry only conclusions.

## Test placement guidance for qa-engineer

- New file `test/e423-spec-workshop.test.mjs` (or split `test/e423-*.test.mjs` as qa prefers) for AC1–AC4,
  AC6–AC17 anchors and AC11's scan.
- Re-pin in place (expected red, owned by e423): `test/e178a-integrator-role.test.mjs` (AC3 count 13 with
  `spec-workshop` last and `integrator` 12th; frozen-first-11 unchanged; AC5 sentences per `claude.*`; :463 regex
  `files.length,\s*13`), `test/skill-frontmatter.test.mjs:105` (13), `test/e384-design-mode-declared.test.mjs`
  (unknown declared values now return the token and arm; credibility stays ok; 100k token → 40 chars + `…`),
  `test/visual-evidence-gate.test.mjs:673-679` (E319 AC-E319-5 → returns `freehand`, required true),
  `test/context-budget.test.mjs` (teamwork bundle re-baseline + new spec-workshop cap),
  `test/fixtures/compose-golden/skill-coordinator-monolith.txt` (re-capture; this pins
  `test/skill-manifest.test.mjs`).
- Do not edit any e431-owned test (fan-out manifest E431 test surface). If one goes red, mail the integrator.

## Out of Scope

- `tools/handoff-orchestrator.ts`, `gates/registry.ts`, any new error code (the existing `mode=` text names the
  value); `FETCH_BASED_MODES`; any other `gates/**` or `tools/**` file.
- Any E431 file; `fanout.mjs check` comparing a wave table with a manifest, and the 波次 column (E443, ruling 13,
  16); tracker parsing / write-back (E428); the general coordinator "no ticket file → `spec-workshop`" line for
  tracker items (E433, §15.3).
- `templates/claude-code-agents/**` — no subagent template ships for `spec-workshop`.
- Constitution text (`content/const-*.md`) — the §3.1 exception lives in the integrator SOP only (ruling 9).
- `index.ts` header comment ("MCP Prompts (11, …") — stale but outside the owned set; left for a later sweep.
- `docs/backlog.md` done-mark, CHANGELOG, version bump — integrator / release-engineer (ruling 18: no release).
- Re-running visual verification on adopter B's closed features (ruling 10 note: adopter B's scope).

## Dependencies / Prerequisites

- E422 merged (ticket format `docs/ticket-format.md`, template `templates/ticket.md`, `ticketDir` default
  `docs/tickets`) — on base `0efc203`.
- No `design/<feature>.md` (mode = no-design); Visual Structural Assertions omitted. No external references
  (all sources are in-repo: backlog, discussion file, fan-out manifest).
- D12 needs the human's ruling before T-E423-04 touches `docs/architecture.md` lines 20–21.
- Full-suite probe on unmodified base `0efc203` (2026-11-20, `node scripts/test-lock.mjs -- npm test`): exit 0,
  tests 4391, pass 4389, fail 0, skipped 2; `dist/` unchanged by the prebuild.
- Expected reds from this ticket (literal + regex grep over `test/`: `files.length, 1[12]`, `PROMPT_REGISTRY.length`,
  `twelve|Twelve`, `\b1[12] (registered|prompts|role)`, `other (ten|11)`, mode parser callers
  `hasDesignModeRequiringVisual|checkSourceCredibility`, unknown-mode fixtures `mode: <non-known token>`,
  `compose-golden` consumers), every one owned by e423:
  1. `test/e178a-integrator-role.test.mjs` — AC3 (`PROMPT_REGISTRY.length, 12`; `.at(-1)` is `integrator`), AC5
     (`12 registered role prompts|Twelve prompts are registered`, `the other ten`, `the other 11 role SOPs`), and
     :463 (regex `files.length,\s*12` over `test/skill-frontmatter.test.mjs` source — red the moment qa re-pins that
     file; both change together).
  2. `test/skill-frontmatter.test.mjs:105` — `files.length, 12` (13 after T-E423-02).
  3. `test/e384-design-mode-declared.test.mjs` — the `expectNull` cases for declared unknown tokens (AC-E384-1 ×2,
     AC-E384-2, AC-E384-3 "tokens not starting…", AC-E384-3 "never scanned past", security smoke 100k token); the
     `mode: —` and AC-E384-5/6 cases stay green.
  4. `test/visual-evidence-gate.test.mjs:673-679` — E319 AC-E319-5 "a Mode line naming no known mode still returns
     mode null".
  5. `test/context-budget.test.mjs` — teamwork bundle cap 18465 (coord-01 grows).
  6. `test/skill-manifest.test.mjs` — t-golden-byte-identity, via `test/fixtures/compose-golden/skill-coordinator-monolith.txt`
     (the golden is e423-owned; the test file itself needs no edit — fixed by re-capture). Not in the manifest's
     E423 test-surface list; "other tests red only because of this ticket" — flagged for the integrator.
  No e431-owned test is expected red. Checked and expected green: `test/subagent-templates.test.mjs` (static
  `ROLE_TO_SKILL`; the :164 "other 11 roles" is a comment about the `lite` exemption), `test/e392-subagent-templates.test.mjs`,
  `test/skill-evolution-v3.11.test.mjs`, the three design-source-detection tests (anchor on the heading only),
  `test/visual-gate-e2e.test.mjs`, `test/source-credibility-gate.test.mjs`, `test/baseline-manifest-gate.test.mjs`,
  `test/pixel-gate-attestation.test.mjs` (known modes / no file only), integrator-SOP pin tests (append-only edit).

Cut-check note: `node scripts/fanout.mjs check --cut specs/fanout-v5-w2.md e423 specs/e423-spec-workshop.md` exits 1 with 4 tokens
out of bounds: the four re-pinned test files above. All four are in the manifest's E423 test surface ("派工前核對"),
which the 擁有 cell grants by prose ("派工前核對列出的 E423 測試面全部"), so the check cannot match them as tokens —
for the integrator's pre-review.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E423 | `spec-workshop` prompt-only role (SOP + prompt + `PROMPT_REGISTRY` tail entry), integrator Stage 2 wave-table exception, coordinator prototype-export detection, design mode `prototype` with dual-source rule, server arms on an unrecognised declared mode; prompt/SOP counts 12 → 13 in docs | none | 12 + dist + tests | `content/skill-spec-workshop.md`、`prompts/spec-workshop.ts`、`tools/registry.ts`、`gates/visual.ts`、`content/coord-01-core-head.md`、`content/skill-design-auditor.md`、`content/skill-integrator.md`、`CLAUDE.md`、`README.md`、`docs/install.md`、`docs/architecture.md`、`CONTRIBUTING.md`、`dist/prompts/spec-workshop.*`、`dist/gates/visual.*`、`dist/tools/registry.*`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e423-*.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/e384-design-mode-declared.test.mjs`、`test/visual-evidence-gate.test.mjs` | — |

## Tasks

Ledger: `.current/e423/tasks.md` (written with `tw_add_task`). Chain: pm → sr-engineer (T-E423-01..05) →
code-reviewer → qa-engineer (T-E423-06, T-E423-07). `dist/*` outputs are build products and do not count toward
the 5-file task budget.

| id | role | P | summary | files | ~lines | depends_on |
|---|---|---|---|---|---|---|
| T-E423-01 | sr-engineer | P0 | Mode parsing: `prototype` in `KNOWN_MODES`; unrecognised declared mode returned (D3) | `gates/visual.ts`, `dist/gates/visual.*` | ~45 | none |
| T-E423-02 | sr-engineer | P0 | New SOP `content/skill-spec-workshop.md` (AC5–AC11 shape) | `content/skill-spec-workshop.md` | ~140 | none |
| T-E423-03 | sr-engineer | P0 | Registration: `prompts/spec-workshop.ts`, tail `PROMPT_REGISTRY` entry, build | `prompts/spec-workshop.ts`, `tools/registry.ts`, `dist/prompts/spec-workshop.*`, `dist/tools/registry.*` | ~25 | T-E423-02 |
| T-E423-04 | sr-engineer | P1 | Counts and lists 12 → 13 per `claude.*`, `readme.*`, `install.*`, `arch.*`, `contrib.*` (`CLAUDE.md` stays 250 lines) | `CLAUDE.md`, `README.md`, `docs/install.md`, `docs/architecture.md`, `CONTRIBUTING.md` | ~20 | T-E423-03 |
| T-E423-05 | sr-engineer | P1 | Content: coord-01 prototype detection + hint; design-auditor `prototype` mode + dual-source rule + escalation row; integrator Stage 2 exception paragraph | `content/coord-01-core-head.md`, `content/skill-design-auditor.md`, `content/skill-integrator.md` | ~25 | none |
| T-E423-06 | qa-engineer | P1 | New `test/e423-*.test.mjs` (AC1–AC4, AC6–AC17); re-pin e178a, skill-frontmatter, e384, visual-evidence-gate | tests | — | T-E423-01..05 |
| T-E423-07 | qa-engineer | P1 | Context-budget: new spec-workshop cap + teamwork re-baseline (measured, zero headroom); re-capture `skill-coordinator-monolith.txt` with per-hunk notes; AC19–AC23 commands; full suite | `test/context-budget.test.mjs`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | — | T-E423-06 |
