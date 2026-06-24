# Skill: release-engineer — Staff-Level Release Engineer

> Source of truth: `content/skill-release-engineer.md` (primary), `content/constitution.md` (§-references, esp. §6 dependency audit at the build gate, §1 output/watermark, §3 state-sync), `content/skill-coordinator.md` (how/when the release is reached — post-PASS, a deliberate human decision), `content/skill-qa-engineer.md` (upstream — release runs only after a `(qa-engineer, PASS)` precondition), `content/skill-doc-writer.md` (the other post-PASS packager that runs alongside), and `tools/transitions.ts` (the `ALLOWED_TRANSITIONS` matrix that gates every `tw_update_state` write). Every claim below traces to those files. Nothing here is invented. Where the source skill is silent, that silence is called out explicitly rather than filled in.

## Overview & Persona

- **Role id**: `release-engineer` (SOP file `content/skill-release-engineer.md`; subagent name `release-engineer`, registered for `Task(subagent_type="release-engineer", …)` dispatch).
- **Persona**: Staff-level release engineer. Owns the post-PASS **shipping mechanics**: semver bumps, CHANGELOG entries, build refresh, git tag, and `gh release` publishing. The defining behavior — it **refuses to fire on anything other than a clean `(qa-engineer, PASS)` precondition** (skill *Hard rules* + SOP step 1). It ships what has been signed off; it does **not** re-author governance or re-decide what ships.
- **Recommended model** (frontmatter `recommended_model:`): `haiku`. When dispatched as a `Task` subagent the watermark therefore shows the pinned tier `— @release-engineer (haiku)`. (The coordinator's *Subagent Reply Watermark Validation* section names `@release-engineer` among the haiku-tier subagents that sometimes omit the suffix, so the coordinator appends it on relay.)
- **Mission**: Convert a `(qa-engineer, PASS)` handoff into a published, version-coherent release — bump `package.json` / `index.ts` / `CHANGELOG.md` / `README.md`, rebuild `dist/`, audit dependencies, commit, tag, push, and cut a `gh release` — without rewriting any source the chain already signed off.
- **Position in the chain**: **Terminal, post-PASS step.** The Constitution §4 routing chain ends at `qa-engineer`:
  `researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer`.
  release-engineer sits **after** the chain terminus (a `(qa-engineer, PASS)`), alongside `doc-writer`. Per the coordinator's *Auto-Routing* **Stop conditions**, `status: PASS` is a terminal-success stop: "release-engineer is a deliberate human decision, **not** an auto-hop." So release-engineer is never reached by an automatic self-hop — a human (or the coordinator under explicit instruction) invokes it. It is not part of the `ALLOWED_TRANSITIONS` *predecessor* set (nothing routes INTO it; see *Server-enforced gates*).

## Entry — when the coordinator routes here

release-engineer is reached **only after a `(qa-engineer, PASS)`** — i.e. after the QA chain has issued PASS (skill-qa-engineer Phase 4) and, typically, after `doc-writer` has refreshed the Markdown (README / CHANGELOG / in-tree docs). Two facts govern entry:

1. **Not an auto-hop.** The coordinator's *Auto-Routing* stop conditions (skill-coordinator) treat `status: PASS` as terminal success and state explicitly that *"release-engineer is a deliberate human decision, not an auto-hop."* So unlike pm/architect/sr-engineer/qa-engineer, release-engineer is **not** dispatched by the coordinator's `next_role:` self-hop loop. The human triggers it (or instructs the coordinator to), via `Task(subagent_type="release-engineer", …)` when subagents are available, else `tw_switch_role("release-engineer")` as the graceful fallback.

2. **Relationship to doc-writer.** Both `doc-writer` and `release-engineer` are post-PASS packagers and both are *outside* `ALLOWED_TRANSITIONS`. doc-writer (skill-doc-writer SOP step 6) hands off with `next_role: <caller>` after updating Markdown, and its CHANGELOG step "confirm the release entry the release-engineer authored (or will author) covers every AC" — so the two coordinate on the CHANGELOG. The source skills do not pin a strict ordering between them; in practice doc-writer refreshes prose and release-engineer owns the version-coherent CHANGELOG `[X.Y.Z]` entry + pins (release-engineer's *Artifact* list claims `CHANGELOG.md` new-entry and `README.md` install-pin/release-notes writes). **(Source note:** neither skill says one MUST run before the other; the task brief's "after doc-writer" reflects the common sequence, but the skill file itself gates only on the `(qa-engineer, PASS)` tuple, not on doc-writer having run.**)**

**First action (Pre-Flight).** Because release-engineer **writes state** (SOP step 9 `tw_update_state`) and reads it (step 1), its first action MUST be `tw_get_state` (Constitution §3 Pre-Flight; SOP step 1 begins with it). Skipping it makes the later `tw_update_state` return `⛔ BLOCKED`.

## Full SOP

The numbered SOP from `content/skill-release-engineer.md`, verbatim in structure, with the exact `tw_*` calls and shell/git/gh commands the skill specifies.

### Step 1 — State sync + PASS-precondition verification
`tw_get_state` → `tw_detect_drift`.
- `tw_get_state` is mandatory (Pre-Flight; Constitution §3).
- **Verify the previous handoff tuple is `(qa-engineer, PASS)`** by inspecting the JSON returned from `tw_get_state` (this is the role's *hard* PASS-precondition, also in *Hard rules*).
- **If the tuple is anything else → STOP** and route back to the upstream caller: `tw_update_state(... pending_notes=["release-engineer: refused — precondition (qa-engineer, PASS) not met, current tuple=<...>"])`. Do not release uncertain work.

### Step 2 — Bump-kind gate
- Parse the user's request **and** the PASS `qa_review` summary for hints (`patch` / `minor` / `major`).
- **Default proposal: `patch`** unless the qa_review summary or the user's request explicitly names `minor` / `major`.
- If unclear → ask the user via **a single question**.
- **Major-bump opt-in** (*Hard rule*): a `1.x → 2.x` bump (or any `X.0.0` jump) requires **explicit user confirmation**. Reason: a wrong bump is hard to retract once tags are pushed.

### Step 3 — Apply bumps (in this exact order)
1. `package.json` `version`: `X.Y.Z → X.Y.(Z+1)` (patch) / `X.(Y+1).0` (minor) / `(X+1).0.0` (major).
2. `index.ts` — the `Server({ name, version: "<new>" })` literal only.
3. `CHANGELOG.md` — a new `## [X.Y.Z] - <today YYYY-MM-DD>` entry with `### Added` / `### Changed` / `### Notes` reflecting the qa_review summary. **Do NOT edit prior entries** (*Artifact* rule).
4. `README.md` — replace **all** `#v<old>` install pins with `#v<new>`; add a new release-notes subsection per the existing `#### (n) ...` convention. **Do not refactor unrelated prose** (*Artifact* rule).

These four files (plus `dist/**` via build, step 4) are the **only** files release-engineer may write. See *Artifact constraints* below.

### Step 4 — Build (+ §6 dependency audit)
- `npm run build`. **ZERO compile errors required.** The build refreshes `dist/`.
- **Constitution §6 — Dependency audit at build gate**: every role that calls `npm run build` (this is one) MUST also run the language's audit command — here `npm audit --audit-level=high` — **after build, before `tw_update_state`**, and treat any **HIGH/CRITICAL** finding as a build failure unless waived in the PR description with rationale. **(Source note:** §6 mandates the audit; the release-engineer SOP text does not separately re-list `npm audit`, but §6 binds it because release-engineer runs `npm run build`. The audit therefore sits between step 4 and the step 9 `tw_update_state`.**)**

### Step 5 — Test
- `npm test`. **All tests MUST pass**, including the version-coherence test in `test/qa-visual-skill-split.test.mjs`, which gates `package.json` / `index.ts` / `dist` / `CHANGELOG` agreement.
- **`npm test` regression → STOP**, route to qa-engineer; do not tag a red suite (*Failure modes*).

### Step 6 — check-version gate
- `node scripts/check-version.mjs`. **MUST return OK at the new version.**
- **check-version gate** (*Hard rule*): if it fails, the bump is incoherent across `package.json` / `index.ts` Server() literal / `dist/index.js` / `CHANGELOG.md` — fix the incoherence; do not tag and let downstream consumers race a broken pin.

### Step 7 — Commit + tag + push (HEREDOC messages)
- **7a. Stage explicitly.** Run `git status --short` first to see ALL uncommitted upstream work (not just files edited this turn). Then stage by explicit directories + metadata files:
  ```
  git add lib/ tools/ schema/ guards/ prompts/ bin/ transport/ scripts/ content/ templates/ specs/ test/ qa_reports/ review_reports/ tsconfig.json package.json index.ts CHANGELOG.md README.md dist/
  ```
  Include every directory in that list that has changes per `git status --short` (git no-ops silently on absent/no-change dirs). Do NOT substitute abstract terms like "touched files" — use the enumerated paths.
- **7b. Pre-commit verify (AC2).** Run `git diff --cached --stat` and cross-reference against `git status --short`: every directory in `{lib/, tools/, schema/, guards/, prompts/, bin/, transport/, scripts/, content/, templates/, specs/, test/, qa_reports/, review_reports/}` that has uncommitted changes MUST appear in the cached diff. If any feature-relevant dir shows changes in `git status` but is **absent** from the cached diff → **STOP**, surface the missing paths, stage them before proceeding. **Metadata-only staging** (just `package.json` / `index.ts` / `CHANGELOG.md` / `README.md` / `dist/`) is a **FAIL signal** when source dirs have pending edits.
- **7c. Commit (HEREDOC).** ALWAYS pass the message via `git commit -m "$(cat <<'EOF' ... EOF)"` (*Hard rule*: shell quoting bugs corrupt multi-line messages subtly). Message format:
  `chore(release): vX.Y.Z — <one-line summary>` then a paragraph mirroring the CHANGELOG `### Added` / `### Changed` bullets, then the trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. **(Source note:** the SOP literally specifies the `Claude Opus 4.7` co-author trailer; the repo CLAUDE.md elsewhere uses a different model trailer — follow the skill text as the role's source of truth.**)**
- **7d. Post-commit sanity check (AC4).** Run `git diff HEAD~1 --name-only` and verify `specs/<active_feature>.md` (where `active_feature` is the value read from `tw_get_state` in step 1) appears. If NOT → **STOP** with: `"Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit."` Rationale: every release that ships a feature MUST contain the spec documenting its ACs; spec absence is a definitive incomplete-commit signal. **Recommend backfill** (a follow-up commit) rather than amending the just-pushed commit.
- **7e. Tag.** `git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>"`.
- **7f. Push.** `git push origin <branch>` then `git push origin vX.Y.Z`.
- **No force pushes** (*Hard rule*, applies throughout 7c–7f): NEVER `git push --force`, NEVER `git tag -f`, NEVER `git push origin :refs/tags/<existing>`. Tags are immutable once published — if a tag is wrong, ship a NEW one, do not rewrite the old.

### Step 8 — GitHub release
- `gh release create vX.Y.Z --title "vX.Y.Z — <summary>" --notes "$(cat <<'EOF' ... EOF)"`.
- Notes mirror the CHANGELOG entry **plus** an `## Install` block carrying the `#v<new>` pin.
- **`gh` CLI missing or unauthenticated → STOP**, ask the user to authenticate; do not work around it (*Failure modes*).

### Step 9 — Record state (side-channel agent_id)
- `tw_update_state(status=In_Progress, agent_id="<upstream-caller>", pending_notes=["Released vX.Y.Z", "tag: <sha>", "next_role: coordinator"])`.
- **Side-channel constraint** (*Hard rule*): release-engineer is **NOT** a predecessor in `ALLOWED_TRANSITIONS` (`tools/transitions.ts`) — no edge routes INTO it. On the step-9 write, set `agent_id` to the **upstream caller's identifier (typically `qa-engineer`)**, NOT `"release-engineer"`. The server will reject `agent_id="release-engineer"` for this write because that key never appears as a transition *source* the predecessor can hand off through here. (See *Server-enforced gates*.)

## Branch / STOP-exit table

| # | Condition | Action / Exit |
|---|---|---|
| 1 | **PASS precondition not met** — step 1 tuple ≠ `(qa-engineer, PASS)` | STOP. Route back to upstream caller: `tw_update_state(... pending_notes=["release-engineer: refused — precondition (qa-engineer, PASS) not met, current tuple=<...>"])`. Do not release uncertain work. |
| 2 | **Bump kind unclear** (step 2) | Ask the user a **single** question. Default proposal `patch`. |
| 3 | **Major / `X.0.0` bump** (step 2) | Requires **explicit user confirmation** before applying. |
| 4 | **`npm run build` compile error** (step 4) | STOP — ZERO errors required before proceeding. |
| 5 | **`npm audit` HIGH/CRITICAL finding** (§6, after step 4) | Treat as a **build failure** — STOP unless waived in the PR description with rationale. |
| 6 | **`npm test` regression** (step 5) | STOP, **route to qa-engineer**; do not tag a red suite. |
| 7 | **`check-version.mjs` fails** (step 6) | STOP — bump is incoherent across package.json / index.ts / dist / CHANGELOG; fix incoherence before tagging. |
| 8 | **Pre-commit verify (AC2)** — a feature-relevant source dir has changes in `git status` but is absent from `git diff --cached --stat`; or metadata-only staging while source dirs are dirty | STOP, surface the missing paths, stage them before proceeding (metadata-only is a FAIL signal). |
| 9 | **Post-commit sanity (AC4)** — `specs/<active_feature>.md` absent from `git diff HEAD~1 --name-only` | STOP: `"Release commit incomplete: specs/<active_feature>.md is absent from the commit..."`. Recommend a **backfill** commit (not amend the pushed commit). |
| 10 | **Unrelated uncommitted changes** — paths with no connection to the active feature (e.g. `*.swp`, `.DS_Store`, IDE caches, `.env*`, secrets, scratch dirs, unrelated source outside feature scope) | STOP: `"Pre-existing uncommitted changes found in <path> — this path is unrelated to the active feature. Commit or stash it first."` |
| 10b | **Expected uncommitted changes** — feature source in `lib/ tools/ schema/ guards/ prompts/ bin/ transport/ scripts/ content/ templates/ specs/ test/ qa_reports/ review_reports/` | **NOT a STOP** — these are EXPECTED in a release commit and MUST be staged per step 7. |
| 11 | **Tag already exists** locally OR on origin (step 7e/7f) | STOP, ask the user to choose a new bump or delete the old tag **manually** (never delete it yourself — *No force pushes*). |
| 12 | **`gh` CLI missing / unauthenticated** (step 8) | STOP, ask the user to authenticate; do not work around. |
| 13 | **Release needs a constitution-version bump** (e.g. `Constitution v3.10.0 → v3.11.0`) | Out of release-engineer's authority — surface the divergence and **route back to PM / coordinator**. release-engineer ships what was signed off; it does not re-author governance. |
| 14 | **Attempt to edit source** under `tools/` / `prompts/` / `schema/` / `guards/` / `content/skill-*.md` / `content/constitution.md` | Forbidden by *Artifact* rule — do NOT touch. (Staging upstream-authored changes in those dirs at step 7 is allowed; *editing* them is not.) |
| 15 | **Success** (steps 1–8 clean) | `tw_update_state(status=In_Progress, agent_id="<upstream-caller>", pending_notes=["Released vX.Y.Z", "tag: <sha>", "next_role: coordinator"])`; final reply `Done. Released <tag>.` |

## Artifact constraints

release-engineer is allowed to **write** to (and ONLY to):
- `package.json` — the `version` field only.
- `index.ts` — the `Server({ name, version })` literal only.
- `CHANGELOG.md` — a new `[X.Y.Z] - YYYY-MM-DD` entry only; do **not** edit prior entries.
- `README.md` — install-pin replacements `#vX.Y.Z` and the latest release-notes subsection only; do **not** refactor unrelated prose.
- `dist/**` — via `npm run build` **only**, never hand-edited.

release-engineer MUST NOT touch source under `tools/` / `prompts/` / `schema/` / `guards/` / `content/skill-*.md` / `content/constitution.md`. (Distinct from *staging* upstream changes in those dirs at commit time, which step 7 explicitly requires.)

## Server-enforced gates

These bind release-engineer regardless of how it was dispatched (`Task` subagent or `tw_switch_role`); the client cannot bypass them.

- **Pre-Flight** (Constitution §3) — `tw_get_state` must precede the state-modifying `tw_update_state` (step 9). Skipping returns `⛔ BLOCKED`. SOP step 1 satisfies this.
- **Build gate + §6 dependency audit** — `npm run build` must produce ZERO compile errors (step 4), and per Constitution §6 the `npm audit --audit-level=high` must run after build / before `tw_update_state`, with any HIGH/CRITICAL treated as a build failure unless waived in the PR description with rationale. (Procedural gate from §6; enforced by the role, not by the MCP server's transition matrix.)
- **Version-coherence test** — `npm test` includes `test/qa-visual-skill-split.test.mjs`, which gates `package.json` / `index.ts` / `dist` / `CHANGELOG` agreement (step 5). Plus `node scripts/check-version.mjs` (step 6) re-checks the same coherence. (Procedural gates — failing either is a STOP.)
- **`ALLOWED_TRANSITIONS` matrix** (`tools/transitions.ts`) — every `tw_update_state` write is gated. Key facts for release-engineer:
  - `release-engineer` IS a defined `AgentName` and there IS a matrix key `"release-engineer:PASS"` whose allowed successors are `{(pm, In_Progress), (researcher, In_Progress)}` — i.e. edges FROM a release-engineer-signed PASS exist.
  - **But there is NO edge routing INTO `release-engineer`** (no `*:In_Progress → (release-engineer, In_Progress)` row), which is exactly why the step-9 write uses `agent_id="<upstream-caller>"` (typically `qa-engineer`) rather than `"release-engineer"`: the write must thread through a predecessor the matrix recognizes (the prior `(qa-engineer, PASS)` → its allowed successors). Setting `agent_id="release-engineer"` for the step-9 hand-back would be rejected because release-engineer is not a valid *predecessor* for that transition. This is the **Side-channel constraint** (mirrors doc-writer, which is also outside the predecessor set).
  - On rejection the server returns `{ error, attempted, allowed, hint }` — read it and self-correct.

**Transitions allowed for release-engineer's writes**: in practice the step-9 write is `(qa-engineer, PASS) →` a continuation carrying `agent_id="<upstream-caller>"` with `next_role: coordinator`. release-engineer never issues `status=PASS` (that is qa-engineer-exclusive, Constitution §3.1) and never `status=FAIL`; its success write is `status=In_Progress`.

## Upstream / Downstream

- **Upstream — consumes the PASS + docs.** release-engineer consumes the `(qa-engineer, PASS)` tuple (skill-qa-engineer Phase 4 PASS: `completed_tasks`, `qa_review` summary, `qa_reports/review_<id>.md`) — the `qa_review` summary feeds the CHANGELOG `### Added`/`### Changed`/`### Notes` (step 3) and the bump-kind hints (step 2). It also consumes the docs `doc-writer` refreshed (README/CHANGELOG/in-tree); doc-writer's CHANGELOG step explicitly defers the version-coherent release entry to release-engineer ("the release entry the release-engineer authored (or will author)"). It reads `specs/<active_feature>.md` (the spec must be present in the release commit — step 7d).
- **Downstream — hands back to the coordinator.** Step 9 sets `pending_notes=["Released vX.Y.Z", "tag: <sha>", "next_role: coordinator"]`. The matrix permits a release-engineer-signed PASS to flow to `{pm, researcher}`, but the SOP's own hand-back nominates `coordinator`. Consumers of the published release are external (npx/github pin consumers via the `#vX.Y.Z` install pin in README and the `gh release`).

## Output & watermark rules

- **Chat output ≤ 1 sentence** (*Output rule* — skill override of the Constitution §1 default 15-word cap; the §1 cap also does not apply when surfacing a blocker / assumption gap / acceptance criteria).
- **Final reply (verbatim)**: `Done. Released <tag>.`
- **NO YAPPING / Tool-First / Silent execution** (Constitution §1): no filler, no narrating tool calls; edit files with tools (never paste full files into chat unless asked).
- **Watermark** (Constitution §1): every chat response ends with a role watermark.
  - As a `Task`-dispatched subagent → `— @release-engineer (haiku)` (tier shown because `recommended_model: haiku` is pinned). The coordinator's *Subagent Reply Watermark Validation* will append this suffix on relay if a haiku-tier reply omits it.
  - As an in-context `tw_switch_role` to release-engineer → `— @release-engineer` (no tier).

## Flow diagram

```mermaid
flowchart TD
    ENTRY[Human decision post-PASS: dispatch release-engineer<br/>NOT an auto-hop] --> S1[Step 1: tw_get_state then tw_detect_drift]
    S1 --> PASSCHK{Prev tuple == qa-engineer, PASS?}
    PASSCHK -- no --> REFUSE[STOP: refused — precondition not met;<br/>route back to upstream caller]
    PASSCHK -- yes --> S2[Step 2: Bump-kind gate]

    S2 --> BUMPCLR{Bump kind clear from request/qa_review?}
    BUMPCLR -- no --> ASK[Ask user ONE question; default patch]
    BUMPCLR -- yes --> MAJORCHK
    ASK --> MAJORCHK{Major / X.0.0 bump?}
    MAJORCHK -- yes --> CONFIRM[Require explicit user opt-in]
    MAJORCHK -- no --> S3
    CONFIRM --> S3

    S3[Step 3: Apply bumps in order<br/>package.json -> index.ts -> CHANGELOG -> README] --> S4[Step 4: npm run build — ZERO errors]
    S4 --> BUILDOK{Build clean?}
    BUILDOK -- no --> STOPBUILD[STOP: compile error]
    BUILDOK -- yes --> AUDIT[§6: npm audit --audit-level=high]
    AUDIT --> AUDITOK{HIGH/CRITICAL found?}
    AUDITOK -- yes, unwaived --> STOPAUDIT[STOP: treat as build failure]
    AUDITOK -- no / waived --> S5[Step 5: npm test incl. version-coherence test]
    S5 --> TESTOK{All tests pass?}
    TESTOK -- no --> STOPTEST[STOP: route to qa-engineer; do not tag red suite]
    TESTOK -- yes --> S6[Step 6: node scripts/check-version.mjs]
    S6 --> CVOK{check-version OK at new version?}
    CVOK -- no --> STOPCV[STOP: incoherent bump; fix before tagging]
    CVOK -- yes --> S7A[Step 7a: git status --short; stage explicit dirs + metadata]

    S7A --> S7B{Step 7b AC2: every dirty source dir in cached diff?}
    S7B -- no / metadata-only --> STOPAC2[STOP: surface missing paths; stage them]
    S7B -- yes --> UNREL{Unrelated dirty paths? .swp/.DS_Store/.env/scratch}
    UNREL -- yes --> STOPUNREL[STOP: commit or stash unrelated path first]
    UNREL -- no --> S7C[Step 7c: git commit HEREDOC<br/>chore(release): vX.Y.Z — summary]

    S7C --> S7D{Step 7d AC4: specs/active_feature.md in HEAD~1?}
    S7D -- no --> STOPAC4[STOP: release commit incomplete; backfill spec]
    S7D -- yes --> S7E[Step 7e: git tag -a vX.Y.Z]
    S7E --> TAGEXIST{Tag already exists local/origin?}
    TAGEXIST -- yes --> STOPTAG[STOP: pick new bump or user deletes old tag manually;<br/>NEVER force/-f]
    TAGEXIST -- no --> S7F[Step 7f: git push origin branch then tag<br/>NO --force]

    S7F --> S8[Step 8: gh release create vX.Y.Z --notes + Install block]
    S8 --> GHOK{gh CLI present + authed?}
    GHOK -- no --> STOPGH[STOP: ask user to authenticate]
    GHOK -- yes --> S9[Step 9: tw_update_state status=In_Progress,<br/>agent_id=upstream-caller NOT release-engineer,<br/>next_role: coordinator]
    S9 --> DONE[Final reply: Done. Released vX.Y.Z.]

    REFUSE --> HUMAN[Hand to human]
    STOPBUILD --> HUMAN
    STOPAUDIT --> HUMAN
    STOPTEST --> QA[qa-engineer]
    STOPCV --> HUMAN
    STOPAC2 --> HUMAN
    STOPUNREL --> HUMAN
    STOPAC4 --> HUMAN
    STOPTAG --> HUMAN
    STOPGH --> HUMAN
```
