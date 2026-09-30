# Review — T-E233B-01

covers: T-E233B-01, T-E233B-02, T-E233B-03, T-E233B-04, T-E233B-05, T-E233B-06

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Rewrites comments that explained themselves only with a ticket id, across gates/, index.ts, bin/, scripts/, prompts/, schema/, guards/ and lib/ (31 .ts/.mjs files). Also rebuilds the matching dist/ share and replaces the dead governance-recommendations citation in two places (E241).
- Mechanical proofs re-run by the reviewer, not taken from the builder: AC1 transpile parity prints `31 files, 0 bad` (exit 0) at base 6c61864. AC2 grep prints nothing. AC3 stat prints 0. AC4: the build leaves no dist diff, dist/tools is untouched and no dist path falls outside the share. AC5: no match, and there are exactly two hunks. AC6: the full suite passes (2958 tests, 2955 pass, 0 fail, 3 skipped) under test-lock.
- I sampled more than 10 rewritten comments per task and checked the ones that add meaning against the code. Almost all are accurate and read without the backlog.
- One accuracy defect: the E137 rewrites promise more security than the render boundary claims for itself.
- Verdict: CHANGES_REQUESTED (one required finding, a one-line wording fix in two places).

## AC Completeness
AC1 — implemented — reviewer re-run with BASE=6c61864: `31 files, 0 bad`, exit 0. Every touched file in the scanned dirs is .ts/.mjs.
AC2 — partial — the grep is clean, and the sampled comments read without the backlog. But the rewritten E137 comment at bin/agent-governance-context.mjs:488-489 states a guarantee the code does not provide (see Correctness C1). The subjective half of AC2 needs a comment that is correct, not just readable.
AC3 — implemented — `git diff --stat main...HEAD -- test tools dist/tools templates content docs package.json CLAUDE.md AGENTS.md 'specs/fanout-*.md' | wc -l` prints 0. String literals are unchanged (implied by AC1).
AC4 — implemented — `npm run build` leaves `git status --short dist` empty. `git diff --stat main...HEAD -- dist/tools | wc -l` prints 0. No dist path falls outside gates/prompts/schema/guards/lib/transport/index.
AC5 — implemented — `grep -n governance-recommendations CHANGELOG.md research/visual-fidelity.md` finds nothing. There are exactly two hunks: CHANGELOG.md:2859-2860 (the 3.27.1 entry) and research/visual-fidelity.md:6. Other citations of files that have since been merged (the `why-pixel-perfect-missed.md` citations around lines 3778/3916, and the other header source names) are left alone, as the narrowed AC requires.
AC6 — implemented — `node scripts/test-lock.mjs -- npm test` exits 0: 2958 tests / 2955 pass / 0 fail / 3 skipped.

## Correctness
- **C1 (required)** — The E137 rewrites promise more security than the code delivers:
  - bin/agent-governance-context.mjs:488-489 now reads "The hook no longer inlines the raw handoff.md file, so untrusted state text cannot inject instructions". The render boundary's own threat model (lib/render-boundary.ts:9-19) says it guarantees only a fence the body cannot structurally escape, plus a data label. It also says: "It does NOT stop a reader from being persuaded by what the data says. That residue is deliberately out of scope." So "cannot inject instructions" is a flat security guarantee that the governing module explicitly disclaims. The old comment made no such claim.
  - lib/render-boundary.ts:2 ("fences untrusted data so it cannot pose as instructions") has the same problem to a lesser degree. The next dozen lines qualify it, but the summary line still overstates.
  - Fix: reword both to describe the actual guarantee. For example: "...so reported state renders inside a labelled fence it cannot structurally escape (E137...)" and "Render boundary: fences reported data in a labelled block it cannot structurally break out of (E137, Option B)".
- Builder judgement call (3), other added meanings checked against the code. All accurate:
  - scripts/merge-invariants.mjs:416-417 ("dropped no task rows, done-marks or sidecar lines") matches AC1-AC3 in the tools/merge-invariants.ts header.
  - scripts/join-precondition.mjs:382-383 matches checkLaneAncestry in the tools/join-precondition.ts header.
  - scripts/verify-release.mjs "predates Check 6" matches the E14 backlog row: E14 introduced the CI ground-truth check. "the sha-match contract, E78" matches the E78 row.
  - bin/agc-init.mjs:167-168 ("flags absolute paths and similar leaks") is consistent with the tools/hygiene-scan.ts header (the Information-hygiene classes).
  - schema/migrations-tasks.ts and gates/feature-lease.ts: the rewording keeps the original meaning.
