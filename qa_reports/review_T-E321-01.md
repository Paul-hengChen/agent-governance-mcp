# QA review — T-E321-01 (qa-only audit)

Spec: specs/e320-ci-check-sha-and-small-fixes.md, AC-E321-1..3. Lane base cac3036.

## AC-E321-1 — per-file verdict (four manifest-reading tests)

| file | verdict | evidence |
|---|---|---|
| test/e177b-lane-status.test.mjs | no change needed: never reads a real `specs/fanout-*.md`. It builds throwaway git repos; line 120-125 asserts the fixture has no `specs/` dir at all, and line 136 greps `tools/lane-status.ts` source for `fanout` (source stability, not manifest content). | :39, :120-136 |
| test/e178b-fanout-unmatched.test.mjs | no change needed: the only manifest input is the frozen copy `test/fixtures/e178b/fanout-wave7-e177a.md` (:31, :208-213, read at :210); :244-262 write their own manifests into a temp repo. No real `specs/fanout-*.md` is read, no row count/date/line number is pinned. | :31, :207-262 |
| test/e235b-relative-worktree.test.mjs | no change needed: golden tests use the frozen `test/fixtures/e177a/**` (:29, :128). The R11 sweep (:357-376) reads every real `specs/fanout-*.md` but asserts only structure (validate prints no WARN, no absolute worktree cell) plus a monotone floor `files.length >= 13` (:363); today the count is far above 13 and the floor can only trip if manifests are deleted, which is the sweep's intended alarm. Brief explicitly allows validate sweeps to stay. | :357-376 |
| test/e299-check-bookkeeping.test.mjs | no change needed: every fanout manifest it touches is a generated in-test fixture (`manifest()` / `mkFixture`, :322-384). The one real-corpus case (:435-445) asserts exit 0 and an `OK (` prefix, and its own title says the note count is deliberately not pinned. | :322-384, :435-445 |

Result: 0 of 4 files changed. No growable content of a real manifest is pinned in any of them.

## AC-E321-2 — repo-wide fixed-base diff audit

Searches run over all of `test/` (patterns: `"diff"`, `git diff`, `--name-only`, `diff --quiet`, `"show"`, `"ls-tree"`, `"rev-list"`, `"merge-base"`, `"archive"`, plus short-sha literals near BASE/SHA identifiers). Every hit:

| hit | what it does | class | owner / action |
|---|---|---|---|
| test/e178a-integrator-role.test.mjs:19 + :283-284 | `BASE_SHA = "3c72a83"`; `git diff BASE_SHA -- content/const-15-core-tail.md` counted against the working tree (<= 6 added lines). Loud skip if history absent. | HAZARD (fixed base vs working tree; grows with any later const-15 edit) | not e320-owned — listed only; filed E321-NEW-1 |
| test/e296-manifest-tier.test.mjs:290, :304 | AC10 compares `fanout.mjs render` output of HEAD with output of base code `c392cc3` (git archive) for the same input; one input is the real closed `specs/fanout-post-v4-w2.md`. Loud skip if base absent. | HAZARD (fixed base vs HEAD behavior; breaks at the next legitimate render change) | not e320-owned — listed only; filed E321-NEW-1 |
| test/e130-lane-default.test.mjs:144-145 and :264-265 | `git diff --stat 121ddc8..5896bdd` | SAFE (closed historical range of two fixed shas, guarded by `skipIfHistoryAbsent`) | no action |
| test/e308-single-source-tier-enum.test.mjs (:79 comment) | was the v4.6.0 hazard; already converted to a content check (commit 124e80e line) | already fixed | no action |
| test/e177a-manifest.test.mjs:78, :147, :296 | short shas are parsed fixture values / CLI args, no git diff | SAFE (not a diff assertion) | no action |
| test/e177a-check-cli.test.mjs:163, :214 | matches a printed note string / comment; `--base` points at a temp-repo ref | SAFE | no action |
| test/verify-release.test.mjs:1191 | regex over SOP text containing `git diff --cached --name-only` | SAFE (text assertion on content/**) | no action |
| test/release-staging.test.mjs (many lines; :2247, :2268 run `git diff --cached` in a temp repo) | SOP text assertions plus temp-repo staging simulations | SAFE | no action |
| test/e258b-comment-scan.test.mjs:415-418 | archive of committed HEAD, "base is HEAD" | SAFE (HEAD vs HEAD) | no action |
| test/qa-visual-skill-split.test.mjs:184, test/evidence-provenance.test.mjs:32, test/pixel-gate-attestation.test.mjs (several) | the literal phrase "git diff confirms source untouched" inside evidence fixtures | SAFE (string in fixture) | no action |
| test/feature-lease.test.mjs:1545-1631, test/e248-relative-mailbox-header.test.mjs:285, test/e115-join-precondition.test.mjs:542, test/e234-hygiene-scan.test.mjs:559, test/e130-lane-default.test.mjs:127 | comments or SOP-text assertions mentioning `git diff` | SAFE | no action |

Hazard hits: 2 files (3 lines), neither owned by e320. `git diff cac3036 --name-only -- test/` on this lane lists only the e320-owned files (see commit list below); no non-owned test file was edited.

## AC-E321-3 — second instance

Count of confirmed same-class hazards outside the four audited files: 2 (e178a:283, e296:290). A `pending-ticket` block `E321-NEW-1` is filed in `.current/e320/pending-tickets.md` (above `## Applied`) carrying both and the "one-line convention" request; no SOP/`content/**` edit was made. A second block `E317-NEW-1` (reviewer's out-of-scope note, confirmed) is filed for the `<ws>/.current/<lane>` emit.

## Verdict

PASS — audit complete, 0 test changes needed in owned files, 2 non-owned hazards listed and ticketed.
