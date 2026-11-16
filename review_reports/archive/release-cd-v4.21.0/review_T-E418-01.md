# Review — T-E418-01

covers: T-E418-01, T-E418-02, T-E418-03

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- One commit trims served prose in `content/const-08-chain-31-mid.md` (eight §3.1 bullets), `content/coord-03-core-fallback.md` (ten Escalation Routes rows plus the auto-tier and manifest-tier writer actions), `content/coord-04-host-watermark.md` (3.6KB down to 0.9KB) and `content/coord-06-host-token.md` (3.1KB down to 1.8KB). Dropped rationale moves to `content/constitution-rationale.md`. The hop-cap roll-up note moves to `docs/lane-protocol.md` §3.
- Scope holds: nothing under tools/, gates/, schema/, scripts/, bin/, test/ or dist/ changed. `npm run build` leaves dist/ clean, `agc check` exits 0, and the backtick-quoted error-code set in each of the four files is the same before and after.
- Most trims keep every fact an agent needs. Three facts were lost or made wrong: the auto-tier `allowSchemaChange` / `allowDesignArmed` override, the watermark section's invocation route (it now says a server-side check exists, which is false), and the coord-03 "Pinned-tier expectation" cross-reference, which no longer points at anything.
- Verdict: CHANGES_REQUESTED. Three required findings, each fixable with a clause or two.

## AC Completeness
AC Completeness: SKIP — no specs/e418-gate-retro-prose-trim.md (backlog-row-as-spec mini-chain)

Checked against the E418 backlog row and tasks T-E418-01..03 instead:
- T-E418-01 (const-08 bullets in WHEN/DO/ELSE form): partial. Scope, Cut-Approval, Lease-Override, QA Completion-Evidence, Non-QA and Amend-Resume are fine. Auto-Tier lost a config-key semantic (R1). const-05 needed no change: it has none of these bullets.
- T-E418-02 (one Escalation Routes row per code, hop-cap conditions moved): implemented. Ten rows out, ten rows in. Every code is still present. Conditions (a) to (f) were already in `docs/lane-protocol.md` §3, and the E175(d) roll-up note was added there.
- T-E418-03 (coord-04 pointer that describes the check in words with no repo-only path; coord-06 and the manifest-tier writer action in WHEN/DO/ELSE): partial. The coord-04 wording is inaccurate (R2) and orphans a cross-reference (R3). coord-06 and the writer actions are fine apart from recommended nits.

## Correctness

**R1 — required — `content/const-08-chain-31-mid.md:3` (Cut-Approval Auto-Tier).** Main said "schema-change and design-armed cuts are never auto-approvable unless those flags are explicitly `true`". The new bullet still lists `allowSchemaChange` false and `allowDesignArmed` false as defaults, but no longer says what the flags do. Its WHEN clause now requires "no schema change ... non-design" unconditionally, and the next sentence says "Anything ... design-armed ... HALTs exactly as today". A workspace that set `allowDesignArmed: true` (documented in the agc `docs/config.md` table: "`true` lets design-armed cuts ... auto-approve") would now halt, contrary to its config. Auto-Tier is advisory: the prose is the whole mechanism and the server checks nothing, so this changes behaviour. Fix: one clause, e.g. "a schema-change / design-armed cut qualifies only when `allowSchemaChange` / `allowDesignArmed` is explicitly `true`".

**R2 — required — `content/coord-04-host-watermark.md:3`.** "DO pass it through the server-side watermark check, `validateWatermark(reply, name, tier)`" is false. `validateWatermark` is a pure library function (`lib/watermark-check.ts`, no I/O). No `tw_*` tool, gate or server path calls it, and no MCP tool exposes it. So there is nothing server-side to pass a reply through. A coordinator that follows the text either looks for a tool that does not exist, or assumes the server repairs watermarks and skips the step. Main gave a real route: the compiled module path, which ships in the agc install, so it is not a repo-only path. It also gave the detection rules. Both are gone, and the rules a manual check needs are gone with them:
  - the check reads the last non-empty, trimmed line;
  - name and tier must match the dispatched subagent, case-insensitively;
  - a hyphen or en-dash counts as absent;
  - the result has exactly one watermark line.

  Fix, either option meets the human ruling (describe the check in words, no repo-only path):
  - (a) drop "server-side" and the bare identifier, and state the rule in words: "the reply's last non-empty line must be exactly `— @<name> (<tier>)` (U+2014; name and tier case-insensitive); if it is missing append it, if it is wrong replace that line, leaving exactly one";
  - (b) keep the identifier and give a portable route, as const-08 does for `<agc install>/scripts/fanout.mjs`: "agc's `validateWatermark`, in `<agc install>/dist/lib/watermark-check.js`".

  The ruling's premise ("the server-side check") does not match the code. The PR description should say so, so the human is not misled.

