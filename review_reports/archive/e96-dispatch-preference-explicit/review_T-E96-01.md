# Review — T-E96-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Two spans, content-only, one line each: `content/coord-02-host-dispatch.md:1` (+273B) adds an anti-nudge sentence naming `/teamwork` as the user's dispatch request; `content/coord-03-core-fallback.md:1` (+338B) re-conditions the fallback on genuine unavailability and adds a WHEN/DO requiring the downgrade be surfaced.
- Boundary honored: `git status --porcelain` shows exactly these 2 files plus PM/coordinator bookkeeping (`.current/handoff.md`, `.current/telemetry.jsonl`, `tasks.md`). **Zero bytes under `test/`.**
- Scope honored: no handoff field, no gate, no schema touch — backlog option (ii) stays deferred. Constitution §3.2 is referenced, never re-derived.
- **Blocking:** the two spans sit on opposite sides of the D6 host-capability compose axis. `coord-02` is tagged `host:claude-code`, `coord-03` is tagged `core` (`prompts/skill-manifest.ts`). Under the **default** profile (`host` undeclared ⇒ `{ taskTool: false }`) the composed coordinator gets the coord-03 rule **without** the coord-02 fix — the noise without the remedy — and the rule then misfires on every hop.
- Verdict: CHANGES_REQUESTED — one blocking finding with two symptoms, both fixable inside the two files already in cut.

## Correctness

**C1 (blocking) — `content/coord-03-core-fallback.md:1`: the new WHEN/DO fires as a false positive on every hop under the default host profile.**

Chain of fact, each link verified:

1. `prompts/skill-manifest.ts` tags `coord-02-host-dispatch.md` as `host:claude-code` and `coord-03-core-fallback.md` as `core`; `hostCapabilitiesFor()` returns `{ taskTool: host === "claude-code" }`, so an absent/unknown `host` yields the lean profile and coord-02 is dropped.
2. `prompts/build.ts:348` — the `/teamwork` GetPrompt path — resolves capabilities *solely* from `loadConfig(workspacePath).host`. (`tools/role.ts:86` is identical.)
3. `bin/agc-init.mjs` never writes a `host` field, and `"host": "claude-code"` appears nowhere in `docs/`, `templates/`, or `README.md` — only in `specs/d6-host-capability-compose-axis-architecture.md:19`. **This repo's own `.current/.config.json` has no `host` key.** The lean profile is therefore the default in practice, including for this workspace.
4. Composing the coordinator under both profiles confirms the split empirically:

```
host=(undeclared -> lean default) taskTool=false
   fallback heuristic present (coord-02 defines it): false
   new back-reference "the fallback heuristic above": true
   new anti-nudge sentence:                           false
   new "DO surface it in chat as a §3.2 ..." rule:    true
host=claude-code taskTool=true
   all four: true
```

Consequence: on the lean profile the composed SOP describes **no dispatch mechanism at all** — `tw_switch_role` is the only path it offers, which `tools/role.ts:77-83` states is by design ("The tw_switch_role path IS the non-Task fallback, so its no-config default here omit Task-dispatch prose"). But the host in question is Claude Code, which *does* advertise `Task`. The new sentence's trigger — "WHEN the fallback is taken while the host DOES advertise `Task`" — is therefore satisfied on **every single hop**, and instructs the coordinator to announce a §3.2 builder≠judge downgrade each time, for behavior its own SOP prescribes.

This inverts the ticket. E96 wants the *illegitimate* nudge-driven fallback made visible; as written, the architecturally-correct fallback is what gets flagged, in the default configuration, on every hop. A warning that fires on compliant behavior is the fastest way to burn the signal this ticket exists to create.

The undeclared-`host` gap itself is pre-existing D6 debt and is **not** yours to fix here. Landing a rule that misfires under it is.

Fix — either is in-cut and content-only:
- **(a) Move the WHEN/DO sentence into `coord-02-host-dispatch.md`** (it already owns "the Fallback below"). The rule then composes exactly where both its referent and the `Task` capability exist, and costs lean-host prompts nothing. This also resolves C2 for free. Preferred.
- **(b) Re-condition the trigger on the composed SOP rather than the raw host capability** — e.g. fire only when the Subagent Dispatch paragraph is present in this SOP and the fallback was taken anyway. Self-neutralizing when coord-02 is absent; requires C2 fixed separately.

**C2 (blocking) — `content/coord-03-core-fallback.md:1`: dangling cross-fragment reference.**

