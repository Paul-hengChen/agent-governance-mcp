# Spec: d1-prompt-arg-workspace-fallback

## Problem Statement

`/teamwork*` prompts declare exactly one argument, `workspace_path`
(`PROMPT_WORKSPACE_ARG`, `tools/registry.ts:663-667`, optional). Claude
Code's slash-command convention stuffs any free text typed after the slash
command into that single argument slot — so `/teamwork-lite <question>` (or
`/teamwork 開始實作 D1...`) hands the entire free-text string to the server
as `workspace_path`. `resolveWorkspacePath()` (`index.ts:45-64`) currently
accepts *any* non-empty string arg literally as the resolved path with no
existence check:

```ts
if (typeof args?.workspace_path === "string" && args.workspace_path) {
  resolved = args.workspace_path;
  source = "workspace_path arg";
}
```

The resolved (bogus) path is then probed for `.current`/`tasks.md`
(`managed` is false), and `prompts/build.ts`'s S01a branch
(`build.ts:409-415`, shipped by C6, `specs/c6-c11-prompt-state-injection.md`)
correctly-but-misleadingly renders "`<free text>` is not an
agent-governance-managed workspace" — even though the real workspace (this
repo, resolvable via `CLAUDE_PROJECT_DIR`/cwd) has a perfectly good
`.current/handoff.md`. LIVE REPRO: 2026-07-10, this repo — `/teamwork 開始實作
D1...` produced exactly this S01a footer while `tw_get_state` on the real
workspace path returned full state.

This is a narrower defect than anything C6 fixed: C6 made the *existing*
three-way split (fresh / resolution-suspect / lookup-failed) fail loud and
transparent. D1 fixes *which branch fires in the first place* when the
`workspace_path` arg was never a path attempt at all — it was the user's
message, misrouted by the client's argument-passing convention.

## Mechanism

Add a shape-only heuristic, `looksLikePath(s: string): boolean`, colocated
with `resolveWorkspacePath()` in `index.ts`:

```ts
function looksLikePath(s: string): boolean {
  return /[/\\]/.test(s) || s.startsWith(".") || s.startsWith("~");
}
```

(True for absolute Unix paths, Windows paths, relative `./`/`../` paths, and
`~/` home-shorthand. False for prose — including multi-word free text,
questions, and non-Latin-script text — which essentially never contains a
path separator or a leading dot/tilde.)

`resolveWorkspacePath()`'s arg-acceptance branch changes from "any non-empty
string" to "non-empty string that looks path-shaped":

```ts
if (typeof args?.workspace_path === "string" && args.workspace_path
    && looksLikePath(args.workspace_path)) {
  resolved = args.workspace_path;
  source = "workspace_path arg";
} else if (process.env.CLAUDE_PROJECT_DIR) {
  resolved = process.env.CLAUDE_PROJECT_DIR;
  source = "CLAUDE_PROJECT_DIR env";
} else {
  resolved = process.cwd();
  source = "cwd fallback";
}
```

Everything downstream — `managed` probe, `WorkspaceSource` type, the S01a /
S01b / S02 footer branches in `prompts/build.ts` — is **unchanged**. Two
consequences fall out of this one gating change, both intentional:

1. **Non-path-shaped arg (the bug)**: falls straight into the existing
   `CLAUDE_PROJECT_DIR`/cwd chain, exactly as if `workspace_path` had never
   been supplied. The rejected text is discarded — not logged, not
   surfaced, not forwarded anywhere. Whatever the real workspace's state is
   (found, genuinely fresh, or a parse error) renders via the existing,
   unmodified S01b / normal-JSON / S02 branches.
2. **Path-shaped-but-missing arg (e.g. a stale/mistyped absolute path)**:
   behavior is **byte-identical to pre-D1** — `resolved` stays the bad arg
   itself (no fallback), `source` stays `"workspace_path arg"`, and the
   existing S01a "resolution suspect" footer fires exactly as it does
   today. This is a deliberate regression lock, not new behavior: someone
   who typed an actual (wrong) path still gets the diagnostic C6 built for
   them.

Shape-gating takes precedence over existence-checking in branch 1: a
non-path-shaped arg is discarded unconditionally, even in the vanishingly
rare case where it happens to coincide with a real directory name on disk.
This is a deliberate simplification (documented here so sr-engineer doesn't
need to make the call) — false positives in that direction are not a
reported failure mode.

This confines the entire production change to `index.ts`. **`prompts/build.ts`
requires zero changes** — the `WorkspaceSource` type and all three footer
branches (S01a/S01b/S02) are reused exactly as C6 shipped them.

## User Stories

- As a user invoking `/teamwork-lite <my question, in any language>`, I want
  the session to show my real project's state, so my free-text message
  doesn't get misread as a broken workspace path.
- As a developer who genuinely passes a stale/mistyped `workspace_path`, I
  want the existing "resolution suspect" diagnostic (C6) to still fire, so I
  can tell the difference between "you typed prose" and "you typed a path
  that doesn't exist."

## Acceptance Criteria

