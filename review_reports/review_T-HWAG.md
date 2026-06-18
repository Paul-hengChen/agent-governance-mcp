# Review — T-HWAG-01 — handoff-write-arg-guard

## Round 1 — APPROVED — by code-reviewer

## Summary

- Adds two `.refine()` guards to the **existing** `UpdateStateArgs` Zod chain in `index.ts` (lines 122–138), appended after the PASS/agent_id and prd_path-traversal refines on the same schema object — not a new schema.
- Guard A: rejects `workspace_path` whose `path.basename()` equals `.current` (prevents doubly-nested `.current/.current/handoff.md`).
- Guard B: rejects `active_feature === "[object Object]"` (the canonical JS object-stringification sentinel).
- Version bumped `3.40.0 → 3.40.1` (package.json + `index.ts` Server() literal); CHANGELOG `## [3.40.1]` PATCH entry present; constitution header correctly left at v3.40.0.
- Scope is surgical: only schema chain + version literals + CHANGELOG + task-tracking files touched; `npm run build` clean (0 tsc errors), `check:version` OK.

## Correctness

- **Guard A — basename equality, no substring false-positive** (`index.ts:126`): `path.basename(d.workspace_path) !== ".current"`. This is exact-equality on the final path segment, NOT substring matching. A legitimate repo whose name *contains* "current" (e.g. `/home/u/my-current-project`, basename `my-current-project`) passes cleanly; only a workspace_path whose terminal segment is exactly `.current` is rejected. `path.basename` also strips a trailing separator (`/repo/.current/` → `.current`), so the trailing-slash form is caught too. Matches AC-2. Correct.
- **Guard B — exact sentinel equality, cannot reject a legitimate id** (`index.ts:135`): `d.active_feature !== "[object Object]"`. Only the exact literal `"[object Object]"` is rejected; no normal feature id (kebab-case, ticket ids) collides. Matches AC-3. Correct.
- **Positive path (AC-1)** preserved: a valid absolute non-`.current` root + plain string id satisfies the base object schema and all four refines, so the call still succeeds.
- **AC-4** (fail at parse boundary): both checks live inside the Zod `.refine()` chain, so a violation throws a `ZodError` at `.parse()` time before any storage write — no corrupt nested path is created and no sentinel string reaches `handoff.md`. Correct.

## Quality

- Error messages are byte-exact to the spec Copy table (`ERR_WORKSPACE_CURRENT`, `ERR_ACTIVE_FEATURE_OBJECT`) and each refine sets the correct `path:` key (`workspace_path` / `active_feature`) so `formatZodError` attributes the failure to the right field.
- Comment blocks on each refine explain the *why* (transport pre-stringification, append-path mechanics) — consistent with the surrounding refine-comment convention. No dead code, no duplication.

## Architecture

- Per spec Out-of-Scope: the `.current` guard is added to `UpdateStateArgs` only, NOT to the shared `absoluteWorkspacePath` base refine (which other tools reuse). Confirmed — `absoluteWorkspacePath` (lines 72–75) is untouched. No schema/migration change, no new field. Matches the architecture constraint in the spec exactly.

## Security

- Both guards tighten the input boundary (fail-loud, Constitution §7). They are appended after — and do not shadow or short-circuit — the existing security-relevant refines: the `status="PASS"` ⇒ `agent_id="qa-engineer"` gate (line 108) and the `prd_path` traversal guard (line 114) both still fire independently. No new injection surface; the sentinel guard reduces one corruption vector.

## Performance

- Two constant-time predicate evaluations per `tw_update_state` call (`path.basename`, one string compare). No loops, no I/O, no algorithmic regression vs base.

## Verdict

**APPROVED** — both guards are correct, surgically scoped, byte-exact to spec, do not false-positive on legitimate inputs, and do not disturb the existing refine chain or the positive validation path.