The new text says "the subagent type is unregistered **(the fallback heuristic above)**". That heuristic (`heuristic: attempt the call once; on tool-error or unknown-subagent-type, fall back`) exists only in coord-02. Under the lean profile the pointer survives into the composed monolith while its referent does not — confirmed in the C1 compose output.

This is the **first** core→host back-reference in the coordinator SOP. Grepping `above`-pointers across all four `core` fragments returns exactly three hits, and the other two are intra-fragment (`coord-03:33` "the row above" → the Claim-vs-state table row; `coord-03:37` "the writer obligation above" → the Cut-approval gate writer obligation, both same file). Pre-existing core prose does mention `Task(...)` — the Crash detection row, Crash-Resume step 3 — but always self-containedly, never pointing at coord-02's text. That discipline is what keeps the byte-slice fragments composable in any subset; this diff is the first break.

Fix: fix (a) above carries the clause into coord-02 and resolves this. If you take (b), make the clause self-contained instead — e.g. "…or the `Task` call returns a tool-error / unknown-subagent-type".

**C3 (non-blocking, `content/coord-02-host-dispatch.md:1`) — the premise is narrower than the prose.** "an explicit `/teamwork` invocation IS that request" is sound where it applies, but coord-02 also composes via the SessionStart hook (`bin/agent-governance-context.mjs:111`), which defaults to `{ taskTool: true }` with no config host and can carry `skill-coordinator.md` — a path with no `/teamwork` invocation at all, so the nudge's condition is genuinely unmet there. Consider "an explicit `/teamwork` invocation (or equivalent explicit coordinator entry) IS that request". Low severity; the default hook variant is lite, which has no chain.

**Does the cut's acceptance criteria hold?** Partially. "coord-02 names `/teamwork` as the dispatch request" — yes. "coord-03's fallback line is conditioned on genuine unavailability AND requires surfacing" — yes textually, but only reaches a reader who also received coord-02 in ~half the compose profiles, and misfires in the other half. The defect is closed on a **declared** `host: "claude-code"` workspace and not on a default one.

**Answering the brief's question 1 directly:** on a declared-CC host the two spans do make the nudge-driven fallback non-compliant (coord-02 is directive: "is not a reason to take the Fallback below … so dispatch per this paragraph") *and* visible in chat (coord-03's DO). That half is genuinely well built. It is the composition axis, not the wording, that breaks it.

## Quality

- `content/coord-03-core-fallback.md:1` — "builder≠judge" (unspaced) drifts from the same file's existing "builder ≠ judge" (spaced) in the visual-verdict Escalation Routes row. Match the incumbent.
- Neither new span carries an `<!-- origin:start -->` provenance tag. Precedent for tagging a mid-sentence added requirement exists in the very file being edited: `coord-02-host-dispatch.md` has `REQUIRED<!-- origin:start --> (v3.104.0, E43)<!-- origin:end -->`. These tags are stripped by `stripOriginTags` on **every** render (`prompts/build.ts`), so they cost zero prompt bytes and are free maintainer provenance. Add `(v3.105.0, E96)` (or the actual release version) to both spans.
- `content/coord-03-core-fallback.md:1` — the rewrite merged the standalone sentence "Call `tw_switch_role(<next_role>)` and follow the returned SOP in the same context." into an em-dash-joined clause. Within the span the ticket names, so not a scope violation, but it is more restructuring than the change required (§1 surgical). Not blocking; restoring the sentence break would make the diff cleaner to audit.

## Architecture

No `specs/e96-*-architecture.md` exists — the backlog row is the spec, as the cut records.

Fit against backlog option (i) is good on intent and wrong on placement. Option (i) says "state in the Auto-Routing / fallback fragments" — which the diff does — but the D6 host axis means "the fallback fragment" is `core` and reaches hosts that structurally cannot dispatch. The axis is the binding constraint here and the fix has to respect it. Findings C1/C2 are both instances of that one architectural mismatch.

Scope discipline is otherwise clean:
- Option (ii) is genuinely absent. The coord-03 rule surfaces **in chat**; nothing is persisted, no handoff field is read or written, no `GATE_REGISTRY` entry is added. No creep.
- Option (iii) (server-side gate) correctly untouched — the backlog records it as not implementable.
- Fragment byte-slice discipline preserved: both files still terminate `\n\n`, edits are confined to line 1, and no heading, table, or fence is disturbed. The composed monolith is structurally sound in both profiles (only the semantic reference dangles).

