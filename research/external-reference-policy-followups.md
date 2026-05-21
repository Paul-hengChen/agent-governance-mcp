# Research brief — External-reference policy follow-ups + v3.7.2 packaging regression

**Filed**: 2026-05-21
**Author**: coordinator-lite (post-mortem of `cde-oobe` rollout + v3.7.2 install verification)
**For**: `researcher` role
**Status**: open

This brief packages five threads that surfaced in the 2026-05-20/21 session
and were too speculative or too cross-cutting to land in v3.7.2 itself.
Researcher should investigate each, produce design notes / experiments,
and hand off to PM if any of them warrant a feature ticket.

## Context summary

The `cde-oobe` Android wizard for ViewSonic CDE 31/14 shipped a full
22-task implementation under the agent-governance chain (pm → architect →
sr-engineer → qa-engineer) and PASSED QA on 2026-05-20. **The
implementation never loaded the Figma URL referenced seven times in the
PRD** because:

1. PM didn't have a Resource Audit step. The 7 `UI設計圖：Figma URL`
   strings were not classified before the spec was written.
2. Architect unilaterally declared the Figma link out-of-scope inside
   its own architecture doc — no role-level rule required user
   confirmation.
3. sr-engineer/qa-engineer trusted both upstream artifacts and never
   noticed the gap.

v3.7.2 (Constitution v3.5.3, shipped 2026-05-21) added three-layer
enforcement: §7 *External-reference policy* + skill-pm *Resource Audit
Gate* + skill-architect *Deferred Resources* H2 + *Sanity Gate*.

That ships the static rules; the follow-ups below ask whether the rules
are *enforceable* and whether adjacent gaps exist.

---

## Thread 1 — Server-enforce the Resource Audit Gate (not just SOP text)

**Question**: §7 says "no role may unilaterally treat references as
out-of-scope" but the enforcement lives in the skill markdown. A
non-compliant agent can still ignore it. Can we make the server check?

**Hypotheses to validate**:

1. **PM-spec parser** at `tw_update_state` time: when PM writes a new
   `specs/<feature>.md`, the server could grep the linked PRD for
   `http(s)://`, `figma`, `mockup`, `設計圖`, etc. and refuse to record
   the state transition unless the spec's *Dependencies / Prerequisites*
   section mentions each hit by URL/identifier.
2. **Architect cross-check** at handoff time: when architect's state
   transition fires, server diffs `Deferred Resources` against PRD-found
   refs and rejects mismatches.
3. Both gates would need a clean PRD reference (server reads
   `state.prd_path` — already available since v3.3.0 RAG lifecycle).

**Risks**:
- False positives on code-fence URLs, footnote URLs, archived links.
- PRDs with hundreds of references would create noisy gates.
- May entangle with the existing `tw_index_prd` lazy reindex.

**Deliverable**: design note + small proof-of-concept regex. If green,
write PRD for a v3.8.x feature.

## Thread 2 — Figma / image MCP integration in PM skill

**Question**: Right now the PM Resource Audit Gate asks user
`fetch / index / ignore` per hit. For Figma specifically, "fetch" today
means the user pastes the link into a Figma MCP tool. Could PM skill
*recommend* an MCP tool by hostname?

**Sketch**: hostname → suggested MCP server map:
- `*.figma.com` → `figma` MCP
- `*.sketch.com` → `sketch` MCP
- `dev.azure.com/*/_workitems/*` → `azure-devops` MCP (`wit_get_work_item`)
- `*.atlassian.net/browse/*` → JIRA MCP

If the user runs `fetch`, PM could surface the right tool name and
example invocation. Reduces friction; raises adoption of the gate.

**Risks**: MCP availability varies per workspace; PM must degrade
gracefully when no matching server is connected.

## Thread 3 — Researcher role auto-spawn when references are heavy

**Question**: When PM's Resource Audit finds, say, ≥ 5 external refs,
should PM auto-route to `researcher` first (instead of architect /
sr-engineer)? The researcher would fetch + summarise the references into
`research/<topic>.md`, then PM finalises the spec with the references
already digested.

This formalises a pattern that currently lives in the routing chain
diagram (`researcher (optional) → pm`) but doesn't have a trigger
condition.

## Thread 4 — Token cost of the new gate

**Question**: The Resource Audit Gate adds an `AskUserQuestion` step
per reference. A PRD with 7 refs (like CDE OOBE) needs 7 confirmations
or one multi-select. Measure the added latency / token cost on a
real-size PRD and decide whether to bundle the gate into a single
multi-question prompt or keep it per-ref for clarity.

**Comparison baseline**: `research/token-efficiency-audit-v2.md`
(v3.3.0+ drift compression + pending_notes truncation).

## Thread 5 — **REGRESSION** v3.7.2 npx install missing `content/` files

**Severity**: P0 — blocks new users of v3.7.2.

**Symptom**: After `npx clear-npx-cache` + re-install at `#v3.7.2`,
SessionStart hook surfaces:

```
[ERROR: constitution.md not found at /Users/paul.ph.chen/.npm/_npx/c6c6c7b2ad1e9b93/node_modules/agent-governance-mcp/content/constitution.md]

[ERROR: skill-coordinator-lite.md not found at .../content/skill-coordinator-lite.md]
```