**R3 — required — `content/coord-03-core-fallback.md:102`.** The Crash-Resume Protocol still says "checking the tier against the pin per the Pinned-tier expectation below". This diff removed the **Pinned-tier expectation** label from coord-04, so the reference is dangling. The rule survives in coord-04 ("`tier` = its `dispatch_pins` entry, else its `model` frontmatter"), but a reader cannot find it by the name it is cited under. Fix: point at "Subagent Reply Watermark Validation", or keep the label in coord-04.

**Expected-red check (SOP 4a).** I sampled four manifest entries: e295 AC4 (line 56), e392 AC9 (line 199), feature-lease E10-AC8a (line 1413) and skill-manifest t-golden-byte-identity (line 101). All four are real, locatable tests, and each fails only because of trimmed text it pins. Full-suite comparison: see the Verdict section.

**Golden count.** There are 12 fixtures under `test/fixtures/compose-golden/`; the ticket's "all 10" is imprecise. The four `build-lite-*` fixtures and `hook-lite.txt` do not include the trimmed fragments: const-08 is tagged `chain`, coord-04 and coord-06 are tagged `host:claude-code`, and none of them is composed into lite. That leaves exactly 7 red golden tests, which is consistent and not a wiring gap.

**Hint sufficiency, removed prose vs `hintStatic`.** Sufficient as they stand: SCOPE_DECISION_REQUIRED, LEASE_OVERRIDE_AUDIT_MISSING, QA_COMPLETION_EVIDENCE_MISSING, NON_QA_COMPLETED_TASKS_REJECTED, REVIEWER_COMPLETED_TASKS_REJECTED, and TRANSITION_REJECTED on the amend-resume edge (tools/transitions.ts adds a `resume_of` hint).

Two hints lean on prose that is still served:
- CUT_APPROVAL_REQUIRED's hint names only the PM path. The coordinator-attested path stays in const-08 and in the coord-03 writer obligation.
- HOP_CAP_EXCEEDED's hint says "human must re-scope or override". The continuation conditions now live only behind the coord-03 pointer.

None is bare enough to block. QA should still confirm them under T-E418-04.

## Quality

- recommended — `content/coord-06-host-token.md:3`. Main's "you MAY read" (optional) became "WHEN doing a retrospective → DO read" (mandatory). The ELSE branch ("do not cite `subagent_tokens` alone") belongs to the DO case, not to the not-a-retrospective case. Suggested: "WHEN ... → DO ... and never cite `subagent_tokens` alone".
- recommended — `content/coord-06-host-token.md:9`. "reaches 80%" replaced "reaches or exceeds 80%". A running total that jumps past 80% between dispatches is still covered by the Escalation row's `≥ 80%`, but the two texts should match.
- recommended — `content/coord-03-core-fallback.md:29`. The pointer target, agc's `docs/lane-protocol.md` §3, resolves in the agc install, following the same convention as `skill-integrator`. That file is Chinese-only, though, and is now the sole home of a normative rule that the coordinator prose used to carry in English.
- optional — `content/coord-03-core-fallback.md:31`. Crash detection lost "(handoff `agent_id`/`status` unchanged since dispatch)", the observable test for "before that role's own write landed".
- optional — `content/coord-04-host-watermark.md:3`. One ~900-byte sentence with five dash clauses. Splitting it into WHEN / DO / ELSE lines would read more easily. The ticket said "three-line pointer".
- optional — `content/const-08-chain-31-mid.md:4`. "→ DO the same writer sets" is ungrammatical ("→ DO let the same writer set"). The Manifest tier saved only 130 bytes, which is fine because all eight conditions must stay.
- optional — `content/const-08-chain-31-mid.md:10`. The Single-role judge dispatch sub-paragraph was kept verbatim to avoid re-pinning, so Amend-Resume shrank less than it could have.
- Normative check of everything else, side by side, with no loss found:
  - Scope decision: both clearing artifacts, the predecessor pin, the non-design pass.
  - Cut-Approval: build-entry edge; unconditional, visual or not; file-mode only; all three re-arm triggers; the sanctioned writer, including the subagent case and the `agent_id="pm"` attestation shape.
  - Lease-Override: any edge, the `/^lease-override:/` `pending_notes[0]` rule, transient, file-mode only, the witness rule by reference.
  - QA Completion-Evidence: only newly added ids, the `covers:` / per-id file, `qa_review` self-satisfies, the APPROVED-row `review_task_ids`.
  - Non-QA Completed-Tasks: both codes split by `agent_id`, the strict predicate, no exemptions, both modes.
  - Amend-Resume: the `resume_of` enum, legacy note inert, gates do not arm.
  - Manifest tier: all eight conditions, the mid-wave `人類` rule.
  - Token brake: the arming rule including invalid value means disabled, the sidecar as ledger, the fallback hand-sum, 80%, observe/halt only.
  - Escalation Routes: same rows and same codes.

