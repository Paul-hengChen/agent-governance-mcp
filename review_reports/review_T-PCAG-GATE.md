# Review — T-PCAG-GATE (pm-cut-approval-gate)

> Round 1 — code-reviewer (opus) — 2026-06-26
> Diff vs working tree (`git diff HEAD`). Reviewed against `specs/pm-cut-approval-gate.md` (v1.0) + `specs/pm-cut-approval-gate-architecture.md` (v1.0).
> Clean-context: judged from spec + architecture + diff only; sr-engineer `pending_notes` commentary not used as a basis for the verdict.

## Summary

- Adds the `CUT_APPROVAL_REQUIRED` build-entry sub-gate (`index.ts`), a feature-scoped `cut_approved` write/parse path (`tools/handoff.ts`), the `hasCutApproval` predicate (`tools/evidence-file.ts`), a v4→v5 stamp-only migration (`schema/`), the transition-rejection union entry (`tools/transitions.ts`), and SOP/docs updates.
- All five high-risk areas verified correct: reset semantics (no stale-true path), gate placement/composition, SQLite-mode skip, migration purity, and the lock-file change.
- Reset-semantics algorithm traced across 9 scenarios (incl. the load-bearing QA-FAIL→PM same-feature re-arm) — all pass. The PM-re-entry clause is unconditional and closes every stale-true window exactly as the architecture specifies (§1).
- `npm run build` exits 0; `npm audit --audit-level=high` exits clean (only 1 LOW esbuild). YAML round-trip of `cut_approved` verified under the bumped js-yaml 4.2.0.
- Headline verdict: **APPROVED**. One advisory note on the lock-file scope (no change requested).

## Correctness

**Reset semantics (load-bearing) — CORRECT.** `tools/handoff.ts:457-482`. The consolidated algorithm:
- clause (1) `cutApproved === true` → emit `true` (PM approving now);
- clause (2) `isPmReentry` (`lastAgent==="pm" && status==="In_Progress"`) → `undefined` (unconditional re-arm);
- clause (3) non-PM, `existing.active_feature === activeFeature` → carry existing value;
- clause (4) feature changed → `undefined`.