- No expected-red manifest applies: the diff touches no test files and the suite is green (step 4a not armed).

## Quality
- **Q1 (recommended)** — bin/agent-governance-usage-hook.mjs:146-147: "via the compiled lane-layout (E123 F1 L3)\n  // seam". The parenthetical splits the noun phrase "lane-layout seam". Move the pointer to the end of the sentence.
- **Q2 (optional)** — gates/code-review.ts:106 and gates/qa-review.ts:397: "(covering evidence, C3)" still reads like a slug gloss. "(one covering report may satisfy several ids, C3)" would say more. The very next line explains it, so this is not blocking.
- Builder judgement call (1), going beyond the AC2 regex (lowercase slugs, ids used as nouns): acceptable and in the spirit of the problem statement. I found no over-rewrite that changed meaning.
- Builder judgement call (2), leaving some ids in place: acceptable. The backlog row ids in scripts/check-md-tables.mjs (E39/E40/E58/E59/E145/E57, lines 77 and 134-165) name specific measured rows of docs/backlog.md; they are data, not explanatory labels. The `e180.*` references in bin/agc-init.mjs:1967/2009/2930/2958 are Copy/Strings string ids pointing at spec rows.
- A residual scan for id-led comments turned up only continuation lines (bin/agc-init.mjs:2527, scripts/check-md-tables.mjs:14), not comments that are bare ids.
- Reflow stays within the comment blocks. AC1 shows that no code was reflowed.

## Architecture
No architecture spec exists for this feature. The change is comments and prose only; layering is unchanged. AC1 transpile parity confirms there is no structural change.

## Security
- No new input crosses a trust boundary, and no secrets were introduced. The security-relevant item is the documentation overclaim in C1: a maintainer who trusts "cannot inject instructions" might skip reasoning about the persuasion residue that the render boundary deliberately leaves open.
- Builder judgement call (4), the E241 wording and Information hygiene: the replacement drops the product-codename prefix from the old file name and adds no path, URL or codename. It keeps the entry's meaning (source = cross-AI governance recommendations, Codex/GPT-5, not retained). That is compliant, and dropping the prefix is correct under the hygiene rule. Line 5 of research/visual-fidelity.md still carries a codename-prefixed file name for a different, merged source file, which AC5 explicitly puts out of scope. Noted for the backlog, not a finding against this lane.
- New comments contain no absolute paths or internal URLs.

## Performance
No findings. Comment-only change; AC1 proves the emitted JS is byte-identical.

## Verdict
CHANGES_REQUESTED — every mechanical AC passes on reviewer re-run, but the rewritten E137 comments (bin/agent-governance-context.mjs:488-489, lib/render-boundary.ts:2) claim a security guarantee that the render boundary's own threat model disclaims. This needs a one-line rewording in each place, followed by a dist rebuild.

### sr-engineer reply — Round 1

- **C1 (fixed)**: bin/agent-governance-context.mjs:167-169 now reads "The hook no longer inlines the raw handoff.md file: reported state renders inside a labelled fence it cannot structurally escape (E137, Option B + J2-NEW-1)". lib/render-boundary.ts:2-3 now reads "Render boundary: fences reported data in a labelled block it cannot structurally break out of (E137, Option B)". Neither makes a claim beyond the threat model at lib/render-boundary.ts:9-19. The line numbers in the finding (488) did not match the file (288 lines); the text matched at line 167-168.
- **Q1 (taken)**: bin/agent-governance-usage-hook.mjs:146-149 now reads "via the compiled lane-layout seam (dist/tools/lane-paths.js, E123 F1 L3)".
- **Q2 (taken, different wording)**: gates/code-review.ts:6 and gates/qa-review.ts:7 now read "fallback (C3) lets one covering report satisfy additional ids". I dropped the gloss, because the rest of the sentence already says what it means, and kept the id as a trailing pointer.
- dist share rebuilt (dist/lib/render-boundary.*, dist/gates/{code-review,qa-review}.*); a second `npm run build` leaves `git status --short dist` empty.
- Re-run: AC1 at BASE=6c61864 prints `31 files, 0 bad` (exit 0). AC2 grep prints nothing. AC3 stat prints 0. No test pins any of the reworded strings (grep over test/ is empty). I did not re-run the full suite: AC1 proves the emitted JS is byte-identical to base, so the round-1 AC6 result (0 fail) still holds.
- Commit: fix(e233b) E233 T-E233B-01 (source + dist).