## Architecture
No architecture spec. Composition is unchanged: no manifest or tag edits. `content/constitution-rationale.md` is not served. It is not in `CONSTITUTION_SEGMENTS`, and nothing under prompts/, bin/, tools/ or lib/ reads it. The new paragraphs sit in its §3.1 section and contain no normative text.

On the one-way-reference rule (the rationale file's header says "the constitution does not reference back"): the const-08 Scope bullet keeps a back-reference that already existed on main ("Why these §3.1 gates exist: `content/constitution-rationale.md`"), and so does const-11. This was not introduced here (optional).

## Security
Portability: the added lines in content/ name no new repo-only path. `docs/lane-protocol.md` is qualified as "agc's", the convention skill-integrator uses. The paths already present before this diff are `docs/config.md`, `bin/agent-governance-usage-hook.mjs` and `content/constitution-rationale.md`.

Dropping `gates/feature-lease.ts` from const-08 is correct: it is server source the adopter does not need, and the predicate is stated in words. The same reasoning applies to the Stamp-Provenance bullet's `gates/stamp-provenance.ts`, which is out of scope here (optional follow-up, already noted by the builder).

The bare `validateWatermark` identifier is not a path, so it does not break the letter of the ruling. Without a route it is unactionable, though, and paired with "server-side" it misleads (R2). No secrets, local paths, usernames or codenames in the diff.

## Performance
Served-size only. const-08 is about 4.2KB smaller, coord-03 about 1.8KB, coord-04 about 2.7KB, coord-06 about 1.2KB. The rationale file grows about 1.5KB but is not served. No runtime code changed.

## Verdict
Suite run at a7c30d9 with `npm test`: 4191 tests, 4179 pass, 10 fail, 2 skipped. The 10 failing test names are exactly the 10 entries in `qa_reports/expected-red_e418-gate-retro-prose-trim.txt` (sorted lists compared with diff). No unexplained red.

CHANGES_REQUESTED — R1 (auto-tier allow flags lost), R2 (false "server-side" watermark claim with no invocation route) and R3 (dangling "Pinned-tier expectation" reference) are defects this diff introduced into served text; each is a one- or two-clause fix.

## Round 2 — APPROVED — by code-reviewer

covers: T-E418-01, T-E418-02, T-E418-03

### Summary
- Fix commit 7a654e5 on top of a7c30d9 changes 4 content files and 1 manifest comment, 10 lines added and 8 removed. Reviewed with `git diff a7c30d9..7a654e5`, and each touched bullet re-read in full against `main`.
- R1, R2 and R3 are resolved, and so are all four non-blocking items raised in round 1 that I asked to re-check. No new defect.
- Verdict: APPROVED.

### AC Completeness
AC Completeness: SKIP — no specs/e418-gate-retro-prose-trim.md (backlog-row-as-spec mini-chain). Against the tasks: T-E418-01, T-E418-02 and T-E418-03 are now implemented.

### Correctness
- **R1 resolved — `content/const-08-chain-31-mid.md:3`.**
  - The WHEN clause now admits a schema-change / design-armed cut when the matching `allowSchemaChange` / `allowDesignArmed` is `true`.
  - The HALT sentence carries "save what an allow flag permits", so it no longer contradicts the WHEN clause.
  - The defaults sentence restores main's "never auto-approvable unless those flags are explicitly `true`".
  - All three agree with agc's `docs/config.md` field table.
- **Manifest-tier condition (5), "allow flags included" — `content/const-08-chain-31-mid.md:4`.** This is faithful, not a new rule. `docs/config.md` says: "The manifest tier replaces the size threshold, not the safety flags ... the schema-change and design-armed conditions — and `allowSchemaChange` / `allowDesignArmed` — apply exactly as for the threshold tier". The same decision is recorded in the E296 architecture spec's design-decision table ("Condition (5) vs the `allow*` flags"). Main's wording, "no-schema-change and non-design still hold", read as stricter than that design. The new wording matches the design and the config doc.
- **R2 resolved — `content/coord-04-host-watermark.md:3-5`.** No function name, no "server-side", no path. Side by side with main's Detection regex, Pinned-tier expectation, Correction strategy and Out-of-scope guard:
  - Kept: the last non-empty trimmed line; the exact `— @<name> (<tier>)` shape; U+2014 required, with a hyphen or en dash counting as absent; the name taken from the dispatched subagent; the tier taken from the `dispatch_pins` entry, else the `model` frontmatter; case-insensitive matching; append when absent, replace when wrong, exactly one line; no re-dispatch and no warning; the three self-report sentences verbatim, plus surfacing a pin mismatch.
  - The skip set also matches: own `— @coordinator` replies, and replies after `tw_*`, bash, file-read or other non-Task calls. Main's third guard bullet (the coordinator's own analysis) is covered by "your own replies".
  - Nothing invented. Nothing an agent needs was lost; only the E103 aside and the haiku rationale went.
