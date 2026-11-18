# Prompt audit — agent-governance-mcp (2026-11-18)

## Assumptions (Step 0)

- **Scope**: the working directory's whole prompt surface: `content/*.md` (15 constitution fragments, 7 coordinator fragments, 12 role SOPs, the partial), `templates/agent-adapters/*.md` (3), `templates/claude-code-agents/*.md` (12), `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, and the 13 MCP tool + 12 prompt descriptions in `tools/registry.ts`.
  - **Skipped**: `.claude/settings.local.json` (may hold secrets); `~/.claude/agents/*` and the user memory files (user-level, outside the project); `content/constitution-rationale.md` (non-normative and only in full-detail bundles, so not scanned line by line); `docs/` and `specs/` (human docs, never composed into a prompt).
- **Target models**: the role tiers the repo pins. **Claude Opus 5.5** for teamwork/pm/sr/architect/researcher/design-auditor/code-reviewer/release-engineer/integrator (opus pins, plus this user's opus pins for pm and teamwork), **Claude Sonnet 5.5** for qa-engineer/qa-visual, **Claude Haiku 5.5** for doc-writer/lite. The content also ships to non-Claude hosts (Cursor, Codex, Antigravity). Findings are argued from Claude's documented behaviour only. No non-Anthropic SDK markers were found.
- **Provenance**: the git history was reset at `48fb9fe` (2026-09-28, v4.0.0). Every flagged line blames to that commit, so no line can be traced to the model it was first written for. Confidence below does not rely on blame.
- **Rendering**: `stripOriginTags` always removes `<!-- origin -->` spans, and `stripRationale` removes `<!-- rationale -->` spans on dispatch paths. Findings only count text that survives into the bundle the agent actually reads.

## Summary

The three findings with the most impact:

1. **Constitution §1 is written in a register current models over-apply** (`const-01-core-head.md:23-29`). It combines "Zero Tolerance", a caps `NO YAPPING`, a banned-phrase list with no stated reason, "Do NOT narrate tool calls", and a hard "≤ 15 words" ceiling. Opus 5.5 and Sonnet 5.5 already lean toward too few updates. A blanket rule against narration plus a numeric cap pushes them into long silent runs. This repo's own lane/integrator workflow keeps having to add "send progress at every hop" rules on top. The proposed rewrite keeps the brevity policy, keeps it stated exactly once, and keeps the exemption for structured artifacts. It drops the clamp and the suppressor.
2. **Shipped content cites paths that exist only in this repo** (Group 2). Examples: `specs/qa-flow-enforcement-architecture.md` in the always-loaded constitution tail and in the `tw_update_state` tool description; `tools/transitions.ts`; `gates/stamp-provenance.ts`; `research/*.md`; `dist/lib/watermark-check.js`; and in the installed `lite` subagent, `content/skill-coordinator-lite.md`. `content/**` and the templates run in every adopter's workspace, where none of these paths resolve. This repo's own CLAUDE.md rule forbids citing such paths. One of them, `qa-visual:24`, sits inside a note string the agent is told to write into durable output.
3. **Incident history and ticket/version labels leak past the repo's own strip mechanism.** That covers 43 version/ticket labels (e.g. `(E177a)`, `(v3.14.0)`, `the E222 precedent`) and 11 incident narratives ("a prior rollout shipped grey `#333` primary buttons…", "P2 was saved by this behaviour; P1 was reopened…"). They sit outside `origin`/`rationale` fences, so every dispatched agent reads them. The repo already has the fix: wrap them in the existing fences, which keeps the reasons for full-detail readers.

Two stale facts are contradicted by the repo itself (high confidence). `CLAUDE.md` says `.current/handoff.md` exists at the root, but state lives at `.current/_primary/handoff.md`. The release-engineer template says `.current/handoff.md`, while the SOP it mirrors says `.current/<lane>/handoff.md`.

**Counts**:

| Group | Findings in the diff | Flag only |
|---|---|---|
| Group 1, dated prompt text | 3 | 1 |
| Group 2, configuration files | 6 | 3 |
| Group 3, tool descriptions | 1 (6 tools) | 0 |
| Group 4 | not applicable | 1 |

Group 4 is not applicable because the server makes no Claude API calls; only the sub-agent roster check applies.

## Findings (highest confidence first)

| # | Location | Evidence | Pattern | Why it no longer fits | Conf. | Action |
|---|---|---|---|---|---|---|
| H1 | `CLAUDE.md:13`, `CLAUDE.md:220` | "`.current/handoff.md` and `tasks.md` exist at the root" | G2 volatile specifics | `.current/` holds `_primary/handoff.md`; there is no `.current/handoff.md` (lane layout) | High | rewrite → `.current/_primary/handoff.md` |
| H2 | `templates/claude-code-agents/release-engineer.md:13` | "NEVER hand-edit `.current/handoff.md` or `tasks.md`" | G2 volatile specifics / conflict | The SOP it mirrors (`skill-release-engineer.md:19`) and the lane layout say `.current/<lane>/handoff.md` | High | rewrite path (same hunk drops `CRITICAL`/`NEVER` caps, M2) |
| M1a | `const-01-core-head.md:23,25-26` | "(Zero Tolerance)", "**NO YAPPING** … Output ONLY …", banned phrases "好的", "讓我為您", "現在", "我將" | 1a pressure + 1e banned list with no reason | Caps, "zero tolerance" register and an unexplained phrase list over-apply on current models and make the output cautious. The legitimate goal (no filler) fits in one positive line | Medium | rewrite → "**No filler**: Replies carry technical content, decisions, or results — no pleasantries, acknowledgements, or announcements of what you are about to say." |
| M1b | `const-01-core-head.md:27` | "**Silent execution**: Do NOT narrate tool calls." | 1d update suppressor | Opus 5.5 and Sonnet 5.5 under-narrate when a suppressor is present. Long silent tool runs look like a hang to the human watching a `/teamwork` chain | Medium | rewrite → "Don't narrate individual tool calls; before a long run of them, one short line saying what you are doing is welcome." |
| M1c | `const-01-core-head.md:29` | "Default chat replies ≤ 15 words" | 1f numeric ceiling | Numeric caps tuned against older models' verbosity squeeze needed explanation. The "only one length policy" and "structured artifacts exempt" design is good and is kept | Medium | rewrite → "Keep default chat replies to the length the content needs — usually a sentence or two." |
| M2 | `templates/claude-code-agents/*.md:7` (all 12) | "CRITICAL: End every reply with `— @<role> (…)`" | 1a pressure | The watermark is already required by Constitution §1, and coord-04 repairs a missing one on relay. `CRITICAL` adds no information and sets an anxious register for the whole subagent | Medium | rewrite → "End every reply with …" |
| M3 | 43 sites; list in diff (`skill-integrator.md` 15, `skill-design-auditor.md` 8, `coord-03` 6, …) | `(E177a)`, `(v3.14.0)`, `## Governance state (D11)`, `(the E222 precedent)`, `Constitution §1 v3.14.0 exception` | G2 history narratives | Ticket and version ids carry no instruction for the agent, and the repo already strips them when fenced. Unfenced, they ship in every bundle, and Constitution §6 *Generic citation* itself forbids bare ticket ids | Medium | wrap in `<!-- origin -->`; rewrite the three ids used as names (`§1 v3.14.0 exception` → `§1 Visual Widgets exception`) |
| M4 | `skill-qa-engineer.md:60`; `coord-03:1`, `:9`, `:58`; `coord-02:17`; `const-05:19` | "is REMOVED"; "This is the pre-v3.20.0 behavior…"; "the old in-memory counter is retired"; "convention is retired" | 1d migration-relative phrasing | A diff against prompt versions the agent never saw implies phantom alternatives. The "legacy lines are inert" sentences are kept, because they still guide the reading of old state files | Medium | rewrite as current-rule statements, or remove where a neighbouring sentence already states the rule |
| M5 | `const-11:4-8`; `skill-pm:31`; `skill-architect:27`; `skill-design-auditor:16,27(×2),53,59`; `skill-sr-engineer:24,25`; `skill-qa-visual:28` | "a prior rollout invented boxed-chips + copy", "P2 was saved…; P1 was reopened…", "this once cost a full pixelmatch forensics round" | G2 history narratives | A rule's authority is the behaviour it prescribes, not the incident behind it. The reasons stay useful to maintainers, which is what the rationale fence is for | Medium | move into `<!-- rationale -->` fences (stripped on dispatch, kept at full detail) |
| M6 | `const-10:3`, `const-08:7`, `coord-02:1(×2)`, `skill-pm:108`, `skill-design-auditor:54`, `skill-qa-visual:12,24`, `skill-doc-writer:15`, `skill-coordinator-lite:16,43`, `templates/claude-code-agents/lite.md:9(×2)` | `specs/qa-flow-enforcement-architecture.md`, `gates/stamp-provenance.ts`, `tools/transitions.ts`, `research/…`, `content/skill-coordinator-lite.md`, `specs/d8-lite-recommended-model.md` | G2 volatile specifics, and conflict with `CLAUDE.md` ("check it cites no path that exists only in this repo") | These files run in adopter workspaces, where the paths do not exist. The repo's own convention for agc-owned files is `<agc install>/…` (`skill-qa-engineer.md:59`). Worst cases: `lite.md` tells the installed subagent to read a SOP at a path that isn't there, and `qa-visual:24` makes the agent write a repo-only path into a FAIL note | Medium | drop the citation, or prefix `<agc install>/` where the agent must actually open the file |
| M7 | `tools/registry.ts:651,668,853,927,952,984` | `tw_get_state`: "MANDATORY FIRST ACTION."; `tw_get_next_task`: "Read next uncompleted task."; `tw_detect_drift`: "Check state vs tasks drift."; `tw_rollback_task`: "Mark task uncompleted [ ]. Require reason."; `tw_update_state`: "…see specs/qa-flow-enforcement-architecture.md"; `tw_void_task`: "(E117)" | G3 over-steered + under-described | Descriptions ride in every request of every adopter. Three are one-liners that don't say what they return or when the call fails. `tw_get_state` shouts a rule the server already enforces, and its list of blocked tools leaves out `tw_sync`/`tw_void_task` | Medium | rewrite / add, as contracts checked against `tasks-file.ts`, `drift.ts` and the `enforcePreFlight` call sites |

### Flag only (not in the diff)

| # | Location | Note | Conf. |
|---|---|---|---|
| F1 | `const-15-core-tail.md:4` (+ Limits `read` cap 3) | "Max file reads per target: 3. Then STOP." could be a loop-breaker fossil, since re-reading a file after editing it is normal for current models. `tw_gate_stats` lists it as prose-only with no telemetry, so nobody can tell whether it fires or helps. Your call | Low |
| F2 | `templates/claude-code-agents/release-engineer.md:9` vs `:11`, `:13` | Line 9 says the SOP's rules "are not restated here", then lines 11 and 13 restate them. Line 13 is load-bearing (it is the no-MCP case, where `tw_switch_role` can't load the SOP), so the fix is to reword line 9, not to delete line 13. History can't show which wording is meant | Low |
| F3 | `skill-release-engineer.md`, `skill-doc-writer.md:13` | Both SOPs ship to every adopter but describe this repo's own layout (`scripts/release.mjs`, `index.ts` Server literal, `tools/` `prompts/` `schema/` `guards/`). Making them generic is a product decision, not a prompt edit | Low |
| F4 | `skill-code-reviewer.md:85,92,93,96` | The "reviewer never carries `completed_tasks`" rule is stated four times in one file (plus `const-08:9`). The copies agree, so this is working redundancy (keep-list 8). Consolidate only if they ever drift | Low |
| F5 | `templates/claude-code-agents/qa-visual.md` vs `qa-engineer.md` (G4 roster) | Both definitions load the same SOP. They differ only in context and watermark name, which on the face of it is a redundant-specialist pattern. Kept on purpose: the separate subagent is what gives the visual verdict an independent judge context (§3.2) | Low |

