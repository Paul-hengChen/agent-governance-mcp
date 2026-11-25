# Tests — e424-per-scenario-acceptance (T-E424-02)

Author: qa-engineer. Spec `specs/e424-per-scenario-acceptance.md` (AC1–AC12, AC14; AC13 is T-E424-06),
architecture `specs/e424-per-scenario-acceptance-architecture.md` (Interface Contracts 1–7).

Placement branch (Constitution §2 *Conditional test writing*): no existing test file covers the ticket path;
the dispatch brief's `Test-file placement` line pre-authorises new `test/e424-*.test.mjs` files, so two new
files were created. No fixture files: tickets, specs and records are built inline per test in temp workspaces.
No existing test file was edited.

Files:
- `test/e424-per-scenario-acceptance.test.mjs` — one end-to-end test per AC, each driving `handleUpdateState`
  (file mode) with a `code-reviewer` `PASS` write, `completed_tasks: ["T01"]`, on a temp workspace whose other
  PASS gates are satisfied (same seed as `test/ac-execution.test.mjs` I1/I2). The acceptance record is the
  write's own `qa_review` text, which `QA_REVIEW_RECORD` appends to `qa_reports/review_T01.md` under a
  `## <ts> — PASS — by code-reviewer` heading before this step reads it, so the record's `## AC Execution Log`
  is the last H2 in that file.
- `test/e424-ac-execution-exports.test.mjs` — unit tests of the six new exports (architecture contracts 1–6),
  pinning OQ-1/OQ-3/OQ-5/OQ-6, DR-5/DR-6 and the full Copy `ac.ticket.order` render.

## Scenario → Test Map

| AC | test file | exact test name | state now |
|---|---|---|---|
| AC1 | `test/e424-per-scenario-acceptance.test.mjs` | `AC1: ticket with three blocking scenarios and a pass entry for each id -> PASS accepted` | green (see below) |
| AC2 | same | `AC2: pass entries for two of three ids -> rejected, the missing id named under ac.ticket.no_entry, recorded ids not named` | red |
| AC3 | same | `AC3: one of three entries marked fail -> rejected, that id named under ac.ticket.not_pass` | red |
| AC4 | same | `AC4: an added-during-build blocking scenario without an entry blocks PASS; with a pass entry the same write lands` | red |
| AC5 | same | `AC5: device-or-person never blocks — (a) accepted without its entry; (b) listed under ac.ticket.manual, not as missing` | red |
| AC6 | same | `AC6: no ## AC Execution Log at all — (a) no proof: line -> every blocking id under no_entry; (b) proof: line -> today's text alone` | red |
| AC7 | same | `AC7: cited ticket file missing or unparsable -> rejected (fail closed) with ac.ticket.missing_file / ac.ticket.parse` | red |
| AC8 | same | `AC8: no ticket citation -> today's behaviour byte-for-byte (proof: with/without heading, dormant, out-of-dir Ticket: line)` | green (non-regression) |
| AC9 | same | `AC9: the ticket check runs no scenario command and imports no child_process` | red |
| AC10 | same | `AC10: the ticket check sits inside the PASS_AC_EXECUTION_LOG step's FileHandoffStorage guard (SQLite dormant)` | red |
| AC11 | same | `AC11: GATE_REGISTRY stays 33, the pipeline stays 17 steps, and the tools/ticket-file.ts exports keep their shape` | green (non-regression) |
| AC12 | same | `AC12: skill-code-reviewer.md step 8 carries Copy sop.step8 verbatim and keeps the E433-pinned substrings` | red |
| AC13 | — | no test this round: `node scripts/test-lock.mjs -- npm test` exit 0 after T-E424-06 re-pins (judge runs it) | — |
| AC14 | `test/e424-per-scenario-acceptance.test.mjs` | `AC14: proof: + all-device-or-person ticket — no section rejects with today's text; section accepts; no proof: and no section accepts` | green (non-regression) |
| contracts 1–6 | `test/e424-ac-execution-exports.test.mjs` | `contract 1: …` … `contract 6: …` (10 tests, names in the manifest) | red |

Already-green AC tests, kept on purpose (SOP step 5: the behaviour already exists):
- **AC1** — today the step is dormant on a spec with a citation and no `proof:` line, so the PASS lands. The test
  becomes load-bearing once the ticket check exists (AC2–AC7 prove the same fixture is now evaluated).
