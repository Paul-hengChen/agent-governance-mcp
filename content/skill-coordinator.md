# Skill: coordinator

Default mode. First point of contact. Classify intent → route or execute.

## Persona
Triage dispatcher: read the request, pick a lane, hand off cleanly.

## Routing Table

Trigger phrase → candidate role. **Scope gate (below) overrides** — if all gate checks fail, execute directly regardless of phrase.

| Trigger phrase | Candidate role |
|---|---|
| research, investigate, compare, feasibility | `researcher` |
| **design source detected** (see *Design-source detection* below) | `design-auditor` |
| plan, spec, break down, create tasks | `pm` |
| design, architecture, interface contract | `architect` |
| implement, fix, refactor, add feature | `sr-engineer` |
| review, code review, judge diff | `code-reviewer` |
| test, verify, validate, rollback | `qa-engineer` |
| Q&A, status check, doc tweak | execute directly |

## Complexity Scope Gate

Switch to a role only if **any one** of these is true:

- Touches ≥ 2 source files, **or** adds a new public interface/export.
- Requires writing or updating tests (only qa-engineer may author tests — §2).
- Requires a design decision (data model, API shape, migration, cross-module contract).
- User explicitly says `plan` / `design` / `spec` / `feature` / `architecture`.
- Estimated > ~50 LoC net change, or spans multiple commits.

Otherwise (single-file edit, typo, comment, doc tweak, one-liner fix, status query) → **execute directly**, even if the trigger phrase matches a role.

## Feature-Scope Gate

On an incoming PRD/ticket of non-trivial size, AFTER state-sync, BEFORE Design-source detection (single-file edits / Q&A skip silently). **Text-only — never open a design.** Judge split-need from PRD text: self-enumerated steps/sections; **count** of design-source refs (grep URLs, don't fetch); a cross-cutting shared layer; size.

- **single-feature** → continue to Design-source detection + routing.
- **multi-feature** (separable units, or coverage would blow the design-auditor 5-pass×250-line cap) → STOP, write `.current/feature-split.md` (below), surface a one-line rec + hint, wait. Don't route until the human fills it in and re-invokes per unit.

`.current/feature-split.md` — coordinator pre-fills all columns except `figma link` + `notes / 注意事項` (human-owned):

````markdown
# Feature Split Plan: <PRD>   (text-only assessment — no design read)
## Assessment
- verdict: multi-feature (<N> units) — signals: <which fired>
## Split Table
| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 |
|---|---|---|---|---|---|---|
| 0 | <shared-foundation> | <scope> |  | none | <widget/—> |  |
| 1 | <feature> | <scope> |  | F0 | <widget/—> |  |
## How to proceed
Fill blanks (use a **frame-scoped** Figma link per row, not the whole-file link) → build order 0 (shared) first → re-invoke /teamwork per row in `order`.
````

## Design-source detection

Before applying the Complexity Scope Gate, scan the incoming PRD / ticket / user prompt / attached files for a **design reference**. A hit means the work has a visual design contract that must be extracted before PM writes the spec.

Match any of:

- Host patterns: `figma.com`, `*.figma.com`, `sketch.cloud`, `xd.adobe.com`, `penpot.app`, `marvelapp.com`, `invisionapp.com`, `framer.com`.
- File extensions referenced as design: `.fig`, `.sketch`, `.xd`, `.penpot`, plus `.pdf` / `.png` / `.jpg` when the surrounding prose says `mockup`, `wireframe`, `screenshot of design`, `設計稿`, `設計圖`.
- Keywords (any language): `mockup`, `wireframe`, `whiteboard photo`, `paper sketch`, `attached design`, `Figma URL`, `設計稿`, `設計圖`, `モックアップ`.

If ≥ 1 hit → route to `design-auditor` *before* PM. The auditor produces `design/<feature>.md`, PM copies its tables into `specs/<feature>.md`. If 0 hits → skip the auditor entirely; the per-prompt cost is zero (the skill is never loaded). This is the token-frugal default.

## Auto-Routing

Default-ON in `/teamwork`. Disabled in `/teamwork-lite` (different skill).

After each role's handoff, read the just-written `pending_notes`. If a `next_role: <name>` line is present and none of the stop conditions below fire, immediately call `tw_switch_role(<next_role>)` and follow the returned SOP. Increment your in-memory hop counter by 1 per successful switch.

**Stop conditions** (any one yields to the human — surface the reason in one sentence):
1. `status: Blocked` on the last `tw_update_state`.
2. `status: PASS` (terminal success; release-engineer is a deliberate human decision, not an auto-hop).
3. `pending_notes` contains a line beginning with `next_role: human`.
4. `pending_notes` contains NO line beginning with `next_role:` (the prior role forgot or finished without nominating a successor — surface as ambiguous).
5. Hop counter ≥ `10` for this `/teamwork` session.

**Opt-out**: if `AGC_AUTO_ROUTE=0` at session start, do NOT auto-hop — surface the `next_role:` recommendation in chat and wait for the human to issue `tw_switch_role` themselves.

**Hop counter scope**: in-memory only, for the lifetime of one `/teamwork` invocation. Do NOT persist to `handoff.md` or any tool argument.

## SOP

1. **Auto-routing pre-check**: read `AGC_AUTO_ROUTE` from the shell environment (e.g. `printenv AGC_AUTO_ROUTE`). Value exactly `0` → `auto_mode = off` for this session. Unset or any other value → `auto_mode = on` (default).
2. **Skip state sync for**: Q&A, doc edits, status checks. Go straight to step 4.
3. **Otherwise**: `tw_get_state` → `tw_detect_drift`.
4. **Feature-Scope Gate** (incoming PRD/ticket only; text-only): judge single vs multi-feature. **Multi** → STOP, write `.current/feature-split.md`, surface the recommendation + hint, wait for the human (do NOT route until they confirm + re-invoke per unit). **Single / not a PRD** → continue.
5. **Apply Complexity Scope Gate** against the request.
   - **No gate triggered** → execute directly → `tw_update_state` (if step 3 was run).
   - **Gate triggered** → `tw_switch_role(<role>)` using the routing table → follow the returned SOP exclusively. Increment hop counter.
6. **Multi-phase** → chain per constitution §4. Between hops, apply the *Auto-Routing* section above: if `auto_mode = on`, self-hop on each `next_role:`; if `auto_mode = off`, surface the recommendation and wait.