Group 1g (code ownership) does not apply: no role targets Claude Fable 5.2 or Mythos 5.2.

## Proposed diff

File: `docs/prompt-audit-2026-11-18.diff`, next to this report (34 files, +103/−88). It is checked with `git apply --check` against `main` @ `a68704b`, and the edited `tools/registry.ts` parses with 0 diagnostics. There is one hunk per finding site, so you can take them selectively. **Nothing has been applied.**

**What else moves if hunks are taken** (CLAUDE.md asks for these to be named):

- **Compose goldens**: every `test/fixtures/compose-golden/*.txt` (constitution, coordinator, build and hook variants) must be regenerated. M1, M3, M4, M5 and M6 all change rendered text.
- **`test/context-budget.test.mjs`**: `UNIVERSAL_MARKERS` pins `"NO YAPPING"`. Rename it to `"No filler"` with M1a. Byte caps only shrink.
- **`test/eval/lib/assertions.mjs` and `test/eval-assertions.test.mjs`**: these assert the banned-phrase list and the 15-word cap. Retire or reword them with M1a and M1c.
- **`tools/gate-stats.ts:125`**: the rule label "§1 terse cap (default chat replies ≤ 15 words)" follows M1c.
- **Template pins for M2/H2**: `test/subagent-templates.test.mjs:385`, `test/feature-lease.test.mjs`, `test/e412-qa-visual-template.test.mjs`, `test/release-staging.test.mjs`, `test/e404-release-engineer-template.test.mjs`.
- **`lite.md` pins for M6**: `test/e408-core-task-alias-tail.test.mjs:79,82`, `test/subagent-templates.test.mjs`. For the lite SOP path, also check `test/e409-lite-write-tool-facts.test.mjs` and `test/teamwork-lite.test.mjs`.
- **coord pins for M4**: `test/e130-lane-default.test.mjs` pins `pre-v3.20.0`.
- **Installed copies**: `agc init` copies the templates into `~/.claude/agents/`. The copies already installed keep the old text until they are re-copied (user-level, outside this audit).

## Verify (Step 7)

The Group 2 findings are checked against the repo (done above). The M1 rewrite is the only change whose effect on behaviour is contested. To probe it, run the `test/eval/` harness (`npm run eval`) before and after on a `/teamwork` scenario with long tool runs, and compare update frequency and reply length.