- **AC8** — the no-ticket path must not change; it is green before and must stay green after.
- **AC11** — counts and ticket-file export shape are invariants of the cut.
- **AC14** — the additive rule says a cited ticket never relaxes today's `proof:` check; today nothing reads the
  citation, so all three cases already hold. It turns red only if the implementation makes the ticket path
  exclusive (DR-1's rejected alternative).

## Open Interface Details

Decided by qa-engineer, within the architecture contracts:
1. **Citation line in fixtures**: ``Ticket: `docs/tickets/e900.md` `` (default `ticketDir`, backtick form). The bare
   form and a configured `ticketDir` are covered at unit level (contract 2).
2. **Entry line in fixtures**: `- <id> — npm test -- x — exit 0 — pass|fail` (OQ-3 ruling shape).
3. **AC2 exact text**: asserted as prefix `⛔ AC_EXECUTION_LOG_MISSING: T01. ` + `ac.ticket.lead` (absolute spec
   path, repo-relative ticket path) + `ac.ticket.no_entry`, a regex for `Inspected: …review_T01.md…. Evidence
   schema: `, and suffix = `ac.ticket.hint` verbatim. The full byte-exact render, including the `Inspected:` empty
   fallback, is pinned in contract 6.
4. **AC6 (b) / AC14 (a) byte identity**: compared against the same write in a sibling workspace with the
   `Ticket:` line removed, after replacing each workspace path with `<WS>` (the spec path and the inspected
   review path embed the temp dir).
5. **AC7 parse fixture**: the three-scenario ticket with its `status:` line removed; the expected
   `{n}` / `{problem}` are taken from `parseTicketFile` on that same text, so the test pins the format, not the
   parser's wording.
6. **AC8 "byte-identical to base"**: the expected text is today's emit-site template reproduced literally in the
   test, with `hintStatic` read from `GATE_REGISTRY` (its literal is already pinned by
   `test/e448-judge-evidence-checks.test.mjs` and `test/e433-test-first-rules.test.mjs` AC9). On-disk state is
   compared between an accepted write with an out-of-dir `Ticket:` line and one without (timestamps masked).
   The telemetry sidecar line of the no-ticket rejection is compared between the out-of-dir-`Ticket:` write and
   the plain one (`ts` masked). No base sha is diffed (resident-test hygiene).
7. **AC9**: a `command touch <abs marker path>` scenario with no entry; the test asserts the rejection names it
   (so the ticket was read) and the marker does not exist; plus the source pin "no `child_process` in
   `gates/ac-execution.ts`".
8. **AC10**: source pin — inside the `PASS_AC_EXECUTION_LOG` step, an `evaluateTicketAcceptance(` call lies inside
   an open `if (storage instanceof FileHandoffStorage)` block (brace depth from that block's `{` stays > 0). This
   is the spec's alternative proof form; no SQLite end-to-end run.
9. **AC12**: step 8 must END with the Copy `sop.step8` replacement text, must no longer contain the old sentence
   `With a `proof:`-annotated AC and no such section`, keeps the four E433-pinned substrings, and, with the origin
   tag removed, contains no `specs/|gates/|tools/|docs/` path and no `E<digits>` id.
10. **Unit seam**: `test/e424-ac-execution-exports.test.mjs` imports `dist/gates/ac-execution.js` as a namespace, so
    a missing export fails each test individually rather than the whole file at link time.
11. **parseAcceptanceRecord expectations (contract 4)**: `- S4 — pass` (2 fields) is an entry (DR-6); `PASS` and
    `passed` are not pass; a lower-case `s1` is not `S1`; a hyphen or an un-spaced em dash is no separator; lines in
    a fence and a bare `- S8` are ignored.

## Red Reasons

- AC2, AC3, AC4, AC5, AC6, AC7, AC9 — the PASS write is accepted today: nothing reads the `Ticket:` citation
  (`evaluateTicketAcceptance` not built, T-E424-03/04).
- AC10 — `tools/handoff-orchestrator.ts` has no `evaluateTicketAcceptance(` call (T-E424-04).
- AC12 — `content/skill-code-reviewer.md` step 8 still ends with the old existence-only sentence (T-E424-05).
- contracts 1–6 (10 tests) — `AC_TICKET_HINT`, `findTicketCitations`, `sliceLastAcExecutionLog`,
  `parseAcceptanceRecord`, `evaluateTicketAcceptance`, `renderTicketAcceptanceRejection` are not exported from
  `dist/gates/ac-execution.js` yet (T-E424-03).

## CI Runnability

Both files run headlessly under `npm test` (temp workspaces under `os.tmpdir()`, no network, no prompts).

## Known red outside this manifest

`test/e118-reviewer-ac-completeness.test.mjs` AC7 (size cap 13190) turns red when T-E424-05 lands the step-8 text;
re-pinned in T-E424-06.
