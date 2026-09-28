# Review — T-E90-01

covers: T-E90-01

Feature: `e90-golden-capture-completeness` (backlog E90, order 13e)
Round: 1 — by code-reviewer (opus; sr-engineer was pinned `fable`, so no same-model bias)
Under review: `git diff scripts/capture-constitution-golden.mjs` — 1 file, +107/−33. `git status` confirms zero bytes changed under `test/`.

## Summary
- One script completed into the standing regeneration tool for `test/fixtures/compose-golden/`: two previously-uncapturable monolith fixtures are now derived, all 12 captures route through a fail-loud `writeFixture()`, and a closing directory-vs-captured guard exits 1 on any fixture the script does not produce.
- **Both new derivations are the same operation their assertions perform** — verified by code identity *and* by a live co-movement probe (below), not by today's byte match.
- The `content/`-only reader with no `.current/` override probe is the correct and only correct choice, for both monoliths.
- The completeness guard closes the filed defect class. One residual path remains open, but it is loud (red suite), not silent, and the cut explicitly assigns the suite-side class guard to T-E90-02.
- The `String#length` → `Buffer.byteLength` log fix is ruled **in cut**. Verdict: APPROVED, zero blocking findings.

## Correctness

**(1) Derivation-vs-assertion equivalence — verified, not assumed.** This was the primary risk (same bytes today, different semantics tomorrow), so I checked it three ways.

*Textual identity of the operation:*
- Constitution monolith, script (`scripts/capture-constitution-golden.mjs:190-194`): `CONSTITUTION_SEGMENTS.map((s) => readContent(s.file)).join("")` with `readContent = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8")`. Assertion (`test/compose-equivalence.test.mjs:148-153`): `CONSTITUTION_SEGMENTS.map((s) => fs.readFileSync(path.join(ROOT, "content", s.file), "utf-8")).join("")`. Same expression, same `join("")`, and both import `CONSTITUTION_SEGMENTS` from the *same* `dist/prompts/constitution-manifest.js` (script:63-65, test:44). Neither filters by `includeSegment` — the invariant is a full cat, and both take it as such.
- Skill monolith, script (`:201-205`): `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent)`. Assertion (`test/skill-manifest.test.mjs:120-125`): the identical three-argument call, and that file's own `readContent` (`test/skill-manifest.test.mjs:74-76`) is byte-for-byte the same `readFileSync(path.join(CONTENT_DIR, f), "utf-8")` the script defines. Both omit the optional fourth `hasOverride` argument. Same module from `dist`, same capability profile, same loader, same precedence branch (`prompts/skill-manifest.ts:119` — precedence 1 is skipped because the probe is absent; precedence 2 filters `SKILL_SEGMENTS` by `includeSkillSegment`).

*Live semantic co-movement probe* (the check that distinguishes "same operation" from "same bytes today"). I perturbed real source fragments, regenerated, and asserted the goldens still passed — i.e. the tool's output moved *in lockstep* with what the assertions compute, rather than merely coinciding:
- Appended a comment line to `content/const-05-core-standards.md` → capture rewrote 11 fixtures including `constitution-monolith.txt`; `node --test test/compose-equivalence.test.mjs` → 14 pass / 0 fail.
- Appended a comment line to `content/coord-04-host-watermark.md` → capture rewrote `skill-coordinator-monolith.txt` (+2 lines, host-tagged fragment, correctly absent from the lean reconstruction); `node --test test/skill-manifest.test.mjs` → 27 pass / 0 fail.
- Tree restored (`git checkout -- content/`), rebuilt, re-captured: fixtures byte-identical, `git status` clean.

*Reachability of the fallback branches.* If `SKILL_SEGMENTS["skill-coordinator.md"]` were ever removed, `composeSkill` precedence 3 would `load("skill-coordinator.md")` — and `content/skill-coordinator.md` does not exist (retired at T-D6-04, confirmed). That throws ENOENT and exits non-zero rather than writing a wrong fixture. The correct failure mode.

No finding.

**(2) Fail-loud paths — verified by execution.**
- Orphan fixture: `echo junk > test/fixtures/compose-golden/orphan-probe.txt` → `exit=1` with the file named in the stderr message. The guard (`:207-212`, `:219-225`) fires.
- Deleted load-bearing fixtures: `rm constitution-monolith.txt skill-coordinator-monolith.txt` → re-run exits 0 and restores **both** to their committed bytes (`git diff --exit-code` clean). This is the direct disproof of "accidentally untouched" for the two fixtures E43 hand-rebuilt.
- Empty/non-string derivation: `writeFixture` (`:75-78`) throws before writing. It is defense-in-depth rather than a live path today (all 12 derivations are non-empty by construction), which is the right posture for a baseline writer.

