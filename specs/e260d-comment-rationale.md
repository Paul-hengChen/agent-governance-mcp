# e260d comment rationale

Rationale moved out of long comment blocks in `gates/`, `prompts/`, `schema/`, `lib/`, `guards/`, `transport/` and `index.ts` by lane e260d of ticket E260 (spec: `specs/e260d-core-dirs-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260d-comment-rationale.md (gates/feature-lease.ts).`, and the text it points to lives in the section named after its source file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the code, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260d/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet; tasks T-E260D-02 to T-E260D-07 add rows |

## gates/feature-lease.ts

The lease semantics (derive-only lease, `Blocked` counts as held, TTL expiry, fail-open on an unparseable or future-dated stamp) are in `specs/e1-feature-scoped-state-design.md`, including its 2026-07-12 amendment. The broadened closing-write marker (the `pending_notes[0]` `/^Released v/` disjunct, the two incidents behind it, and the file-mode-only call-site scoping) is in `specs/e13-terminal-marker-advisory.md`. Neither is copied here.

What no spec held is why `isReleaseClosingWrite` is a separate export. Before it was extracted, the lease predicate carried the whole closing-write test while the stale-dispatch advisory in `tools/handoff-parse.ts` carried none, so a released feature's closing write still read as a stale in-flight dispatch. Writing the same test a second time in that module would turn the asymmetry into a later divergence. One predicate with two callers cannot diverge, so the lease predicate and the advisory both call this one function, and its behaviour is identical to the condition it replaced inside `isFeatureLeaseHeld`.

## gates/stamp-provenance.ts

The stamp shape itself is in `specs/e9a-stamp-integrity.md`. The gate was added after a third hand-edited-stamp incident, in which a release subagent with no MCP path edited `.current/handoff.md` by hand and wrote zero-entropy stamps such as `2026-07-14T00:00:00.000Z`. It turns the read-only stamp advisory in `tools/drift.ts` into a block on the file-mode write path, so the next writer must record the anomaly instead of silently overwriting the evidence.

- One predicate: the regex lives here, and the read-side advisory and the write-side gate both call `isHandAuthoredStamp`, so they cannot drift apart. Server stamps come from `new Date().toISOString()` and carry millisecond entropy; seconds `00` with milliseconds `.000` matches every confirmed hand-authored stamp in handoff history and is very unlikely from the server.
- Note only, no boolean: `lease_override` pairs a boolean (the intent to bypass a lease that is legitimately held) with an audit note, and an unaudited boolean gets its own reject. Here the gate arms from the on-disk state alone, there is no separate intent to declare, and the `stamp-remediation:` note is both the acknowledgment and the audit trail. A boolean would add tool surface without adding trust.
- Self-disarming: any accepted write stamps a fresh `now()`, so the gate clears itself. A remediation write must therefore be a normal write; a `bookkeeping_write` keeps the suspect stamp.
- File mode only: SQLite and HTTP stamps come from the database write path, as for the sibling attestation gates. A new workspace with no previous state is never gated.

## gates/pipeline.ts

The ordered `UPDATE_STATE_GATE_PIPELINE` array lives in `tools/handoff-orchestrator.ts`, not in this module. Each step body there was moved byte for byte from the inline `if` block it replaced, and several tests assert those literals against that file: error codes, arm-predicate names, envelope keys and even guard indentation (`test/error-code-contract.test.mjs`, `test/ac-execution.test.mjs`, `test/gates-expected-red.test.mjs`). Moving the array here would break those source pins without changing behaviour.

This module stays a runtime near-leaf: every import is `import type`, erased at compile time, and `runUpdateStatePipeline` needs none of them at runtime. The runtime import chain is `tools/registry.ts` to `tools/handoff-orchestrator.ts` to `gates/pipeline.ts`, with only erased type-only edges pointing back, so it cannot form a cycle.

The per-write context is derived once, in the context-building phase of `handleUpdateStateCore` (previous-state parse, round and hop inputs, `feature_changed`, the evidence-schema pin). A gate step must not derive a value that later steps or the final write depend on, because that would make step order affect more than which rejection wins.

## gates/visual.ts

The visual report schema validator exists because the earlier gate checked only that the report file existed and that no widget row was left unchecked, and a visual false-PASS showed that evidence existing is not the same as evidence being meaningful. The required sections, the row checks and the verdict rule are in `specs/constitution-v3.27-sync-consistency-architecture.md`.

- No authorship check on `## Allowed Differences`: the visual report is read only on a qa-engineer PASS, so its contents are already within QA's authority. The coordinator override that broke an earlier rollout came through the dispatch prompt, which the builder-is-not-judge rule now blocks, not through this file. The validator therefore does not search the report for "coordinator policy" markers, which would be brittle and easy to game.
- Opt-in by design contract: the caller runs the validator only when the design declares `## Visual Structural Assertions`, which every design-auditor since the schema gate emits for a mode other than `no-design`. Older designs lack the section, so their visual reports keep passing on the existence and widget-shape checks alone.

The other visual sub-gates point to their own specs from the code: `specs/qa-visual-baseline-provenance.md`, `specs/qa-visual-pixel-gate-attestation.md`, `specs/figma-baseline-manifest-gate.md`, `specs/e4-design-source-credibility-gate-architecture.md`, and `specs/e23-evidence-schema-versioning.md` for where the verdict heading is found.
