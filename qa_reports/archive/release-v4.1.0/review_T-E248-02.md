# Review — T-E248-02 (covers: T-E248-01, T-E248-02)

## Round 1 — by qa-engineer

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared — no
`qa_reports/expected-red_e248-relative-mailbox-header.txt` in this lane).

## Phase 1 — Review

Read `tools/fanout-manifest.ts` (the `resolveMailboxHeader` function,
`:806-816`, and its two call sites: the `renderPrompt` mailbox block
`:855-901`, and the `runValidate` WARN `:1219-1223`). Cross-checked against
`review_reports/review_T-E248-01.md` (code-reviewer APPROVED, commit
`ae3f044`, reviewed independently line-by-line) — no new correctness issue
found; QA's scope here is coverage, not re-litigating a review that already
passed. `scripts/fanout.mjs` and the `render`/`validate` CLI usage text are
unchanged, matching the spec's Out of Scope list.

### Copy Audit Gate (3a)

The spec's *Copy / Strings* table has 3 entries:
- `mailbox.tilde.code` = `MAILBOX_TILDE` — matches `FANOUT_CODES.mailboxTilde` (`:126`).
- `mailbox.tilde.message` — matches `resolveMailboxHeader`'s message string
  verbatim (`:811`), pinned by AC5's test (`test/e248-relative-mailbox-header.test.mjs`,
  the tilde test asserts `/home-directory expansion is not performed/`).
- `mailbox.absolute.warn` — matches `MAILBOX_ABSOLUTE_WARN` (`:141-142`)
  verbatim, pinned by AC8's test (exact-string `assert.equal` on the WARN
  line, not just a regex).

No drift, no coverage gap (no new user-facing string appears outside this
table).

### Visual Audit Gate (3b)

N/A — spec's Visual Tokens table is `N/A` (no visual literals). Skipped.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no `design/e248-relative-mailbox-header.md`, no Visual
Baselines declared).

## Phase 3 — Tests

**Test file placement**: brief's `Test-file placement` line names
`test/e248-relative-mailbox-header.test.mjs` (new; creation pre-authorized).
Acted on that branch — new file created, nothing else touched.

### Spec-to-Test map

