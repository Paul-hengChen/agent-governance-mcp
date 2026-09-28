# e231-info-hygiene-rule

## Problem Statement

Nothing in the constitution tells a role what it may not write. `const-03-core-surgical.md`'s
only comment rule is "don't touch adjacent comments" — there is no rule against a role putting
security-sensitive detail (an internal URL, a client codename, a credential, an absolute local
path) into a comment, a spec, a report, `pending_notes`, a commit message, a PR body, or the
CHANGELOG, and no rule requiring a citation to make sense outside this repo's own tooling. A
2026-09-28 scan of this repo's own tracked tree found instances of every one of those classes
except credentials (cleanup tracked separately as E232), plus roughly 1,690 comment lines across
source and test files whose only explanation is a bare backlog ticket id (E233).

Filed at human direction while deciding whether this repo can go public after E104 (the
Figma-file-key / third-party-screenshot incident whose residual-risk cleanup is now done).
The ask is a **constitution rule**, not a memory note or a skill-file aside, because only a
constitution rule reaches every role on every dispatch arm, including lite mode (no coordinator,
no skill file loaded beyond `skill-coordinator-lite.md`) — and lite agents write commits too.

## Relationship to E107 (read before implementing)

E107 (P1, filed 2026-09-14, **not yet shipped**) already settles the readability half of this
problem, from `docs/agc-feedback-2026-09-08.md` H6/H7/H9. Its settled wording (human decision
2026-09-14): *anything written for a human assumes a reader who does not use this repo's own
tooling* — no governance jargon, no citation that only resolves inside this tooling's own
ledger, no citation of an untracked path. Machine-validated fields (handoff YAML keys, filename
conventions, status enums) are explicitly **out of scope** — H9's discriminator is prose vs.
protocol, not file-by-file. E107 also recorded one **repo-local exemption**: this repo's own bare
ticket-id comments (e.g. in `tools/handoff-orchestrator.ts`, `gates/registry.ts`) were exempted
from the no-bare-id half, because every reader here already uses this tooling and
`docs/backlog.md` is tracked — an id is a working index, not noise. E107 was never built; nothing
in `content/const-*.md` carries any of this yet. **That repo-local exemption is revoked as of
2026-09-28** — see Decisions (D1) below; this repo is going public, so its readers will no longer
all run this tooling, and the exemption no longer holds.

**This ticket does not re-derive that wording — it builds on it, and widens it in two ways
the human's 2026-09-28 directive asks for that E107 did not cover:**

1. **A new security-sensitive-detail half.** E107 is purely about readability/dangling
   references. It says nothing about internal URLs, client codenames, design-tool file keys,
   credentials, or absolute local paths — that is new to this ticket, and is the harder,
   non-optional half (a leak is a leak regardless of who can read the ticket-id prose around it).