- **R3 resolved — `content/coord-03-core-fallback.md:102`.** "as that section's `dispatch_pins` rule requires" points back to "Subagent Reply Watermark Validation", named on the line before, and that section states the `dispatch_pins` tier rule.
- **Non-blocking items:**
  - `content/coord-06-host-token.md:3`: "MAY" restored. The old ELSE branch held one normative fact, "not `subagent_tokens` alone", and it now sits inside the DO branch. Nothing lost.
  - `content/coord-06-host-token.md:9`: now "≥ 80%", matching the Escalation row.
  - `content/coord-03-core-fallback.md:31`: the observable test "(handoff `agent_id`/`status` unchanged since dispatch)" is back.
  - `content/const-08-chain-31-mid.md:4`: "DO let the same writer set".
- **Expected reds.** Suite at 7a654e5 with `npm test`: 4191 tests, 4179 pass, 10 fail, 2 skipped. The sorted failing names are identical to `qa_reports/expected-red_e418-gate-retro-prose-trim.txt`. The only manifest change is one reworded comment line.

### Quality
- optional — `content/const-08-chain-31-mid.md:3`. The allow-flag exception is now stated three times: the WHEN clause, "save what an allow flag permits", and the defaults sentence. Trimming one later would save bytes.
- optional (out of scope, existed before this ticket) — `content/skill-coordinator-lite.md:43` still tells lite to call `validateWatermark` from a bare `dist/lib/watermark-check.js`. That is the same premise R2 corrected in coord-04, and the builder already noted it as a possible follow-up.

### Architecture
Unchanged from round 1. No manifest or tag edits, and `content/constitution-rationale.md` is still not served.

### Security
The lines added in 7a654e5 name no new path. The only paths present already existed: `.current/.config.json`, `docs/config.md`, `specs/fanout-<id>.md`, `<agc install>/scripts/fanout.mjs`. No secrets, local paths or usernames.

Scope across `main...HEAD`: content/ (5 files), `docs/lane-protocol.md`, and the expected-red manifest only. `npm run build` leaves dist/ clean. `agc check` exits 0. The backtick-quoted error-code set in each touched content file is unchanged from main.

### Performance
Served sizes are now const-08 about 11.9KB (main 15.9KB), coord-04 about 1.0KB (main 3.6KB) and coord-06 about 1.9KB (main 3.1KB). The round-2 additions cost about 350 bytes in total. No runtime change.

### Verdict
APPROVED — all three required findings are fixed faithfully, with no new defect, a clean scope, and a failing set equal to the manifest.
