# Tests — e430-mailbox-and-verify-rule (T-E430-01, T-E449-01)

Author: qa-engineer. Scenarios: the Acceptance Criteria AC1–AC6 of `specs/e430-mailbox-and-verify-rule.md` (no ticket file; `ticketDir` is not configured). AC7 is T-E449-03 (planned return) and has no test this hop.

Test-file placement: the dispatch brief's `Test-file placement` line pre-authorized one new `test/e430-<slug>.test.mjs` (AC1–AC4) and one new `test/e449-<slug>.test.mjs` (AC5–AC6); acted on that branch. No existing test file was edited; goldens, `test/context-budget.test.mjs` and `test/e410-task-alias-content-tail.test.mjs` untouched.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| AC1 | `test/e430-mailbox-outside-lane.test.mjs` | `AC1: integrator SOP Stage 4 has the Sessions-outside-a-lane block (C-IN2), relay bullet C-IN1, Watch bullet C-IN4; Stage 3 check 3 unchanged` |
| AC2 | `test/e430-mailbox-outside-lane.test.mjs` | `AC2: lane protocol §5 has the 非 lane 的 session block (C-LP1) after rule 6; finish sentence, eight ## lines and generic wording kept` |
| AC3 | `test/e430-mailbox-outside-lane.test.mjs` | `AC3: Take-over step 4 unchanged and directly followed by step 5 C-IN3; section still directly before ## Status (any time)` |
| AC4 | `test/e430-mailbox-outside-lane.test.mjs` | `AC4: every line the lane adds or changes in the integrator SOP cites no repo-only path, bare ticket id or gate code` |
| AC5 | `test/e449-verify-before-asserting.test.mjs` | `AC5: C-E449 appears exactly once in every composition, under §7 directly after Fail loud and before External-reference policy; other §7 lines unchanged` |
| AC6 | `test/e449-verify-before-asserting.test.mjs` | `AC6: the C-E449 line in the constitution cites no repo-only path, no bare ticket id and no digit` |
| AC7 | — | no test this hop: T-E449-03 (re-capture goldens, re-baseline caps, re-pin e410), then the spec's `proof:` commands |

## Open Interface Details

- **String constants are the spec verbatim.** `C_E449`, `C_IN1`–`C_IN4`, `C_LP1` were extracted mechanically from the spec's Copy / Strings table and fenced blocks (not retyped) and embedded as JSON string literals.
- **"Byte-unchanged" is pinned with frozen base lines**, not a base-sha diff (resident-test hygiene): `BASE_WATCH`, `BASE_MAILBOX_READY`, `BASE_TAKEOVER_STEP4` (integrator SOP at base) and `BASE_SEC7_BEFORE` / `BASE_EXTREF_FULL` / `BASE_EXTREF_LEAN` (§7 at base, rationale kept / stripped). The Watch bullet must equal `BASE_WATCH` with only the lanes-only sentence replaced by `C-IN4`.
- **Block placement**: the C-IN2 block is asserted as the exact line range from its heading to `## Stage 5` (= `C-IN2` + one blank line), preceded by one blank line and the `Condition 2 or 4 does not hold` paragraph; C-LP1 likewise between §5 rule 6 and `## 6. 收工回報格式`.
- **AC4 scan set** = every non-blank line of the `### Sessions outside a lane` block plus the lines holding `C-IN1`, `C-IN4` (the whole Watch line) and `C-IN3`, read as served (`stripRationale(stripOriginTags(...))` from `dist/prompts/build.js`), so the pre-existing origin-tagged id on the Watch line is not counted. Each set member must exist (anchor-drift guard, which is also the base red).
- **AC4/AC6 repo-only pattern**: the served-text pin's single `REPO_ONLY` regex (`test/e453-served-text-v5.test.mjs`); `<agc install>/…` passes its lookbehind natively, and `docs/lane-protocol.md` (shipped by agc) is removed from the line before matching, as the spec allows. Ticket id: `/\bE\d{2,}[a-z]?\b/` (spec). Gate codes: every `ALL_GATE_CODES` entry in backticks. File-wide: `npm test`, `this repo` (case-insensitive), `node scripts/` absent.
- **AC5 compositions (11)**: the 8 `buildPromptForRole` modes (lite/chain × design/non-design × fullDetail on/off, same workspace shape as `test/compose-equivalence.test.mjs`), the SessionStart hook's lite (default env) and full (`AGC_DEFAULT_SKILL=full`) output, and the raw 15-fragment concatenation. Per composition: one §7 heading in the whole output, `C-E449` exactly once in the whole output (also guards against a role-SOP copy, per ruling Q2 (a)), and the §7 line block equals `heading, blank, the five base bullets through Fail loud, C-E449, External-reference (variant), blank`. Rationale is kept in the fullDetail builds, both hooks and the concatenation; stripped in the four non-fullDetail builds (matches the base goldens).
- **AC6** scans the line as it sits in `content/const-15-core-tail.md` (what ships), and also requires it to equal `C-E449`.

## Red Reasons

- AC1: `### Sessions outside a lane heading: expected exactly one line, found 0` — C-IN2 not inserted yet.
- AC2: `### 非 lane 的 session heading: expected exactly one line, found 0` — C-LP1 not inserted yet.
- AC3: `step 4 is directly followed by step 5 reading C-IN3` — the line after step 4 is still blank.
- AC4: `### Sessions outside a lane heading: expected exactly one line, found 0` — no added lines to scan yet.
- AC5: `build lite non-design: C-E449 appears exactly once` (0 !== 1) — C-E449 not in const-15.
- AC6: `exactly one Verify before asserting line in the §7 fragment` (0 !== 1) — C-E449 not in const-15.

Validity probe: with the spec's six strings applied temporarily to `content/const-15-core-tail.md`, `content/skill-integrator.md` and `docs/lane-protocol.md`, all six tests passed (6/6); the three files were then restored from saved copies and `git status` showed no change to them.

## Suite

Full suite under `node scripts/test-lock.mjs -- npm test` after the commit: see the hand-off note for the counts. Expected: only the six tests above red. The reds that sr-engineer's content edits will add (11 compose goldens, 4 context-budget caps, 2 e410 line pins) are T-E449-03's, not listed here.

CI runnability: both files run headless under `node --test` with no network, no fixed sha and temp workspaces under `os.tmpdir()` that are removed in `finally`.
