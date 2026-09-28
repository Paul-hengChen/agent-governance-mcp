# handoff-write-arg-guard

## Problem Statement

`tw_update_state` accepts two malformed arguments silently, producing corrupt
handoff writes instead of rejecting the caller.  (1) When `workspace_path`
points to the `.current/` state directory rather than the workspace root, the
server appends `.current/handoff.md` to that path, writing a doubly-nested
`.current/.current/handoff.md` instead of rejecting the call.  (2) When
`active_feature` is passed as a JavaScript object at the call site, the MCP
transport stringifies it to the literal `"[object Object]"` before the Zod
layer sees it; the existing `z.string().min(1).max(500)` check passes it
through and the corrupt sentinel string is persisted verbatim.  Both defects
violate the "fail loud" principle (Constitution §7) and the server's promise
to reject invalid `tw_update_state` writes (§3.1).

## User Stories

- As a subagent calling `tw_update_state`, I want the server to reject a
  `workspace_path` that ends in `.current`, so that I get a clear error
  directing me to pass the workspace root instead of silently writing a
  corrupt nested handoff.
- As a subagent calling `tw_update_state`, I want the server to reject
  `active_feature: "[object Object]"`, so that I get a clear error telling me
  to pass a plain string id instead of silently persisting a corrupt sentinel
  value.

## Acceptance Criteria

### AC-1 — valid args still accepted (positive baseline)

Given a `tw_update_state` call where:
- `workspace_path` is an absolute path whose basename is NOT `.current` (e.g.
  `/workspace/my-repo`), and
- `active_feature` is a plain non-empty string that is not `"[object Object]"`

When the call is validated by Zod

Then the call succeeds (no validation error is thrown).

### AC-2 — `.current` workspace_path rejected

Given a `tw_update_state` call where `workspace_path` is an absolute path
whose `path.basename()` equals `.current` (e.g.
`/workspace/my-repo/.current`)

When Zod validates `UpdateStateArgs`

Then the call is rejected with a Zod validation error whose message contains
the text `"workspace_path must be the workspace root, not the .current state directory"`.

### AC-3 — `"[object Object]"` active_feature rejected

Given a `tw_update_state` call where `active_feature` is the exact string
`"[object Object]"` (the canonical JavaScript object-stringification sentinel)

When Zod validates `UpdateStateArgs`

Then the call is rejected with a Zod validation error whose message contains
the text `"active_feature must be a plain string id, not a serialised object"`.

### AC-4 — error is raised at the Zod parse boundary (not silently swallowed)

Given either malformed arg from AC-2 or AC-3

When the MCP handler processes a `tw_update_state` call

Then the tool returns a structured error response (not a corrupt write and not
a silent no-op); the `.current/.current/` nested path is never created, and
the sentinel string `"[object Object]"` is never written to `handoff.md`.

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| ERR_WORKSPACE_CURRENT | `"workspace_path must be the workspace root, not the .current state directory"` | authored-here — this is a new validator error message with no external design source |
| ERR_ACTIVE_FEATURE_OBJECT | `"active_feature must be a plain string id, not a serialised object"` | authored-here — this is a new validator error message with no external design source |

## Visual Tokens

N/A — this feature has no visual surfaces.

## Visual Widgets

N/A — this feature has no non-primitive widgets.

## Visual Structural Assertions

N/A — no-design feature; `design/handoff-write-arg-guard.md` does not exist and no visual surfaces are involved.

## Out of Scope

- General prevention of all possible object-serialisation artifacts beyond the
  `"[object Object]"` sentinel.  A deep type check cannot work at this layer
  because the object is already stringified before Zod sees it; `"[object Object]"`
  is the pragmatic, cheaply-guardable canonical form.  Other artifacts (e.g.
  `"[object Promise]"`, `"[object Array]"`) may be addressed in a future
  hardening pass if observed in the wild.
- Validation changes to any tool other than `tw_update_state` (`UpdateStateArgs`
  in `index.ts`).
- Schema/migration changes.  This is purely input validation on an existing
  tool; no new fields, no handoff schema bump.
- Changes to `absoluteWorkspacePath` (the shared base refine used by all
  tools) — the `.current` guard is added only to `UpdateStateArgs` where the
  path feeds directly into the `.current/handoff.md` construction.

## Dependencies / Prerequisites

- No external references found in the bug description (Resource Audit: no
  URLs, Figma links, or ticket references present).
- Existing `absoluteWorkspacePath` refine (line 72–75 of `index.ts`) already
  checks `path.isAbsolute()`; the new refinements extend `UpdateStateArgs`
  via additional `.refine()` calls, not the shared base.
- Version bump: `3.40.0` → `3.40.1` (PATCH — bug fix, no tool-surface or
  schema change; per the CHANGELOG versioning policy).
- Constitution header: no bump — no new governance behaviour; input hardening
  only.
- This fix does NOT require an architect pass.  There is no new interface, no
  data-model or migration change, and no cross-cutting API surface affected.
  Two `.refine()` additions to one Zod schema in `index.ts` plus tests.
  Next role: sr-engineer.