## Security

No findings. No trust boundary, no input parsing, no secret, no executable path — both files are prompt prose consumed by the composer. The one security-adjacent property in play is §3.2 builder≠judge integrity, and C1 degrades the *signal* for it rather than the property itself.

## Performance

No findings against the runtime. Prompt-cost accounting, per the brief's question 4:

- `coord-02`: +273B, tagged `host:claude-code` — paid only where dispatch is actually offered. Correctly targeted. The trailing clause "— the nudge's own condition is already satisfied, so dispatch per this paragraph" restates the first half; ~50B could come out without weakening the directive. Optional.
- `coord-03`: +338B, tagged `core` — paid on **every** `/teamwork` invocation on every host, including the lean profile where the WHEN/DO half is inapplicable at best and harmful at worst (C1). Fix (a) removes ~200B from every lean-host prompt while making the rule correct. Cost and correctness point the same direction here.

Composed sizes measured: 24,077B lean / 35,256B declared-CC.

## Verdict

CHANGES_REQUESTED — the coord-02 fix and the coord-03 visibility rule are split across the D6 host-capability axis, so under the default (undeclared `host`) profile the workspace receives the surfacing rule without the anti-nudge fix, where it dangles a reference to absent text (C2) and fires on every compliant hop (C1); both are fixable inside the two files already in cut, preferably by moving the WHEN/DO sentence into `coord-02-host-dispatch.md`.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Round-1 preferred fix (a) taken: the WHEN/DO surfacing sentence moved out of `content/coord-03-core-fallback.md` into `content/coord-02-host-dispatch.md` (`host:claude-code`-tagged). Diff is still exactly 2 files, 1 line each (`git diff --numstat -- content/` → `1 1` / `1 1`).
- **C1 closed** — verified by composing the coordinator under both profiles through the real render path.
- **C2 closed** — the dangling `(the fallback heuristic above)` pointer is gone; the replacement clause is genuinely self-contained, not a re-phrased pointer.
- **No new false positive introduced** by the co-location with the heuristic — the one place round 2 could have regressed. Analysis below (R2-N1).
- All three round-1 quality items and C3 addressed. Boundary honored: **zero bytes under `test/`**.
- Verdict: APPROVED.

## Correctness

**C1 — CLOSED.** Composed `skill-coordinator.md` under both capability profiles via the actual render pipeline (`composeSkill` → `expandPartials` → `parseSkillFile` → `applyTextTransforms({fullDetail:false})`, i.e. `stripOriginTags` then `stripRationale`, the exact order `prompts/build.ts:348-370` uses):

```
hostCapabilitiesFor(undefined)      -> { taskTool:false }   (lean; this repo's default —
                                       .current/.config.json still has no "host" key)
  "DO surface it in chat"                : 0 occurrences
  "builder ≠ judge downgrade"            : 0
  "IS that request"                      : 0
  "attempt the call once" (heuristic)    : 0
hostCapabilitiesFor("claude-code")  -> { taskTool:true }
  "DO surface it in chat"                : 1
  "builder ≠ judge downgrade"            : 1
  "IS that request"                      : 1
  "attempt the call once" (heuristic)    : 1
```

The rule and its two prerequisites (the anti-nudge premise, the dispatch heuristic) now compose as one atomic unit on exactly the profile where the `Task` capability exists. Grepping the full lean render for `surfac|announce|downgrade|§3.2|builder` returns only pre-existing hits (feature-split rec, stop conditions, opt-out, the escalation-route rows, the §3.2 visual-verdict boundary) — **nothing in the lean composition demands an announcement for behavior the lean SOP itself prescribes.** The round-1 every-hop misfire is structurally impossible now, not merely unlikely.

**C2 — CLOSED, and self-contained on inspection, not by assertion.** `coord-03:1` now reads: "reserved for genuine tool unavailability: the host advertises no `Task` tool, or the `Task` call returns a tool-error / unknown-subagent-type." Both disjuncts name a directly observable condition — an absent tool advertisement, and a concrete failure mode of a call the reader is about to make. Neither defers to text elsewhere: there is no "above", no "per the heuristic", no "as described". `grep "fallback heuristic above"` = 0 in both renders; `grep "unknown-subagent-type"` = 1 in the lean render (coord-03's own clause) and 2 in the CC render (coord-03 + coord-02's heuristic), which is exactly the shape a self-contained restatement produces — the same fact stated independently in each fragment — versus a pointer, which would show 1/1. Cross-fragment back-reference discipline in the `core` fragments is restored: the only `above`-pointers remaining there are the two pre-existing intra-file ones.