**Reproduction**: confirmed locally 2026-05-21 immediately after
`v3.7.2` tag was pushed. The MCP server binary itself loads fine
(`{"name":"agent-governance-mcp","version":"3.7.2"}` returned from
`initialize`), but the `content/` directory isn't in the installed
package tree.

**Hypotheses**:

1. `package.json` `"files"` field omits `content/` — npm pack uses it
   to decide what ships. Check `npm pack --dry-run` to confirm.
2. `.npmignore` (if any) ignores `content/`.
3. The npx GitHub-tarball path uses different inclusion rules than
   `npm pack`; check whether GitHub's `tarball_url` includes `content/`.
4. Build step (`tsc`) clears the working dir before bundling? Unlikely
   since `content/` is source, not build artifact, but worth confirming.

**Why now**: v3.7.1 didn't surface this — either v3.7.1 was installed
from a cached tarball that had `content/`, or v3.7.1 actually shipped
without `content/` too and nobody noticed because the SessionStart hook
loaded from the local clone instead of npx. The 2026-05-21 verify run
was the first true cold install.

**Action**: researcher should reproduce, identify the inclusion rule
that drops `content/`, write a v3.7.3 patch ticket. PM picks up from
there with a hotfix release.

**Side-effect on the very session this brief was written in**:
SessionStart errors are non-fatal but the constitution is currently
missing from the auto-inject for any agent the user invokes via npx
v3.7.2. Locally-cloned development workflows (this session) keep
working because the hook resolves the path against the dev clone.

## Thread 6 — Copy / strings drift (closed in v3.7.3)

**Status**: shipped 2026-05-21. Documented here for the post-mortem
chain — researcher can use this as the worked example for how to
diagnose a category of failure that fell outside the v3.5.3 gates.

**Symptom**: the `cde-oobe` Language step shipped the title
`"Select your language"`. The Figma frame (node `290:6616`) renders the
literal title `"Language"`. The PRD only describes the step's function
(`"功能：選取系統主要語系"`), not its title string. Five other step
titles drifted similarly (`"Choose orientation"`, `"Pick a mode"`,
`"Connect to a network"`, `"Set date and time"`).

**Where each layer failed**:

1. **sr-engineer (Phase I T01–T22)** invented copy because no source
   existed. Constitution §1 *Match conventions* says "when in doubt,
   grep" — but there was nothing to grep, so the engineer paraphrased
   the PRD's function description into UX prose. That's an LLM-typical
   move and the rules didn't forbid it.
2. **Figma-alignment passes (T23–T28)** focused the subagent extract
   on visual tokens (color, type, geometry, selection style). The
   Explore prompts never asked "audit user-facing strings against the
   design"; subagents answer the question asked.
3. **qa-engineer mappings** matched stylistic ACs (font/size/color)
   to tests but the spec had no AC for "title text = X", so coverage
   for copy was structurally invisible. spec-to-test mapping cannot
   close a gap that the spec doesn't open.

**Why v3.5.3 didn't catch it**: External-reference policy forced the
Figma to be *fetched* but didn't require the fetched copy to be
enumerated in the spec. "Figma is the source of truth for visuals"
was the implicit assumption; nobody promoted "Figma is the source of
truth for words" to a rule.

**Fix shipped (v3.7.3)**:
- `skill-pm` Spec Schema: new **Copy / Strings** H2. PM lists every
  user-facing string in a `string id | exact text | source` table.
  Source is one of PRD section, Figma node id, ticket ref, or
  `authored-here` with one-line justification. PM blocks if any string
  has no source.
- `skill-qa-engineer` Phase 1 step 3a: new **Copy Audit Gate**. QA
  greps the implementation for each spec'd string and FAILs on either
  drift (impl ≠ spec) or coverage gap (impl introduces a string not in
  the spec — bounces back to PM, not sr-engineer).

**Open follow-ups for researcher**:

1. **Should `Copy / Strings` extend to assets too?** — image filenames,
   icon labels, button accessibility descriptions. Investigate whether
   adding a separate `Assets` H2 helps or just bloats the spec.
2. **Should the Copy Audit Gate run server-side?** — same shape as
   Thread 1 (server-enforced Resource Audit). The gate currently lives
   in the QA skill markdown; an agent that skips QA bypasses it.
   Server enforcement would require the server to read the spec's
   *Copy / Strings* table and grep the workspace. Heavy lift; flag for
   feasibility study.
3. **Localised strings**: the spec table holds the canonical
   English. For 15-locale projects like CDE OOBE, what's the right
   shape for non-English keys — extend the table, or rely on a
   separate i18n review ticket?

**Hand-off**: this thread is closed for v3.7.3; researcher only
needs to pick up #1–#3 above if/when the user authorizes.

---

## Suggested research order

1. **Thread 5** first (P0 regression — others depend on a working install).
2. **Thread 1** (server-side enforcement is the highest-leverage
   structural improvement).
3. **Threads 2-4** in any order — they're additive improvements.
4. **Thread 6 follow-ups** (assets H2 / server-side audit / i18n
   shape) only if user authorizes — main thread is already closed in
   v3.7.3.

## Hand-off when done

Each thread should produce one `research/<thread-slug>.md`. Recommend
PM tickets only for threads whose hypotheses survive investigation.