`lastAgent` is `parsed.agent_id` (the writer of the *current* state — confirmed at `index.ts:1167`), so clause (2) correctly identifies "PM is writing In_Progress now." Traced all required reset points:
- PM explicit approve → true ✓
- PM re-entry omitting flag (same feature) → undefined (re-arm) ✓
- non-PM same-feature (architect / sr self-progress) → carry true ✓
- feature change → drop ✓
- **QA-FAIL → PM:In_Progress same feature → undefined** ✓ (this is the critical stale-true closure; the unconditional clause (2) fires before clause (3)'s same-feature carry can leak a stale `true`).

No stale-`true` carry path exists across features or across QA-FAIL→PM re-entry. The `cutApprovalNeedsExisting = cutApproved !== true && !isPmReentry` guard correctly limits the existing-state read to the only clauses that need it (3)/(4), reusing the single `parseHandoff` already done for prd_path/scope_decision — no extra I/O.

**Parse-side strict boolean — CORRECT.** `tools/handoff.ts:153` `frontmatter.cut_approved === true ? true : undefined`, emitted via the spread-guard at `:175`. Verified with a live js-yaml 4.2.0 round-trip: `true`→`true`; `false`, `"true"`, absent, and `yes` all → `undefined`. Write side emits only when `effective === true` (`:490`), never `false` — so absence stays the single unapproved sentinel on both read and write.

**Write side never emits `false`.** `tools/handoff.ts:490` `if (effectiveCutApproved === true) frontmatterData.cut_approved = true;` — matches the `scope_decision` falsy-guard precedent. No round-trip can materialize a stored `false`.

No off-by-one, race, or missing-edge issues. The write path remains inside the existing `withFileLock` + `verifyFreshness` envelope (unchanged).

## Quality

- Naming, comments, and structure mirror the `scope_decision` precedent 1:1 — `hasCutApproval` vs `hasScopeDecision`, `cutApproved` option, `effectiveCutApproved`. Convention-consistent.
- `frontmatterData` type widened from `Record<string, string | number>` to `Record<string, string | number | boolean>` (`tools/handoff.ts:425`) — minimal, correct, and required for the boolean field.
- Inline comments document the four-clause algorithm and the rationale for *not* copying `scope_decision`'s blind preserve. No dead code, no duplication.
- The heal-write (`readHandoffState`, `tools/handoff.ts:233`) still uses the positional overload (no `cutApproved` slot). For migrated legacy files this resolves to undefined via clause (2)/(3)/(4) — never seeds approval. Architecture §5 calls this out; behavior matches.

## Architecture

Implementation matches `specs/pm-cut-approval-gate-architecture.md` exactly:
- **Gate placement (§2):** `index.ts:810-857`, directly after the `SCOPE_DECISION_REQUIRED` block (`:772-808`), before evidence blocks. Same edge predicate, `prev=pm` pinned. Independent `if`, distinct error code, no merged envelope (D1) ✓.
- **Unconditional (D2):** no `hasDesignModeRequiringVisual` arm check on the cut gate — fires on every `pm→build` edge ✓.
- **Double-block safety:** predicate requires `prevTuple.agent === "pm"`. Confirmed via `tools/transitions.ts`: `architect:In_Progress→sr-engineer` (prev=architect) and the `sr-engineer:Blocked→sr-engineer:In_Progress` resume (prev=sr-engineer) both have non-pm predecessors, so the gate never re-fires mid-build. Within-feature non-PM writes carry the `true` forward via clause (3). Gate fires exactly once per cut ✓.
- **Migration (§5):** `schema/versions.ts` handoff 4→5; `schema/migrations-handoff.ts` v4→v5 `up: (input) => ({ ...input, schema_version: 5 })` — stamp-only, seeds nothing. AC-6/AC-7 satisfied. `sqlite` stays at 2 ✓. `docs/schema-versions.md` adds a handoff version-history table.
- **Transition union (`tools/transitions.ts:81`):** `"CUT_APPROVAL_REQUIRED"` added to `TransitionRejection["error"]` for handler-side narrowing only; `validateTransition` stays pure / fs-free ✓.
- **SOP (`skill-pm.md` 7a/8, `skill-coordinator.md` #6, `skill-coordinator-lite.md`):** matches AC-3/4/5/8 and §3/§4; step 7a/8 correctly forbid setting `cut_approved` before human approval; design-link rule reuses the baseline-manifest node-id token.

No contradiction with the architecture spec.

## Security

- `hasCutApproval` (`tools/evidence-file.ts:258`) is a pure `=== true` equality check — no fs access, no throw, no injection surface.
- The gate predicate trusts only the server-parsed prev-state boolean; there is no client-supplied string interpolated into a sink. The hint string is a static literal.
- **SQLite-mode skip is not bypassable.** `getActiveStorage() instanceof FileHandoffStorage` (`index.ts:818`). Confirmed `SqliteHandoffStorage implements HandoffStorage` (does NOT `extends FileHandoffStorage`, `tools/storage-sqlite.ts:127`), so the instanceof is `false` in SQLite/HTTP mode — gate correctly skipped, no inheritance path to defeat the guard. This is the intended file-mode-only scoping (D5); the field is handoff-YAML only and SQLite prev-state never carries it, so without this skip the gate would block every build entry in HTTP mode. Guard is correct.
- `cut_approved: z.boolean().optional()` (`index.ts:111`) bounds the client input; only `true` is meaningful, a client-passed `false`/omitted both fail the gate.

## Performance

No regression. The gate is an O(1) `instanceof` + boolean check on an already-parsed prev-state (`prevState` loaded once at `index.ts:734`). The reset logic adds **zero** I/O: clause (2) (PM re-entry) short-circuits `cutApprovalNeedsExisting` to skip the read entirely, and clauses (3)/(4) reuse the single `parseHandoff` already performed for prd_path/scope_decision preserve. No new loops, listeners, or caches.

## Lock-file change (focus item 5) — ADVISORY, not a change request

`package-lock.json` changed more than the sr-engineer note implied. Independent inspection of the diff:
- `version` 3.37.1→3.42.0 — the lock catching up to the already-committed `package.json` version (v3.42.0 shipped in commit `a9850a7`). Legitimate reconciliation, unrelated to this feature.
- `hono` 4.12.18→4.12.27 — the transitive HIGH the audit cleared. `hono` is an indirect (transitive) dep; **not** in `package.json` dependencies.
- `js-yaml` 4.1.1→4.2.0 — **direct, load-bearing** dep (handoff YAML parse/serialize, which this feature relies on). Within the `^4.1.1` range; package.json unchanged (correct). I verified the `cut_approved` round-trip under 4.2.0 (see Correctness) — no behavioral regression.
- `protobufjs` 7.6.2→7.6.4 (within `^7.5.8`, optional/transitive) and removal of `@protobufjs/inquire` — incidental tree cleanup from the same `npm audit fix`.

**Judgment: acceptable / in-scope.** All bumps are within the semver ranges already declared in `package.json`, which is correctly left unchanged; clearing a transitive HIGH satisfies AC-9's `npm audit --audit-level=high` exit-0 requirement (verified: clean, 1 LOW only). The js-yaml bump touches the parser this feature depends on, but the round-trip and full `npm run build` both pass, so the risk is covered. No revert needed. Flagged here purely so the trail records that the lock delta is broader than "just hono" — it is benign.

## Verdict

**APPROVED** — the cut-approval gate, feature-scoped reset semantics (verified free of any stale-true carry path), SQLite-mode skip, and stamp-only v4→v5 migration all match the architecture spec and satisfy AC-1/2/6/7/9; the lock-file delta is in-scope and benign.

> Note (clean-context / same-model bias): this review ran on opus; sr-engineer's model tier is not visible to me from the diff. If sr-engineer also ran on opus, treat the reset-semantics trace as the independent backstop — it was re-derived from the spec, not from the implementation comments. The 17 stale v4/token-cap test assertions are out of code-reviewer scope (qa-engineer / T-PCAG-QA) and were not evaluated.