**R2-N1 (new in round 2, judged fresh) — the WHEN/DO now sits one sentence before the fallback heuristic. It DOES fire on heuristic-driven fallback, and that is the intended outcome.**

Trigger as written: "WHEN the fallback is taken while the host DOES advertise `Task` … → DO surface it in chat as a §3.2 builder ≠ judge downgrade". The heuristic two sentences later: "attempt the call once; on tool-error or unknown-subagent-type, fall back". In the unregistered-subagent case both trigger conditions hold — the host advertises `Task`, and the fallback is taken — so the rule fires. **Stating it explicitly, as the brief asks: yes it fires, and yes that is what I intended in round 1 when I wrote that surfacing the unregistered-subagent downgrade "is correct since that downgrade is real too."** It is a true positive, not a new false positive, and the distinction from the round-1 defect is categorical rather than a matter of degree:

- *Round-1 defect*: the rule fired on a lean-profile hop where the composed SOP offered **no dispatch mechanism at all**. The announced "downgrade" was the SOP's own prescribed behavior, on a host that structurally could not have done otherwise. Unactionable — nothing the human could change would silence it, so the signal decays to noise on the first hop.
- *R2-N1*: the rule fires when the coordinator genuinely wanted to dispatch, genuinely could have (`Task` is advertised), and genuinely did not — so the next role really does execute in the builder's own context, and §3.2 builder ≠ judge really is degraded for that hop. Actionable: the named reason points straight at `templates/claude-code-agents/`, and installing the templates silences it permanently.

The parenthetical "(e.g. under an external host-prompt nudge)" is non-restrictive, which is the right call — it keeps the nudge case as the motivating example without narrowing the rule to it, so the unregistered-subagent and transient-tool-error paths stay covered. Both of those are also real downgrades and correctly surfaced.

One reconciliation checked rather than assumed: `coord-03` still calls the fallback's degradation "graceful … for those hosts", and its host list includes "Claude Code without the templates installed" — the same case `coord-02` now requires announcing. These do not conflict. Round 1's "and silent" was the clause that would have contradicted the WHEN/DO, and it is dropped; "graceful" asserts the chain keeps working, which an announcement does not disturb. A CC-profile reader receives both fragments and gets a consistent instruction: fall back, keep going, say so.

**Acceptance criteria, re-checked against the composed output rather than the source files:** "coord-02 names `/teamwork` as the dispatch request" — yes, CC profile. "coord-03's fallback line is conditioned on genuine unavailability AND requires surfacing" — the conditioning is in coord-03 and reaches every host; the surfacing requirement is in coord-02 and reaches every host that can actually dispatch. That relocation is the fix, and it satisfies the criterion's intent (the defect E96 targets is closed wherever it can occur) rather than its literal fragment assignment. Correct trade.

