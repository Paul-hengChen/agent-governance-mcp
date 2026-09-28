# QA Review — T-E100-02 (+ T-E100-01, T-E101-01, T-E100-03, T-E101-02)

covers: T-E100-01, T-E101-01, T-E100-02, T-E101-02, T-E100-03

Feature: `e100-e101-dispatch-declaration`. Verdict: **PASS**.

## Scope

- **T-E100-02** (mine, the real work): extend `test/agc-adapters.test.mjs` +
  `test/p0-onboarding-lite-default.test.mjs` to pin the three-round review's
  QA gaps; run the dogfood migration in this repo; verify build/audit/suite/
  `agc check`.
- **T-E101-02** (coordinator-authored, already applied — verify-only): the
  two `docs/backlog.md` priority-cell edits.
- **T-E100-01 / T-E101-01 / T-E100-03** (sr-engineer, three code-reviewer
  rounds, all APPROVED — `review_reports/review_T-E100-01.md`): re-derived,
  not ratified, per the brief's explicit instruction. See *Re-derivation*
  below.

## Expected-Red Diff

(Phase 0.5, skill-qa-engineer.)
`qa_reports/expected-red_e100-e101-dispatch-declaration.txt` exists, declares
exactly one entry: `test/p0-onboarding-lite-default.test.mjs | AC1: agc init
creates .config.json + tasks.md with expected templates, no handoff.md
(re-pinned E34)`.

Ran the FULL suite **before** any re-baseline edit: `npm test` → **1780/1781
pass, 1 fail**. The single `not ok` (`not ok 830`) is byte-identical to the
manifest's one entry, confirmed by name and by file:line
(`test/p0-onboarding-lite-default.test.mjs:66`,
`assert.deepEqual(cfg, { schema_version: 1 })` vs actual `{ schema_version:
1, host: 'claude-code' }`).

**Disposition: clean (1/1 manifest entries confirmed red, 0 unexplained
reds).** This is the shape-change AC1 exists to be re-pinned against — the
manifest's own rationale block names it as qa-owned re-pin work, not
sr-engineer's (`test/` is qa-owned, Constitution §2). Re-baselined in Phase 3
below.

## Re-derivation (not ratification) of the review's central claim

The brief flagged that round 2 and round 3 of `review_reports/review_T-E100-01.md`
both assert the reparse guard at `bin/agc-init.mjs:228-236` is *exactly*
sufficient against a wrong-occurrence splice, and that two judges agreeing is
not the same as it being true. Re-derived independently, two ways:

1. **Read the source cold** (before reading the review's proof a third time)
   and worked through the same two facts the review's proof rests on: (a)
   `KEY_VALUE_RE` can only match a real JSON `host` key-value pair — a `"`
   inside a JSON string is always escaped, so the literal 6-char token
   `"host"` followed by `:` cannot occur inside a string *value*; (b)
   `JSON.parse` duplicate-key semantics are last-wins, so `reparsed.host`
   reads the *last* top-level occurrence regardless of which occurrence the
   unanchored regex spliced. Combining (a)+(b): a wrong-occurrence splice
   leaves the last-top-level value exactly as it was pre-splice (still not a
   non-empty string, or `has-host` would have already returned), so
   `:234`'s reparse check catches every such case. Same conclusion as the
   review, reached independently from the code rather than from the prose.
2. **Ran it, not just read it.** Built the CLI fresh (`npm run build`) and
   fired the actual proof case at the real binary:
   `{"host": {"a":1}, "n": {"host": "x"}}` — the regex matches the *nested*
   key first (textually earlier), splices it, and the file must either stay
   byte-identical (guard holds) or get corrupted (guard doesn't). Result:
   byte-identical, reported `Not updated (rejected, see warnings)`, never
   `Updated`. Also ran the four falsy repairs, `"cursor"`, a truthy number
   (`42`), and malformed JSON — all matched the review's evidence table
   exactly (see `qa_reports/expected-red_e100-e101-dispatch-declaration.txt`
   and this doc's Phase 3 below for the full list). See
   `test/agc-adapters.test.mjs` — "E100 reparse-guard proof: a
   wrong-occurrence splice never proceeds" — this case is now a permanent
   test, not just a manual probe that evaporates once this session ends.

**Conclusion: the claim holds.** Independently re-derived from first
principles and independently re-run against the built CLI, not accepted on
the strength of three review rounds agreeing with each other.

## Phase 1 — Review (spec = backlog rows; PM/ARCH skipped per `scope_decision_why`)

No `specs/<feature>.md` exists for this feature (mini-chain, backlog rows
ARE the spec, confirmed by `ls specs/` showing no e100/e101 file and no
`design/` directory) — Copy Audit Gate (3a), Visual Audit Gate (3b), and
Phase 1.5 Visual Compare are **N/A by construction**, consistent with
`review_reports/review_T-E100-01.md`'s own "No architecture spec for this
feature; the backlog rows are the spec" (Round 2/3 Architecture sections).

Read the full implementation (`bin/agc-init.mjs`, all 421 lines) and the full
three-round review. Findings against my own reading, not carried from the
review's verdict:

- `upsertHostKey()`'s value test (`:166-171`) matches the consumer
  (`tools/config.ts:255-258`, `typeof host === "string" && host.length > 0`)
  exactly — confirmed by reading both files side by side, not by trusting
  the comment that says so.
- `atomicWriteFile()` (`:119-123`) is a faithful mirror of
  `atomicWriteConfig()` (`tools/config.ts:326-333`) and is now the only
  write path for every in-place mutation in the file (`writeClaudeBlock`'s
  `"updated"` and `"appended"` branches, plus `upsertHostKey`'s repair/insert
  paths) — confirmed by grepping every `fs.writeFileSync` call site in
  `bin/agc-init.mjs`: the two `"created"`-class paths (brand-new
  `.config.json`, brand-new `CLAUDE.md`, brand-new skip-mode adapter) are the
  only ones NOT routed through it, and each has "nothing pre-existing to
  lose" as its stated reason — verified true in each case.
- E101's `templates/agent-adapters/claude.md` bullet: independently grepped
  for the standing-request claim, the host-nudge non-override claim, and the
  `code-reviewer`/`qa-engineer` MUST-Task claim — all three present, in the
  claim class the row asked for (not a hardcoded gate count — correctly
  dropped per Round 1 Q4). `codex.md` / `antigravity.md` independently
  grepped — neither carries "standing request" or the judge-dispatch
  language. See `test/agc-adapters.test.mjs` "E101: templates/agent-adapters
  /claude.md states the judge-dispatch obligation..." for the permanent pin.

**One item surfaced by my own re-derivation, not in the review**: I ran the
symlink case (R3-A) live, not just read the review's account of it —
confirmed the same regression the review reports (symlink replaced with a
regular file, canonical target left with the stale block). This is a
code-reviewer-owned architecture/correctness finding (was reviewed in Round 3
and explicitly NOT blocked — "no data is destroyed... net risk still
reduced"), so it is out of QA's FAIL authority per skill-qa-engineer's scope
rule ("Style, architecture, and correctness review are owned by
code-reviewer... do not FAIL the task on those grounds"). I pinned TODAY's
behaviour as a permanent regression-documenting test (`test/agc-adapters
.test.mjs` "KNOWN BEHAVIOUR (R3-A, non-blocking...)") so a future change to
`atomicWriteFile` is a deliberate decision, not a silent one, and I am
flagging it here for a human/PM follow-up call per the review's own
recommendation — **this is an open item, not a blocker.**

## Phase 3 — Tests (T-E100-02)

### Spec-to-test map

| brief item | test |
|---|---|
| (1) fresh init writes `host` | `test/agc-adapters.test.mjs` "E100 config class (1)" + `p0-onboarding-lite-default.test.mjs` AC1 (re-pinned) |
| (2) existing host-less config gains host, preserves every other key + formatting | "E100 config class (2)" + companion "AC2-companion (E100)" |
| (3) existing `"cursor"` untouched | "E100 config class (3)" |
| (4) malformed not clobbered | "E100 config class (4)" |
| claude.md judge-dispatch obligation; codex/antigravity do not | "E101: templates/agent-adapters/claude.md states..." |
| dogfood migration, payoff not just mechanism | "E100 dogfood payoff: ..." + this repo's own migration (below) |
| review gap: falsy host repair class | "E100: falsy host values..." |
| review gap: reparse-guard proof / truthy-unusable | "E100 reparse-guard proof: ..." (×2) |
| review gap: shadowed-key class | folded into the reparse-guard-proof wrong-occurrence test above |
| review gap: formatting preservation as a class (CRLF/tab/single-line/{}/large array) | "E100 formatting preservation: ..." (×2) |
| review gap: no `.tmp` residue | "E100: no *.tmp residue..." |
| review gap: CLAUDE.md prose survival, both branches, no `.tmp` residue | "T-E100-03: CLAUDE.md adopter prose survives..." |
| review gap: AC2 is a green test whose title is false | AC2 retitled + scoped comment + "AC2-companion (E100)" added |
| review gap: symlink disposition (R3-A) | "KNOWN BEHAVIOUR (R3-A, non-blocking...)" — documents current behaviour, flagged for human call (see Phase 1 above) |

15 new/modified tests: 14 in `test/agc-adapters.test.mjs`, 1 new + 1 modified
in `test/p0-onboarding-lite-default.test.mjs`.

### Coverage

Every named case in T-E100-02's brief and every QA gap from all three review
rounds (gaps 1-11, consolidated) is pinned as an executable test, run against
the real CLI binary (`spawnSync` on `bin/agc-init.mjs`) — no mocking of the
splice/reparse/atomic-write logic. Gate not separately measurable by tooling
(no coverage instrumentation wired for `bin/` scripts) — noted per SOP 6c.

### Security smoke

Boundary inputs already covered by the falsy/truthy/malformed/shadowed-key
classes above (empty string, `null`, `false`, `0`, a non-scalar value, and
unparseable JSON). No auth/permission surface in this feature (local CLI,
no network).

## Dogfood migration (this repo)

Before:
```
.current/.config.json  — no "host" key (schema_version, cutApprovalAutoTier, driftBaselineIds only)
CLAUDE.md               — "Subagent dispatch: available (`Task` tool). Use it for role switching when context budget permits."
```

Ran `node bin/agc-init.mjs init` against this repo's own root. Result:
`Updated: .current/.config.json, CLAUDE.md` / `Skipped (already exists):
tasks.md, AGENTS.md, .antigravityrules`. After:
```
.current/.config.json  — gained "host": "claude-code"; every other key byte-identical (git diff: +1 line only)
CLAUDE.md               — dispatch bullet replaced with the full judge-dispatch obligation (git diff: 1 line changed, everything else in the block byte-identical)
```
`git diff --stat`: `.current/.config.json | 1 +`, `CLAUDE.md | 2 +-` (1
insertion + 1 deletion = the single bullet swap) — matches the "expected,
not drift" framing in `scope_decision_why`.

`agc check` after migration: `agc check — OK (3.105.0) — all adapters
current` — exit 0. Per Round 3 QA gap #7, this does NOT by itself prove the
block content is current (it compares stamps only) — I read the actual block
content (above) rather than relying on `agc check`'s exit code as proof.

**Payoff, independently measured** (not accepted from the review's table):
composed `/teamwork` prompt length via `buildPromptForRole('skill-coordinator.md', ...)`
in throwaway temp workspaces:

| `host` | composed length |
|---|---|
| absent | 52,749 |
| `"cursor"` | 52,749 |
| `"claude-code"` | **63,918** |

+11,169 chars, **+21.2%** — independently confirms the review's reported
52,808 → 63,975 (+11,167, +21%) to within ~60 chars (state-footer/timestamp
variance between sessions), same order of magnitude and same conclusion:
declaring `host` is a real, non-trivial context-cost obligation for every
Claude Code workspace that re-runs `agc init`, and this is now a permanent
test (`test/agc-adapters.test.mjs` "E100 dogfood payoff") rather than a
one-time manual measurement.

## Phase 4 — Run

- `npm run build`: clean, 0 `tsc` errors, `check:version` OK, `check:transitions-sync` OK.
- `npm audit --audit-level=high`: exit 0. Only pre-existing moderate/low
  (`hono`, `protobufjs`, `body-parser`, `esbuild`) — no high/critical.
- `npm test` (full suite, after the Phase 3 re-baseline and the dogfood
  migration applied to this repo's own state files): **1796/1796 pass, 0
  fail.** (1781 pre-existing + 15 new from T-E100-02, minus the 1 declared
  red now fixed by the AC1 re-pin = 1781 - 1 + 15 = 1795... actual count
  1796 because the AC2 rename did not remove a test, only the companion
  added one net test per new `test()` call — reconciled directly against
  the `# tests` / `# pass` TAP summary, not computed by hand.)
- `agc check` (this repo, post-migration): exit 0, `agc check — OK
  (3.105.0) — all adapters current`.
- CI runnability: `npm test` runs headlessly, zero human interaction.

## T-E101-02 verification (coordinator-authored, verify-only — not re-done)

`docs/backlog.md` E100 row priority cell: `P1 (raised from P2 by human
priority call 2026-08-31, batched with E101 as one cut)`. E101 row: `P1
(human priority call 2026-08-31, batched with E100 as one cut)`. Both match
`scope_decision_why` verbatim ("both raised to P1 by the same call").

`git diff -- docs/backlog.md` confirms the E100 and E101 diff hunks touch
**only** the priority-column text — every other cell (id, description,
depends_on, est. files, design-link) is byte-identical between `-`/`+`
lines. Pipe count: `grep -o '|' | wc -l` on both rows (and the untouched E99
row, as a control) → **7** each — the 6-column shape, no E74/E88
escaped-pipe regression.

## QA gaps status

All 11 consolidated gaps from rounds 1-3 are now pinned as executable tests
(map above) except:
- **Gap #9 (symlink disposition, R3-A)**: pinned as documented CURRENT
  behaviour, not decided — this needs a human/PM call on whether a
  project-root `CLAUDE.md` symlink is a supported layout. Recorded above as
  an open item. Not a QA blocker (architecture/correctness, code-reviewer's
  charter, already Round-3-APPROVED as non-blocking).
- Diagnostics-channel finding (R3-D, "see warnings" pointing at stderr) and
  the ephemeral-identifier-in-shipped-comments finding (R3-E) are
  code-quality items already filed non-blocking by code-reviewer; no test
  action needed from QA (not a coverage gap, not a failing test).

## Verdict

**PASS.** Full suite 1796/1796, build clean, audit clean (no high/critical),
`agc check` exit 0 post-migration, expected-red diff clean before
re-baseline, all brief cases + all three rounds' QA gaps pinned as
executable tests, reparse-guard central claim independently re-derived (not
ratified) both by source-reading and by running the real CLI against the
proof case, dogfood migration applied to this repo with payoff independently
measured, T-E101-02 verified as scoped (priority cells only, 7 pipes each).
One open item (R3-A symlink disposition) flagged for human follow-up —
non-blocking per QA's scope charter, already dispositioned by code-reviewer.
## 2026-08-31T08:39:22.217Z — PASS — by qa-engineer

PASS. Full suite 1796/1796 (0 fail), build clean, npm audit --audit-level=high clean (no high/critical), agc check exit 0 post-dogfood-migration. Phase 0.5 expected-red diff was clean (exactly the 1 declared AC1 red, verified before re-baseline) then re-pinned. Re-derived (not ratified) the reparse-guard-is-exactly-sufficient claim from source AND by running the real CLI against the wrong-occurrence-splice proof case ({"host":{"a":1},"n":{"host":"x"}} -> byte-identical, rejected) -- now a permanent test. Added 15 tests across test/agc-adapters.test.mjs and test/p0-onboarding-lite-default.test.mjs covering all 3 review rounds' QA gaps (falsy-host repair class, reparse-guard/shadowed-key proof, formatting preservation as a class incl. CRLF/tab/single-line/large-array, no .tmp residue, CLAUDE.md prose survival on both mutating branches, adapter-content class, dogfood payoff via the real loadConfig() pipeline) plus fixed AC1 (declared red, now asserts host key) and AC2 (was a green test whose "byte-for-byte unchanged" title was no longer generally true -- retitled + scoped, companion test added for the pre-E100 host-less re-run case). Ran the dogfood migration in this repo itself: .config.json gained host (git diff +1 line), CLAUDE.md bullet refreshed (1 line changed), agc check OK, payoff independently measured (52,749 -> 63,918 chars, +21.2%, confirming the review's 52,808->63,975/+21% claim to within session-variance). T-E101-02 verified: both backlog priority cells match scope_decision_why verbatim, git diff shows only the priority cell changed in each row, both rows still 7 pipes (E74/E88 trap clear) -- not re-done. One open item, non-blocking and out of QA's FAIL authority (architecture/correctness, code-reviewer's charter, already Round-3-APPROVED as accepted risk): R3-A symlinked CLAUDE.md is replaced not written-through -- pinned as a documented-current-behaviour regression test so a future change is deliberate, flagged for human/PM follow-up on whether a project-root CLAUDE.md symlink is a supported layout. Full detail: qa_reports/review_T-E100-02.md.

## 2026-08-31T08:39:45.766Z — PASS — by qa-engineer

PASS. Full suite 1796/1796 (0 fail), build clean, npm audit --audit-level=high clean (no high/critical), agc check exit 0 post-dogfood-migration. Phase 0.5 expected-red diff was clean (exactly the 1 declared AC1 red, verified before re-baseline) then re-pinned. Re-derived (not ratified) the reparse-guard-is-exactly-sufficient claim from source AND by running the real CLI against the wrong-occurrence-splice proof case ({"host":{"a":1},"n":{"host":"x"}} -> byte-identical, rejected) -- now a permanent test. Added 15 tests across test/agc-adapters.test.mjs and test/p0-onboarding-lite-default.test.mjs covering all 3 review rounds' QA gaps (falsy-host repair class, reparse-guard/shadowed-key proof, formatting preservation as a class incl. CRLF/tab/single-line/large-array, no .tmp residue, CLAUDE.md prose survival on both mutating branches, adapter-content class, dogfood payoff via the real loadConfig() pipeline) plus fixed AC1 (declared red, now asserts host key) and AC2 (was a green test whose "byte-for-byte unchanged" title was no longer generally true -- retitled + scoped, companion test added for the pre-E100 host-less re-run case). Ran the dogfood migration in this repo itself: .config.json gained host (git diff +1 line), CLAUDE.md bullet refreshed (1 line changed), agc check OK, payoff independently measured (52,749 -> 63,918 chars, +21.2%, confirming the review's 52,808->63,975/+21% claim to within session-variance). T-E101-02 verified: both backlog priority cells match scope_decision_why verbatim, git diff shows only the priority cell changed in each row, both rows still 7 pipes (E74/E88 trap clear) -- not re-done. One open item, non-blocking and out of QA's FAIL authority (architecture/correctness, code-reviewer's charter, already Round-3-APPROVED as accepted risk): R3-A symlinked CLAUDE.md is replaced not written-through -- pinned as a documented-current-behaviour regression test so a future change is deliberate, flagged for human/PM follow-up on whether a project-root CLAUDE.md symlink is a supported layout. Full detail: qa_reports/review_T-E100-02.md.