**(3) Residual path — non-blocking, correctly deferred.** The closing guard computes `onDisk − captured`, so it catches the E90 defect exactly (a fixture *present* on disk, load-bearing, silently not regenerated). It cannot catch the inverse: a fixture the suite asserts against that is *absent* from disk and has no capture. That run exits 0. But that state is not the E90 defect class — the suite is immediately, loudly red with ENOENT, never silently green, and the tool never reports having regenerated something it did not. The cut assigns the suite-side class assertion (script's capture set ≡ fixture directory) to T-E90-02, and only that assertion can close the residual, since a guard living inside the script fires only when someone runs the script. Correct place to draw the line.

**(4) Partial-failure semantics.** A throw on capture *k* leaves captures 1..k−1 rewritten and the rest stale, with a non-zero exit. Acceptable for a regeneration tool whose output is inspected via `git diff` — the state is visible and the exit code is honest. Noting it, not requiring a transaction.

**(5) `written` declaration order.** `writeFixture` (`:74`) closes over `written`, which is declared at `:84`, after the function. Safe today — every call site is below `:84` — but a future capture inserted between the function and the array would hit a TDZ `ReferenceError`. Cosmetic robustness, see Quality.

**(6) Acceptance re-run independently** (not trusted from the reply): `npm run build` clean → `node scripts/capture-constitution-golden.mjs` reports 12 fixtures → `git diff --exit-code test/fixtures/compose-golden/` exit 0. Full suite re-run here: **1756 pass / 0 fail**, matching the E43 close count — no test added or retired.

## Quality

- Header comment block (`:1-43`) now describes what the script actually does, and every load-bearing claim in it checks out: 12 total with the 8/2/1/1 breakdown matching `BUILD_MODES` and the two new calls; "the monolith and the strip code are both gone" — `content/constitution.md` is absent and `stripChainOnly`/`stripDesignOnly` survive only as historical comments in `prompts/build.ts:58`, `prompts/constitution-manifest.ts:8`, `bin/agent-governance-context.mjs:62`; the `t-golden-byte-identity` pin for the skill monolith exists as named. The retained DR-5 note is now correctly qualified ("a script, not a test file … but the fixtures it writes ARE a qa-owned surface"), which is the right reading of §2 for this file.
- The three comments that carry a *judgement* rather than a restatement (no-override rationale at `:70-73`, why the monolith is manifest-derived at `:189`, why the guard exists at `:207-210`) are the ones a future editor actually needs. Good ratio; no narration-of-the-obvious.
- `writeFixture`'s `what` parameter is error-message-only and each call site passes a genuinely diagnostic string (e.g. `` `cat(${CONSTITUTION_SEGMENTS.length} constitution fragments in manifest order)` ``). Worth keeping.
- `padEnd(30)` → `padEnd(32)` is a real fix, not churn: the longest fixture name is exactly 30 chars (`skill-coordinator-monolith.txt`), so the old width left zero gap before the byte column.
- Nit (non-blocking): move `const written = []` (`:84`) above `writeFixture` (`:74`) so the closure's dependency is declared before its consumer — removes finding (5) entirely.
- Nit (non-blocking): the success banner `Captured 12 golden fixtures…` (`:214`) prints *before* the completeness guard's `console.error` + `exit(1)`. A reader scanning the head of a failing run's output sees "Captured 12". Printing the guard first, or suffixing the banner when `uncovered.length > 0`, would make head-scanning as honest as the exit code. Cosmetic — the exit code and stderr are both correct, and this is the same "don't report success misleadingly" instinct the ticket is built on, which is why it is worth a line even at nit level.

## Architecture

- The design decision under item (2) of my brief is **right, and right for both monoliths**. `composeSkill` accepts an optional `hasOverride` probe and the three production call sites all pass one (`tools/role.ts:88`, `prompts/build.ts:352-356`, `bin/agent-governance-context.mjs:112`) — but every one of those is serving *live* context to an agent, where an operator's `.current/` override is authoritative by design (`prompts/skill-manifest.ts:105-108`). A committed golden baseline is the opposite situation: the fixture is the oracle for a `content/`-derived composition, and both assertions read `content/` with no override notion whatsoever (`compose-equivalence.test.mjs:149-151` is a plain cat; `skill-manifest.test.mjs:120-125` omits the probe). Passing a probe here would make the captured bytes a function of the capturing checkout's local state — the fixture would encode one developer's override and then fail the very assertion it exists to serve. So the no-probe reader is not merely defensible, it is the only choice that keeps the fixture an oracle. The rationale is recorded at the code (`:70-73`), which is where the next person will look.
- Worth noting the whole capture set is override-free by construction, not just these two: the 8 `build.ts` fixtures and 2 hook fixtures run against freshly-created temp workspaces, so `loadContent`'s `<workspace>/.current/` probe has nothing to find. Consistent baseline semantics across all 12.
- Residual architectural duplication, stated plainly and *not* a blocker: the script and the two assertions each independently express the derivation. Today they are provably the same operation (see Correctness 1); tomorrow, an assertion that changed host profile or started passing a probe would leave the tool behind silently. The structural fix is a shared derivation module — but that is a new non-test source file, outside a cut scoped to one script, and T-E90-02's class guard (capture set ≡ fixture directory) covers the recurrence path E90 was actually filed for. Recording it as a known bound, appropriate for the next content-composition ticket to revisit rather than something to force into this round.
- No `specs/e90-*.md` or architecture doc exists; the backlog `| E90 |` row is the contract per the cut. Implementation matches it point-for-point: (a) manifest-derived constitution monolith, (b) 12th capture added, (c) silent-success half killed, (d) header rewritten. No layering change; the script remains a `dist/`-consuming tool with no imports into `test/`.

## Security

No findings.
- No new subprocess surface. The single `execFileSync` (hook capture) is untouched and still takes a fixed argv — no shell, no interpolation.
- Both new reads take filenames from the compiled manifests (`CONSTITUTION_SEGMENTS[].file`, `SKILL_SEGMENTS`), never from argv, env, or file content, so `path.join(CONTENT_DIR, file)` has no traversal reachability. `writeFixture`'s `file` argument is a string literal at all 4 call sites.
- No secrets, no network, no credential material. Writes confined to `OUT_DIR` and per-run temp workspaces, each cleaned in a `finally`.
- Scope check on the diff as a whole: `git status` confirms nothing under `test/` moved, honoring the ticket's hard boundary. (`docs/backlog.md` and `tasks.md` are dirty in the tree, but those are PM/coordinator intake rows — E43 close-out and the E90 task rows — not part of this cut.)

## Performance

No findings. Complexity is unchanged for the 10 pre-existing captures (10 temp workspaces, 2 hook subprocesses — dominated by the two `execFileSync` spawns, as before). The two new captures add ~17 synchronous small-file reads plus two string joins; the closing guard adds one `readdirSync` and an O(n) set difference over 12 entries. Total wall time for the run is unchanged in practice. No hot path, no retained references, no unbounded growth — `written` holds 12 tuples.

## Verdict

**APPROVED** — the two new derivations are provably the same operations their assertions perform (confirmed by code identity, by shared `dist` imports, and by a live perturb-and-co-move probe), the no-override reader is the only choice consistent with a committed oracle for both monoliths, the fail-loud writer plus the directory-vs-captured guard close the silent-success defect E90 was filed for (both branches exercised here, exit 1 and byte-identical restore), the `Buffer.byteLength` log fix belongs in this cut, and the header is now accurate; the two nits and the deferred shared-derivation observation are non-blocking.

### Scope ruling — the `Buffer.byteLength` log fix (in cut)

The filed ticket did not name it, so it needs an explicit ruling rather than silence. It is **in cut**: two lines plus a comment, in the one file the cut owns, with zero effect on any fixture byte (verified — logged figures now equal `ls -l` exactly: 39376 for `constitution-monolith.txt`, 35087 for `skill-coordinator-monolith.txt`, and so on for all 12). More to the point, the ticket's item (c) is *"a tool that reports success while leaving tests red is worse than a tool that is absent"* — and the byte column is part of the report this tool makes. A progress log that under-counts UTF-8 by ~300 bytes on the monolith is the same failure in miniature, and it demonstrably cost a false byte-identity alarm during this task. Splitting it into its own ticket would have shipped a fail-loud tool whose own output still lied. Folded in correctly, with the reasoning recorded at the code (`:79-81`).