2. **A wider artifact list, for the security half only.** E107's own investment note left
   `qa_reports/` prose and `pending_notes` alone for the readability half ("nobody outside this
   tooling reads a round-2 verdict") — the human's 2026-09-28 ruling (D2, see Decisions below)
   keeps that original intent: Generic citation (the readability half) exempts qa/review
   reports, `pending_notes`, and handoff, the same as E107 originally scoped it. Information
   hygiene (the security half) is new and carries no such exemption — a leak in a qa report is
   still a leak. Because this ticket ships the rule at the **constitution** layer rather than the
   skill layer E107 proposed (`skill-pm.md` / `skill-design-auditor.md`), splitting the two
   halves' scope costs nothing extra in enforcement surface — a constitution bullet is binary
   (ships everywhere or nowhere), and the exemption is written directly into the Generic citation
   bullet's own text, not left as informal color.

**The fold is confirmed: E107 closes when this ticket ships.** Building the readability half a
second time, in a second location, is exactly the restatement `CLAUDE.md`'s "skills MUST NOT
restate" principle (and E107's own H9 note #14) exists to prevent. The human's 2026-09-28 ruling
settles this (see Decisions below); `docs/backlog.md`'s E107 row note is updated to record the
fold as settled rather than proposed. The split-out mechanical-check idea remains filed
separately as E231-NEW-1 (lane-local id; real backlog id assigned at `agc feature finish`)
(below).

## Decision

One core-tagged constitution bullet pair, plus a documentation pointer — no new skill-file
restatement, no new server-side gate.

1. **Two new bullets under `content/const-15-core-tail.md` §6 (Security & Privacy).**
   `const-15-core-tail.md` is tagged `core` in `prompts/constitution-manifest.ts` —
   `includeSegment("core", ...)` returns `true` unconditionally, so it ships in every
   composed arm: lite (no chain, no design), full chain, design-armed, non-design. That is the
   only fragment class that reaches lite mode, which the human directive explicitly requires
   ("since lite agents also write commits"). §6 is the right *section* because both new rules
   are the same shape as its existing bullets — a hard "don't do X" a role must self-police,
   parallel to the existing sanctioned-git-ops whitelist (precedent: `specs/e7-governed-git-surface.md`,
   same fragment, same section, same reasoning).

   Exact bullets to add (verbatim, appended after the existing `Tool-internal ops` bullet, before
   `## 7. Cognitive Discipline`):

   ```
   - **Information hygiene**: No durable output — code comments, specs, qa/review reports,
     `pending_notes`, handoff, commit messages, PR bodies, CHANGELOG — may contain
     security-sensitive detail: an employer-internal URL or work-item link, a third-party
     client/project codename, a design-tool file key, a credential, or an absolute local
     path/username. Describe by class, never the literal string. No artifact type is exempt.
     A value a tool's input schema requires verbatim (e.g. an absolute workspace path) is
     protocol, not prose.
   - **Generic citation**: The same output must read without this repo's own tooling context —
     no governance jargon (round/gate/`tw_*`/PASS-FAIL), no bare ticket id or AC reference
     standing alone as the explanation (pair it with plain language on the same line), and cite
     only tracked paths. Machine-validated fields (handoff YAML keys, filename conventions,
     status enums) and governance-internal artifacts (qa/review reports, `pending_notes`,
     handoff) are exempt from this bullet.
   ```

   Two bullets, not one, because they are different failure modes with different blast radii —
   a leak is never acceptable anywhere; a jargon-only citation is a legibility defect, not a
   leak — and separating them lets a future ticket (e.g. a mechanical scanner) target only the
   first without having to parse prose quality.

2. **One-line pointer in `CONTRIBUTING.md`**, extending the existing "Third-party assets are
   never committed" section (the section this ticket's origin story, E104, already lives in) to
   note that the constitution rule above generalizes this section's asset-specific guidance to
   *everything* an agent writes, not only binary design files. Pointer only — the section's
   existing content (why-a-rule-not-a-preference, the E104 war-story, the
   visibility-first-deletion-second lesson) is unchanged.

3. **No change to the `templates/agent-adapters/CLAUDE.md` adapter block.** The block already
   says, generically, "Follow all rules in the constitution" — that line already covers this
   rule the same way it covers every other constitution rule; a role reading the adapter has no
   way to see *which* constitution rules exist without reading the constitution itself, so
   naming this one specifically would be arbitrary favoritism over (for example) the sanctioned-
   git-ops whitelist or the anti-loop caps, none of which get adapter call-outs either. Decision:
   no adapter change.

4. **No mechanical check in this cut.** Filed as a separate ticket, E231-NEW-1 (lane-local id; real backlog id assigned at `agc feature finish`) (below), per the
   fine-grained-ticket default. A pattern-based scanner needs the rule's classes to be stable
   text first (this cut), and is a meaningfully separate unit of work (a new `agc check` scan
   surface, false-positive tuning, its own test file) — bundling it here would turn a ~2-file
   content ticket into a mixed content+code ticket for no shared risk.

5. **Byte-budget accounting.** `const-15-core-tail.md` is core-tagged, so both bullets grow the
   byte count shipped even in lite mode. `test/context-budget.test.mjs` pins hard-coded `~tok`
   ceilings on several composed sizes (the b9-token-budget-brake convention: lean always-on
   `<= 5157`, non-design constitution `<= 7569`, design-arm floor `<= 9666`, teamwork bundle
   `<= 20044`, and the raw `stripRationale(CONSTITUTION)` figures quoted in nearby comments).
   The two bullets above are ~990 characters (~250 `~tok` by the file's own `len/4` approximation)
   — every one of those ceilings must be recomputed and bumped in the same change. The bump's own
   comment must itself follow the rule this ticket adds: plain language explaining why the
   ceiling moved, with this ticket's id trailing only as a pointer — never a bare id standing
   alone, since the comment is new prose written after the rule ships. This is qa-owned
   (qa-engineer is the only role that touches `test/`).

## User Stories

- As any role writing anything durable — a comment, a spec, a report, a commit, a PR body — I
  want a single rule that tells me what never to write, so a leak doesn't depend on me
  independently reasoning about it from scratch, in lite mode or in the full chain.
- As an AI agent working in a *different* repo that does not use this tooling, encountering code
  a governed agent wrote, I want its comments to make sense on their own — an id may accompany
  an explanation, but must never replace one.
- As the human deciding this repo's visibility, I want new leaks of the classes E232 is cleaning
  up today to stop accumulating tomorrow.

## Acceptance Criteria

- **AC1** — Given `content/const-15-core-tail.md` §6, when read after this ticket ships, then it
  contains the **Information hygiene** bullet naming all five leak classes (internal URL/work-item
  link, client/project codename, design-tool file key, credential, absolute local path/username)
  over the full durable-output list including `pending_notes` and handoff, with no exemption for
  anything a role authors (a value a tool's input schema requires verbatim is protocol), and
  the **Generic citation** bullet naming the no-bare-id/AC-reference clause plus both exemptions:
  machine-validated fields, and governance-internal artifacts (qa/review reports, `pending_notes`,
  handoff).
  proof: grep-based pinning test asserting both bullets' key phrases are present verbatim in the
  fragment file.
- **AC2** — Given the two new bullets are in a `core`-tagged fragment, when the constitution is
  composed for any dispatch arm (lite, full chain, design-armed, non-design), then
  `includeSegment("core", ...)` returns `true` unconditionally, so both bullets ship in the
  assembled prompt in every case, including the lite arm.
  proof: `composeConstitution({chain:false, design:false})` (and the other three arms) each
  include both bullets' key phrases — all new assertions live in a new lane-owned
  `test/e231-*.test.mjs` file; existing test files other than `test/context-budget.test.mjs`
  are not edited.
- **AC3** — Given `CONTRIBUTING.md`'s "Third-party assets are never committed" section, when read
  after this ticket ships, then it carries one additional sentence pointing to the new
  constitution rule as the general case, with the section's existing content otherwise unchanged.
  proof: `git diff` on `CONTRIBUTING.md` shows only the one added sentence.
- **AC4** — Given the new bullets' added bytes to a core-tagged fragment, when
  `test/context-budget.test.mjs`'s cap constants for the affected composed sizes are evaluated,
  then they are recomputed and bumped, so the size increase is a reviewed bump, not a spurious
  red — and the comment recording the bump is itself plain language explaining why the ceiling
  moved, with this ticket's id trailing only as a pointer, not a bare id standing alone (the
  comment is new prose written after the rule ships, so it must follow the rule it introduces).
  proof: `npm test` passes post-bump; golden fixtures under `test/fixtures/compose-golden/`
  regenerated via `scripts/capture-constitution-golden.mjs` per `CONTRIBUTING.md`'s documented
  re-baseline steps; the ceiling-bump comment is read to confirm it explains the change in plain
  language before the trailing ticket id.
- **AC5** (non-regression) — Given `const-15-core-tail.md`'s existing §5/§6/§7 content, when this
  ticket ships, then it is unchanged verbatim except for the two new bullets appended to §6.
  proof: `git diff` on the fragment shows only the additive block.
- **AC6** (non-goal, explicit) — Given this ticket ships, when checked for a mechanical scan or
  server-side gate, then none exists — the rule is SOP text a role must voluntarily follow,
  consistent with `CLAUDE.md`'s "does NOT force agents to follow the constitution" boundary. The
  scan is E231-NEW-1 (lane-local id; real backlog id assigned at `agc feature finish`), a separate ticket.
  proof: `git diff --stat` for this ticket touches only `content/const-15-core-tail.md`,
  `CONTRIBUTING.md`, `content/constitution-rationale.md`, `docs/backlog.md`,
  `test/context-budget.test.mjs`, the regenerated `test/fixtures/compose-golden/*`, and one new
  qa-owned pinning test file — zero changes under `gates/`, `bin/agc-init.mjs`, or
  `tools/handoff-orchestrator.ts`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no new user-facing strings (internal governance-content fix only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Task Breakdown

- **T-E231-01** (sr-engineer) — Add the **Information hygiene** and **Generic citation** bullets
  to `content/const-15-core-tail.md` §6, verbatim per Decision §1. AC: AC1, AC5.
- **T-E231-02** (sr-engineer) — Add the one-line pointer to `CONTRIBUTING.md`'s "Third-party
  assets are never committed" section per Decision §2. Optionally add a short, non-normative
  entry to `content/constitution-rationale.md` recording the E104 origin and the E107 fold (this
  file is never composed into any prompt — confirmed zero `content/constitution-rationale`
  references in `prompts/*.ts` or `bin/*.mjs` — so it costs zero context budget). AC: AC3.
- **T-E231-03** (qa-engineer) — Regenerate `test/fixtures/compose-golden/*` via
  `scripts/capture-constitution-golden.mjs` and bump every affected `~tok` ceiling constant in
  `test/context-budget.test.mjs`. The bump's own comment must follow the rule this ticket adds:
  plain language explaining why the ceiling moved, with this ticket's id trailing only as a
  pointer — not a bare id standing alone. AC: AC4.
- **T-E231-04** (qa-engineer) — Add a grep/compose-based pinning test asserting both new bullets'
  key phrases survive composition on all four dispatch arms (lite/chain × design/non-design),
  per AC2. Lands in a new `test/e231-info-hygiene-rule.test.mjs` (also holds AC1's pinning).

Test surfaces (qa-owned only, per Constitution §2 test ownership): `test/context-budget.test.mjs`
(ceiling bumps only), `test/e231-info-hygiene-rule.test.mjs` (new; AC1 + AC2 assertions), `test/fixtures/compose-golden/*` (regenerated,
never hand-edited), `test/compose-equivalence.test.mjs` (must continue passing unmodified — it
already asserts core segments ship on every arm).

## Out of Scope

- **E232** — cleaning up this repo's existing leaked instances of the classes this rule bans.
  Explicitly sequenced after this ticket ("so the cleanup follows the rule's wording") — already
  filed, depends on E231.
- **E233** — rewriting existing bare-ticket-id comments to add plain-language explanations.
  Already filed, depends on E231.
- **E231-NEW-1 (lane-local id; real backlog id assigned at `agc feature finish`)** (new, filed as part of this cut) — an advisory mechanical scan (e.g. an `agc check`
  pattern-based check) for new instances of the banned classes. Split out per the fine-grained-
  ticket default; needs this ticket's finished wording as its target classes first.
- **Any skill-file restatement** of either bullet — per `CLAUDE.md`'s "skills inherit everything
  below — they MUST NOT restate these rules," and per the confirmed E107 fold above.

## Decisions (human, 2026-09-28)

Recorded in `specs/fanout-feedback-leftovers.md` → Decisions (D1/D2); these settle the three
questions this spec previously left open.

- **D1** — The 2026-09-14 this-repo ticket-id exemption (E107 H6 Rule B) is **revoked**: this
  repo is going public, so its readers will no longer all run this tooling, and the Generic
  citation bullet's no-bare-id clause now applies here with no carve-out (this is also why E233
  exists — rewriting this repo's own existing bare-id comments to add plain-language
  explanations). The bullet text itself needed no change to carry this out — it never
  special-cased this repo to begin with.
- **D2** — Information hygiene applies to every durable artifact with no exemption. Generic
  citation exempts governance-internal artifacts — qa/review reports, `pending_notes`, and
  handoff — from the readability half only; machine-validated fields stay exempt as before. This
  restores E107's original intent that qa/review-report prose carries no readability rule, while
  still binding those reports under Information hygiene's security half. The bullet text, Decision
  §1, and AC1 above are written to this split.
- **E107 fold** — confirmed: E107 closes as superseded once this ticket ships; `docs/backlog.md`'s
  E107 row note is updated accordingly.

## Dependencies / Prerequisites

None. Zero external references (no URLs/Figma/tickets) in the backlog entry or intake
instructions beyond the in-repo `docs/agc-feedback-2026-09-08.md` cross-read already done above
— Resource Audit Gate: no action needed.
