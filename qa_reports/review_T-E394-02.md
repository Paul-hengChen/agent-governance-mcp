# QA review — T-E394-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-03T08:39:16.773Z — FAIL — by qa-engineer

suite-result: 85/86 passed (server-recorded from qa_suite_result; command: node --test test/e394-release-script.test.mjs test/e394-release-sop.test.mjs)

Dispatch A (T-E394-11, T-E394-15) committed 2932dad: test/e394-release-script.test.mjs (59 tests) and test/e394-release-sop.test.mjs (27 tests); 85/86 pass.

FAIL (implementation, 1): test/e394-release-script.test.mjs:353 "AC-S2 VERSION_INCOHERENT stops a stale README pin, not a correct bump whose version extends the old one (R3)". Implementation site scripts/release.mjs:262 (T-E394-02 preconditions): readme.includes(`#${prevTag}`) is a substring test, so with PREV_TAG v1.2.1 a correct README pin #v1.2.10 is read as the stale pin #v1.2.1 and prepare stops RELEASE_STOP VERSION_INCOHERENT: README.md still pins #v1.2.1 (exit 12). AC-S2: VERSION_INCOHERENT must fire for README pins not bumped, not for a correct bump. Fix: use the token boundary versionToken() already applies at :421 (not followed by a word char or .digit); the same test also asserts a README still holding the old pin plus the new pin stops with 12. Listed in qa_reports/expected-red_e394-release-sop-rewrite.txt.

Reviewer risk dispositions: R3 confirmed and FAILed as above. R2 not confirmed: the real-child test (test/e394-release-script.test.mjs:327 area, 3 MB forwarded child stderr, reader paused 500 ms, piped stderr on darwin) saw the RELEASE_STOP VERSION_INCOHERENT line last and exit 12; kept as a guard, no change required. R1 judged not an AC violation (AC-S6 names no truncated-input rule): the end-to-end test "AC-S6 a Multi-feature release note in --state makes the named feature's spec mandatory" proves the note is honoured when --state carries it; a read-view elision marker in pending_notes stays an unguarded input (recommended hardening: preInputs stops USAGE on a note starting with the read-view marker, or SOP step 1 says to save the unelided state) — no test forces it. Observation, not failed: the CLI main guard compares import.meta.url with process.argv[1] unresolved, so an absolute invocation through a symlinked directory (macOS /tmp, /var) runs nothing and exits 0 silently; the SOP's relative form from the repo root is unaffected; fixtures use realpath.

AC coverage: S1 dry-run per phase (tree, index, all refs, origin, gh mutation log unchanged, step order); S2 31-class table equals architecture, every class triggered with exit code and last-stderr RELEASE_STOP; S3 static (single spawnSync call site, no shell) + 5-flow call enumeration against an independent allow-list + isAllowed probes; S5, S6 (REQUIRE remedy), S7 (stops, resume), S8, S9; 40 S-class lessons carry L:<id>. SOP: P1-P8, P10 (16 units byte-identical to the base sha, guarded by rev-parse), H5, H6, AC-L1 meta-assertion over all 69 ids. Full-suite expected-red diff and the re-pin dispatches are still ahead (T-E394-12..16).