**Residual, non-blocking (unchanged D6 debt, not this ticket's).** On an undeclared-`host` Claude Code workspace — this repo included — the lean SOP still offers `tw_switch_role` as the only path while `coord-03` now describes that path as "reserved for genuine tool unavailability", a premise false for that reader. The paragraph's imperative ("Call `tw_switch_role(<next_role>)`") is unconditional, so no reader is left without an instruction, and no announcement is demanded — which is why this is not blocking and why C1 is genuinely closed. It is the same pre-existing undeclared-`host` gap I flagged in round 1 as not yours to fix; the E96 prose makes it marginally more visible without depending on it.

## Quality

All four round-1 items verified in the diff, not taken on report:

- **C3 widened** — `coord-02:1` reads "an explicit `/teamwork` invocation (or equivalent explicit coordinator entry) IS that request". Covers the SessionStart-hook composition path, which carries no `/teamwork` invocation. Resolved.
- **`builder ≠ judge` spacing** — `grep "builder≠judge"` = 0 in both renders, `grep "builder ≠ judge downgrade"` = 1 in the CC render. Matches the incumbent spelling in the same file's visual-verdict row.
- **`<!-- origin -->` tags** — present on both spans, `(v3.105.0, E96)`, and `grep "origin:start"` = **0 in both rendered outputs**, confirming they are fully stripped and cost zero prompt bytes. Placement is clean on both sides of the strip: `…IS that request<!-- … -->.` → `…IS that request.`, and `…unavailability<!-- … -->:` → `…unavailability:` (verified verbatim in the lean render, line 78).
- **Trimmed tail** — the ~50B "— the nudge's own condition is already satisfied, so dispatch per this paragraph" is gone.
- **Restored standalone sentence** — `coord-03:1` again has "Call `tw_switch_role(<next_role>)` and follow the returned SOP in the same context." as its own sentence rather than merged into an em-dash clause. §1 surgical satisfied; the diff is now the minimum the behavior change requires.

Two new nits, neither blocking:

- `content/coord-02-host-dispatch.md:1` — the single `<!-- origin -->` tag sits after the *first* of the two inserted sentences, so a maintainer reading the tag could read the WHEN/DO sentence as pre-existing. One tag per file for one contiguous insertion is a defensible reading of the E43 precedent; moving it to the end of the inserted run would be unambiguous. Zero render cost either way.
- `content/coord-02-host-dispatch.md:1` — prose order now runs headline → exception → exception's escalation → the actual dispatch mechanic ("If the host advertises a `Task` tool…"). A reader meets the exception before the rule. Readability only; the referent "the Fallback below" is established by the preceding sentence and resolves to a `core` fragment that always composes, so nothing dangles.

## Architecture

The round-1 finding was one architectural mismatch (rule and premise split across the D6 host-capability axis) presenting as two symptoms. Fix (a) resolves it at the axis: the rule now lives entirely in the `host:claude-code` fragment, so it ships iff `hostCapabilitiesFor()` reports `taskTool: true`, and `coord-03` keeps only host-agnostic conditioning. That is the correct assignment — the WHEN/DO's trigger is defined in terms of a capability the tag already gates.

Byte-slice discipline intact: composing all seven fragments with `{taskTool:true}` and diffing against `test/fixtures/compose-golden/skill-coordinator-monolith.txt` yields **exactly two changed lines (81 and 114)** and nothing else — no heading, table, fence, or seam disturbed, no collateral. That is the minimality evidence the golden re-baseline in T-E96-02 will need.

Scope unchanged from round 1 and still clean: option (ii) absent (no handoff field read or written, nothing persisted — the rule surfaces in chat only), option (iii) untouched, no `GATE_REGISTRY` entry, no schema bump.

## Security

No findings. Both files are prompt prose consumed by the composer; no trust boundary, input parsing, secret, or executable path. The §3.2 builder ≠ judge integrity signal that round 1 found degraded is now correctly targeted rather than diluted.

## Performance

Re-measured independently through the real render path (post `stripOriginTags` + `stripRationale`, `fullDetail:false`), baseline = `HEAD:content/coord-0{2,3}` composed against the same unchanged sibling fragments:

| profile | pre-E96 | round 2 | delta |
|---|---|---|---|
| lean (`hostCapabilitiesFor(undefined)`) | 23,476 B | 23,585 B | **+109 B** |
| CC (`hostCapabilitiesFor("claude-code")`) | 34,308 B | 34,874 B | **+566 B** |

Cross-checked as invariant across `fullDetail:true`, and with/without `expandPartials` — all four variants give the same two deltas, so the figures are a property of the content, not of the measurement variant. (Raw pre-strip compose is +165 / +678; the difference is the two origin tags, which is the point of measuring post-strip.)

**Verdict on sr's reported figures: lean +109 B holds exactly. CC +559 B does not — the measured figure is +566 B, 7 bytes higher.** Direction, magnitude, and every conclusion drawn from it are unaffected, so this is a reporting-accuracy note rather than a finding; flagging it because the note it appeared in was truncated on the record (E92) and the number would otherwise be inherited unverified by QA.

Cost shape is now right: the lean profile pays +109 B for conditioning prose that applies to it, and none of the ~457 B of dispatch-specific rule text, which is billed only where dispatch is offered. Round 1 had that inverted.

Runtime: no findings — no code path changed.

## Verdict

APPROVED — fix (a) closes C1 structurally (verified by composing both profiles through the real render path: the WHEN/DO is absent from lean and present in CC, and nothing in the lean composition demands an announcement for its own prescribed behavior) and closes C2 with a genuinely self-contained clause; the rule's new adjacency to the fallback heuristic makes it fire on heuristic-driven fallback, which is a true positive of a real §3.2 downgrade and the outcome intended in round 1, not a new false positive; C3 and all three quality items are addressed, the `test/` boundary is clean at zero bytes, and the two suite reds are exactly the qa-owned T-E96-02 surfaces.