**AC-1 — Non-path-shaped arg falls back to cwd-based resolution**
Given `workspace_path` is a non-empty string that does not look path-shaped
(no `/`, no `\`, does not start with `.` or `~` — e.g. free-form natural
language, in any script),
When `resolveWorkspacePath(args)` runs,
Then it resolves via the same chain used when `workspace_path` is absent
(`CLAUDE_PROJECT_DIR` env, else `process.cwd()`); `source` is
`"CLAUDE_PROJECT_DIR env"` or `"cwd fallback"` — never `"workspace_path
arg"` — and the rejected string is not written or surfaced anywhere.

**AC-2 — Genuine existing-directory arg: unchanged**
Given `workspace_path` is a string that IS an existing directory on disk,
Then `resolved = args.workspace_path` and `source = "workspace_path arg"`,
identical to pre-D1 behavior.

**AC-3 — Path-shaped-but-missing arg: regression-locked, unchanged**
Given `workspace_path` is a string that looks path-shaped (contains `/` or
`\`, or starts with `.` or `~`) but does not exist as a directory on disk,
Then resolution is byte-identical to pre-D1: `resolved = args.workspace_path`
(no fallback), `source = "workspace_path arg"`, and the S01a "resolution
suspect" footer (`prompts/build.ts:409-415`) fires exactly as it does today.

**AC-4 — End-to-end repro fixed**
Given the 2026-07-10 repro conditions (a `/teamwork*` prompt fetched with a
free-text `workspace_path` arg, in a real managed workspace with a valid
`.current/handoff.md`),
When the prompt is fetched,
Then the footer renders the normal `## 📍 Current Project State
(Auto-injected)` JSON block reflecting the real state — not the S01a
"not an agent-governance-managed workspace" claim.

**AC-5 — Absent-arg behavior: unchanged**
Given `workspace_path` is absent entirely,
Then resolution is byte-identical to pre-D1 (regression test).

**AC-6 — Existing C6 footer tests still pass**
`test/prompt-state-footer.test.mjs` continues to pass with no existing
assertion weakened; new cases (AC-1, AC-3) are added to it or a new
sibling test file.

**AC-7 — Full suite green**
`npm test` passes after the change, with no test deleted or weakened to
achieve green.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no new user-facing copy — reuses the S01a/S01b/S02 footer text verbatim, unchanged, from `specs/c6-c11-prompt-state-injection.md` |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-internal, non-design) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Redesigning the MCP prompt-argument contract (e.g. adding a second,
  dedicated free-text argument alongside `workspace_path`) — out of scope;
  this fix only changes which condition gates acceptance of the existing
  single argument.
- Any refinement of the `looksLikePath` heuristic beyond the exact
  definition in Mechanism (e.g. locale-aware or NLP-based free-text
  detection) — out of scope. A prose string that happens to contain `/`
  (e.g. a URL pasted mid-sentence) is treated as path-shaped and keeps the
  suspect footer; that is an accepted false-positive, not a defect.
- Any change to `prompts/build.ts`'s `WorkspaceSource` type or the S01a /
  S01b / S02 footer text — C6 owns that surface; this feature reuses it
  unchanged.
- C7/C8/C9/C10/C12/D2/D3/D4 or any other open backlog ticket.
- New `schema_version` bump — this feature touches no persisted schema.

## Dependencies / Prerequisites

- Builds directly on C6 (`specs/c6-c11-prompt-state-injection.md`, shipped
  v3.48.0, commit `5579073`) — `resolveWorkspacePath()` (`index.ts:45-64`)
  and the S01a/S01b/S02 footer branches (`prompts/build.ts:382-416`) it
  introduced are the exact surfaces this feature gates in front of. Read
  that spec before implementing.
- No external references (Resource Audit Gate: zero hits — grepped
  `docs/backlog.md` D1 entry and this spec's own sources for
  `http(s)://`/figma/ticket references; none found — pure internal code
  fix, no design source).
- Heuristic definition (`looksLikePath`, Mechanism section above) is an
  authored-here PM decision, not deferred to architect — the change is
  confined to one function's gating condition in one file
  (`index.ts:resolveWorkspacePath`); no cross-cutting data model or
  multi-module design question exists here. sr-engineer implements the
  Mechanism section literally.

## Tasks

- [ ] D1-01 [P0] sr-engineer: add `looksLikePath()` and gate
  `resolveWorkspacePath()`'s arg-acceptance branch in `index.ts` per the
  Mechanism section (AC-1, AC-2, AC-3, AC-5). | depends_on: none
- [ ] D1-02 [P0] code-reviewer: review the diff — confirm AC-1/2/3/5 match
  the spec's Mechanism exactly, confirm zero changes landed in
  `prompts/build.ts` (WorkspaceSource type + S01a/S01b/S02 text untouched),
  confirm no regression to existing C6 resolution/footer tests. | depends_on: D1-01
- [ ] D1-03 [P0] qa-engineer: extend `test/prompt-state-footer.test.mjs` (or
  add a sibling file) covering AC-1, AC-3, AC-4, AC-5, AC-6; run `npm test`
  full-suite green (AC-7). | depends_on: D1-02
- [ ] D1-REL [P1] release-engineer (post-PASS): version bump, CHANGELOG
  entry, build, tag, release per skill-release-engineer. | depends_on: D1-03
- [ ] D1-DONE [P2] pm/coordinator (post-release): mark backlog D1 done in
  `docs/backlog.md` with mechanism summary and commit reference. | depends_on: D1-REL
