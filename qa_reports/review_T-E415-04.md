# QA review — T-E415-04

covers: T-E415-03, T-E415-04

## Expected-Red Diff

Observed order: build, clean tree, `node --test test/skill-manifest.test.mjs` -> 27 pass / 1 fail (`not ok 4 - t-golden-byte-identity`), BEFORE any re-baseline edit.

- `test/skill-manifest.test.mjs | t-golden-byte-identity` (listed twice, once per round; one entry): confirmed red pre-recapture; green after `node scripts/capture-constitution-golden.mjs`. Disposition: expected, resolved by T-E415-04 re-capture.

Phase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds).

## Golden diff vs main (2f88f14)

Only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` changed; two hunks, both coord-03 rewordings:
1. PASS escalation row (~line 145): release-engineer manual-decision wording -> "the release is a deliberate human decision via the project's release process (agc role: release-engineer), never an auto-hop".
2. Backlog Intake Loop Bounds (~line 179): "release-engineer remains a deliberate human decision" -> "the release remains a deliberate human decision"; the NEVER-auto-hops-to-release-engineer clause kept.
No repo-only Release workflow / docs/release-cd.md citation remains.

## Full suite (clean tree)

`node scripts/test-lock.mjs -- npm test`: tests 4053, pass 4051, fail 0, skipped 2.
Phase 3: no new test file (existing golden test covers); Phase 3.5: skipped (no proof:-annotated ACs); Phase 1.5: skipped (no Visual Baselines).
