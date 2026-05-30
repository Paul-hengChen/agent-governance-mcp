# Review — T310

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: single content file `content/skill-researcher.md`, two additions.
- Adds a `Standalone default` Depth bullet (no `researcher_depth:` → `deep`).
- Rewrites SOP step 2 to invoke `/deep-research` at deep depth with manual fallback, and to skip it at shallow depth.
- Headline verdict: faithful to spec `specs/researcher-deep-research-integration.md`; no code, no behaviour outside prompt text.

## Correctness
- AC-1 satisfied — standalone/no-declaration case explicitly defaults to `deep` (skill-researcher.md:13).
- AC-2 satisfied — deep depth directs `/deep-research` invocation then distil into Findings Schema (skill-researcher.md:38).
- AC-3 satisfied — explicit fallback "If `/deep-research` is unavailable, fall back to manual web search, file reads, code traversal" (skill-researcher.md:38).
- AC-4 satisfied — shallow path explicitly does NOT invoke `/deep-research`, preserving the cost-frugal branch (skill-researcher.md:38).
- The `(see SOP step 2)` cross-reference is accurate — step 2 is the research step. No off-by-one in step numbering.

## Quality
- Wording matches the file's existing Hard-rules / SOP voice; bold-lead convention (`**Standalone default**`) mirrors sibling bullets. No drift.
- Spec Copy/Strings `str-default-deep` is paraphrased (added "e.g. you were called directly…" clause) vs the spec's verbatim text. Source is `authored-here` governance wording, not a pinned external design string, so the elaboration is within authoring latitude — non-blocking. Noted for transparency.
- No dead text, no duplication.

## Architecture
- No `specs/<feature>-architecture.md` (none warranted — content-only change). Fits the prompt-layer design: SOP is guidance, not server-enforced. The `(if available in the session)` qualifier correctly reflects that skill availability is environmental, consistent with the spec's Out-of-Scope note that the server does not enforce skill invocation.

## Security
- Markdown content only; no secrets, no input boundaries, no injection surface. N/A.

## Performance
- No code paths altered; `buildPromptForRole` reads the same single file. No regression. N/A.

## Verdict
APPROVED — diff faithfully implements AC-1–AC-4 with no correctness, quality, or scope issues; sole observation (paraphrased spec string) is within authored-here latitude.