| AC | test |
|---|---|
| AC1 | `AC1 relative header resolves against primary` |
| AC2 | `AC2 relative header, primary from git` |
| AC3 | `AC3 absolute header unchanged` (+ existing `AC8 render field sources` in `test/e177a-manifest.test.mjs`, `/hdr` assertion, untouched) |
| AC4 | `AC4 --mailbox-root precedence, flag semantics untouched` |
| AC5 | `AC5 refusal: ~ header` |
| AC6 | `AC6 refusal: empty / no header` |
| AC7 | `AC7 relative header with no primary` (includes the reviewer's optional pin: a `~` header with no primary reports exactly `{PRIMARY_NOT_FOUND}`) |
| AC8 | `AC8 validate follows the new semantics` |
| AC9 | `AC9 format spec rows synced` (light in-repo pin; authoritative proof is the `git diff` below) |
| AC10 | full `npm test` (below) |

### Coverage gate

`resolveMailboxHeader` (all 3 branches: tilde / absolute / relative) and both
call sites (`renderPrompt` mailbox block, `runValidate` WARN) are exercised
directly by the new test file. Tooling for a numeric line-coverage % is not
wired into this repo's `node --test` setup; noted per SOP as "can't be
measured" — every branch of the touched code is hit by at least one
assertion above (see the AC map).

### Security smoke tests

- Boundary inputs: empty/whitespace-only header (`AC6`), bare `~` with
  no suffix (`AC5`), a header that merely contains `~` after a leading `.`
  (`AC5`, `resolveMailboxHeader("./~x", "/p")`).
- No auth/permission surface on this module (pure string/path resolution,
  git read-only via `execFileSync` argv).

## Phase 3.5 — AC Execution Log

The spec (`specs/e248-relative-mailbox-header.md`) annotates every AC with a
`proof:` line. Executed each, in order, before attempting PASS.

**AC1** — `node --test test/e248-relative-mailbox-header.test.mjs`
(the relative-resolves test). Result: `ok 1 - AC1 relative header resolves against primary`. PASS.

**AC2** — same file (the git-primary test). Result: `ok 2 - AC2 relative header, primary from git`. PASS.

**AC3** — `node --test test/e177a-manifest.test.mjs` (existing `/hdr` assertion, inside `AC8 render field sources`) plus the e248 absolute-verbatim test. Both files run together:
```
$ node --test test/e248-relative-mailbox-header.test.mjs test/e177a-manifest.test.mjs
# tests 19
# pass 19
# fail 0
```
`AC3 absolute header unchanged` passed; `AC8 render field sources` (which
carries the pre-existing `/hdr` assertion) passed unchanged. PASS.

**AC4** — same new file (the precedence tests: flag beats relative header,
flag beats `~` header with ok=true, relative flag stays verbatim). Result:
`ok 4 - AC4 --mailbox-root precedence, flag semantics untouched`. PASS.

**AC5** — same file (the tilde test). Result: `ok 5 - AC5 refusal: ~ header`. PASS.

**AC6** — same file (the empty-header test). Result: `ok 6 - AC6 refusal: empty / no header`, asserting code `MAILBOX_ROOT_ABSENT`. PASS.

**AC7** — same file (the no-primary test). Result: `ok 7 - AC7 relative header with no primary`, asserting the error code set is exactly `{PRIMARY_NOT_FOUND}` for a relative, absolute, AND `~` header (the reviewer's optional pin). PASS.

**AC8** — same file (the validate tests: `runValidate` on a temp manifest for
each of the four values — no header, relative, absolute, `~` — asserting
exit 0 and the WARN line present only for the absolute case, byte-exact
including the line number). Result: `ok 8 - AC8 validate follows the new semantics`. PASS.

**AC9** — `git diff main -- specs/e177a-fanout-manifest.md`:
```
diff --git a/specs/e177a-fanout-manifest.md b/specs/e177a-fanout-manifest.md
index 27c0e2e..b15053e 100644
--- a/specs/e177a-fanout-manifest.md
+++ b/specs/e177a-fanout-manifest.md
@@ -20,7 +20,7 @@ ...
-| `mailbox:` (NEW, optional) | Line matching `^mailbox:\s*(\S+)`. Gives the mailbox root (the directory that holds `<lane>/to-integrator.md`). | render (if no `--mailbox-root`) |
+| `mailbox:` (NEW, optional) | Line matching `^mailbox:\s*(\S+)`. Gives the mailbox root (the directory that holds `<lane>/to-integrator.md`). The value may be primary-relative (e.g. `../<lanes-dir>/_mailbox`) and is resolved against primary; an absolute value is taken byte-for-byte, and `validate` WARNs on it (line number only, no path); a value starting with `~` fails render with `MAILBOX_TILDE` (E248). | render (if no `--mailbox-root`); validate (absolute-value WARN only) |
@@ -47,7 +47,7 @@ ...
-| `信箱` | CLI `--mailbox-root <dir>`; else manifest `mailbox:` line. Rendered as `<root>/<lane>/`. | `MAILBOX_ROOT_ABSENT`. The root is never derived from the worktree path. |
+| `信箱` | CLI `--mailbox-root <dir>` (wins; taken byte-for-byte, never resolved); else manifest `mailbox:` line — a relative value resolved against primary, an absolute value byte-for-byte (E248). Rendered as `<root>/<lane>/`. | `MAILBOX_ROOT_ABSENT`; `MAILBOX_TILDE` (header starts with `~`). The root is never derived from the worktree path. |
```
Exactly the two named table rows changed; no other line of the spec differs. PASS.

**AC10** — see `## Full regression (AC10)` below.

## Phase 4 — Run

Project build: `npx tsc -p .` produces no diff against the committed
`dist/` (already verified independently by code-reviewer at `ae3f044`; QA's
own `npm test` run below rebuilds via the pretest hook, confirming this
holds).

CI runnability: `npm test` runs headlessly, zero human interaction.

## Full regression (AC10)

Ran after committing the test file + this evidence, with a clean worktree
(no untracked files) — see the commit log and `git status` recorded in the
PASS note below.
## 2026-09-28T09:19:51.929Z — PASS — by qa-engineer

PASS. AC1-AC9 each have a dedicated test in the new test/e248-relative-mailbox-header.test.mjs (Phase 3.5 AC Execution Log in qa_reports/review_T-E248-02.md), plus AC3's existing /hdr assertion in test/e177a-manifest.test.mjs stays green untouched. AC9 confirmed via git diff main -- specs/e177a-fanout-manifest.md: exactly the two named rows changed. AC10: full npm test after commit, clean worktree, 2916/2919 pass, 0 fail, 3 skipped. Code review (T-E248-01) was already APPROVED (review_reports/review_T-E248-01.md, ae3f044); QA found no new correctness issue. Reviewer's optional pin (a ~ header with no primary reports exactly {PRIMARY_NOT_FOUND}) is locked in by AC7's test.

