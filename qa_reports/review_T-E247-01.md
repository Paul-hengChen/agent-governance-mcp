# QA review T-E247-01 (E396 repro) and T-E247-11 (AC-X repro)

covers: T-E247-01, T-E247-11

## E396 Reproduction

Run against the current build (`gates/expected-red.ts` and `gates/ac-execution.ts` unfixed, zero diff vs base `2425e04`), `dist/` as built.
Command: `node --test test/e396-covers-expected-red.test.mjs test/ac-execution.test.mjs`.

| case | file | result | note |
|---|---|---|---|
| U1 | test/e396-covers-expected-red.test.mjs | green | no per-id files; the `covers:` file satisfies the gate (control) |
| U2 | test/e396-covers-expected-red.test.mjs | RED | per-id `review_<id>.md` without the H2 exists for all seven ids; `hasExpectedRedDisposition` returns `present:false` although `review_E391.md` holds the H2 |
| I | test/e396-covers-expected-red.test.mjs | RED | PASS over seven ids with the manifest armed: `QA_REVIEW_RECORD` creates the per-id files, then `PASS_EXPECTED_RED_DIFF` rejects with `EXPECTED_RED_DIFF_MISSING` |
| AC-X | test/ac-execution.test.mjs | RED | same traversal gap in `hasAcExecutionLogDisposition`; existing 27 cases in that file stay green |

Verdict: E396 reproduces (U2 and I red, AC-X red). T-E247-02 (expected-red fix) and T-E247-12 (ac-execution fix) must be built by sr. Root cause: both predicates take the direct file as the only candidate whenever it exists, and consult the `covers:` index only when the direct file is missing.