## Round 2 — APPROVED — by code-reviewer

covers: T-E233B-01, T-E233B-02, T-E233B-03, T-E233B-04, T-E233B-05, T-E233B-06

## Summary
- Re-review of fix commit fa289a0, plus bd37dbf (review report and state only). HEAD is bd37dbf.
- The fix touched 12 files: bin/agent-governance-context.mjs, bin/agent-governance-usage-hook.mjs, lib/render-boundary.ts, gates/code-review.ts and gates/qa-review.ts, plus their dist counterparts (dist/lib/render-boundary.*, dist/gates/{code-review,qa-review}.*).
- Correction to Round 1: I cited C1 at bin/agent-governance-context.mjs:488-489, which was wrong. The file has 289 lines, and the overclaiming text was at 167-168. The sr-engineer fixed the correct text, now at lines 167-169.
- Verdict: APPROVED. C1 is resolved at both sites, Q1 and Q2 are taken, and every mechanical AC passes on the reviewer's re-run.

## AC Completeness
AC1 — implemented — reviewer re-run with BASE=6c61864 at HEAD bd37dbf prints `31 files, 0 bad`, exit 0.
AC2 — implemented — the grep prints nothing (exit 1). The subjective half is now met: the C1 wording is accurate. See Correctness.
AC3 — implemented — the stat pipeline prints `0`.
AC4 — implemented — `npm run build` exits 0. Afterwards, `git status --short dist` is empty and `git diff --stat 6c61864...HEAD -- dist/tools | wc -l` prints `0`. The dist lines in fa289a0 match the source rewording.
AC5 — implemented — `grep -n governance-recommendations CHANGELOG.md research/visual-fidelity.md` prints nothing. This round did not touch either file.
AC6 — implemented (carried from Round 1) — the full suite was not re-run. The fix changes comments only, and AC1 proves the emitted JS is byte-identical to base, so the Round 1 run (2958 tests, 0 fail, under test-lock) still holds. No test pins the reworded strings.

## Correctness
- C1 is resolved.
  - bin/agent-governance-context.mjs:167-169 now reads "reported state renders inside a labelled fence it cannot structurally escape".
  - lib/render-boundary.ts:2-3 now reads "fences reported data in a labelled block it cannot structurally break out of".
  - Both claim exactly what the threat model at lib/render-boundary.ts:9-19 guarantees: a labelled fence the body cannot structurally escape. Neither claims protection against persuasion.
- I checked for other overclaiming E137 wording in the owned files. I scanned lines the lane added for inject, "pose as", untrusted, E137, "prompt-injection" and neutraliz, and listed every E137 mention in gates, bin, scripts, prompts, schema, guards, lib, transport and index.ts. None overclaims:
  - prompts/build.ts:77 ("Prompt-injection hardening for the state block (E122)") names what the work is for. It is not a guarantee.
  - The phrase "The fix below closes both" (prompts/build.ts:~89) was already present at base 6c61864, so this lane did not introduce it. It is out of scope here and not a finding.
  - Every other E137 mention (prompts/build.ts:92, 144, 169, 190, 209, 419, 542, 547) describes a mechanism: routing, labels, the shared renderer, or the unclosable fence.

## Quality
- Q1 is resolved. In bin/agent-governance-usage-hook.mjs:149-152, the pointer now follows "lane-layout seam".
- Q2 is resolved. The wording differs from my suggestion but is acceptable: "fallback (C3) lets one covering report satisfy additional ids" is self-explanatory.
- **N1 (optional)** — The rewording left short ragged final lines in three places: bin/agent-governance-context.mjs:169 ("J2-NEW-1). It parses state"), lib/render-boundary.ts:5 ("Every render site") and bin/agent-governance-usage-hook.mjs:152 ("exit 0."). This is cosmetic only, because the spec forbids reflowing code, not comments. It does not block approval.

## Architecture
No change since Round 1. The fix changes comments only, and layering is unchanged.

## Security
The Round 1 documentation-overclaim concern is gone. The comments now state only the structural guarantee, so a maintainer is not led to skip reasoning about the persuasion residue. The new text adds no paths, URLs or codenames.

## Performance
No findings. The change is comments only, and AC1 confirms the emitted JS is byte-identical.

## Verdict
APPROVED — C1 is fixed at both sites with wording that matches the render boundary's threat model, no other overclaiming wording remains in the owned files, and AC1 through AC5 pass on the reviewer's re-run.
