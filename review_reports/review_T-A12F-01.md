# Review — T-A12F-01

## Summary
- One-line prose fix to `content/const-06-chain-31-head.md` L8: the `qa_round` circuit-breaker line's bare `3` is replaced with a `qa_round` Limits-table name-reference, mirroring const-08's shipped `review_round` phrasing (spec `a12-followup-qa-round-name.md`, AC1-AC3).
- Diff scope is exactly one content line plus state artifacts (`.current/handoff.md`, `tasks.md`); zero test/fixture/source changes, matching the ticket split (fixture regen + cap re-baseline deferred to qa-owned T-A12F-02).
- Expected-red manifest `qa_reports/expected-red_a12-followup-qa-round-name.txt` declares 9 intentional stale-baseline reds; all 9 verified as real, locatable tests.
- Build clean (`npm run build` → tsc zero errors, v3.64.0).
- Verdict: APPROVED.

## Correctness
No findings.

- The new L8 reads `- After the \`qa_round\` cap of QA FAILs (Round 4 of \`qa_round\`), only \`(pm, In_Progress)\` is accepted.` (`content/const-06-chain-31-head.md:8`), byte-identical to AC1's literal target text (spec L31-32) and to the Copy/Strings verbatim string (spec L60). Confirmed character-for-character.
- **AC2 [KEEP-DERIVED]**: the derived `Round 4` cap+1 lock index is preserved (now qualified as "Round 4 of `qa_round`"); only the bare restated limit value `3` was replaced with the name-reference. Correct.
- **AC3**: the file is 10 lines; L8 is the only line that restated a Limits-table value, and the diff touches only L8. No other line in const-06 changed. Confirmed.
- **Expected-Red Sampling (SOP 4a)**: step armed (the chain-tagged fragment grows, shifting golden fixtures / token caps although the diff itself touches no test files). Sampled all 9 manifest entries — well beyond the ≥3 minimum:
  - 6 in `test/compose-equivalence.test.mjs`: the four `skill-sr-engineer.md` entries resolve from the templated `test(...)` at L93 over the `CHAIN_SKILL` fixture rows L86-89 (`CHAIN_SKILL = "skill-sr-engineer.md"`, L78); the hook-full entry matches L141; the 15-fragment monolith entry matches L148.
  - 3 in `test/context-budget.test.mjs`: the design-arm rationale-stripped floor, the teamwork coordinator floor, and the non-design floor each grep to exactly one live test.
  - Manifest is internally coherent: const-06 is wrapped in `<!-- chain-only:start -->`, so lite bundles strip it and stay green — consistent with the four lite compose-equivalence rows (L82-85) being correctly absent from the red list.

## Quality
No blocking findings.

- **Judgment call — trailing "— symmetric to…" clause (const-08:5)**: const-08's `review_round` line ends with `— symmetric to the \`qa_round\` circuit breaker.`; the new const-06 line omits the analogous back-reference. This is **spec-sanctioned, not a defect**: AC1's literal "then it reads X" target (spec L31-32) and the authoritative Copy/Strings verbatim string (spec L60) both omit the clause, and the source note (spec L60) qualifies the mirror as "verbatim **in structure**", not full-text. The implementation matches the contract byte-for-byte. The descriptive phrase "mirroring const-08's phrasing exactly" (AC1) is subordinate to the unambiguous literal target it introduces. Recorded as an observation only: the two symmetric caps now read slightly asymmetrically (const-08 cross-references, const-06 does not) — but changing that is out of this ticket's single-line scope and would require a spec amendment. Non-blocking.
- Naming and structure otherwise match the surrounding fragment; no dead code, no convention drift.

## Architecture
No findings. No `specs/a12-followup-qa-round-name-architecture.md` exists (non-design, single-line, single-file ticket — correctly routed pm→sr-engineer, below the ≥3-module architect threshold per spec L92-94). The fix applies the established A12 Limits-table name-reference convention without introducing new structure. Out-of-scope boundaries respected: `tools/transitions.ts`, `ALLOWED_TRANSITIONS`, and the `qa_round` cap value (3) are untouched — text-framing only, behavior unchanged.

## Security
No findings. No input crosses a trust boundary; the change is documentation prose composed into role prompts. No secrets, no injection surface.

## Performance
No findings. Content-only markdown change; the line grows by a few characters. No hot-path, algorithmic, or I/O change. The only runtime effect is a marginally larger composed bundle for chain-tagged dispatch — the intended, spec-acknowledged cost that T-A12F-02 re-baselines against the no-headroom token caps (AC4). `npm run build` clean.

## Verdict
APPROVED — the diff matches AC1's literal target and the Copy/Strings verbatim string byte-for-byte, satisfies AC2/AC3, respects all out-of-scope boundaries, and the 9-entry expected-red manifest is coherent with every sampled entry a real locatable test. The omitted "— symmetric to…" clause is explicitly spec-sanctioned, not a finding.
