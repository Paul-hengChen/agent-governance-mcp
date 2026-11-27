# Review — T-E466-01

covers: T-E466-01, T-E466-02, T-E466-03, T-E466-04, T-E466-05, T-E466-06, T-E466-07, T-E466-08, T-E466-09, T-E466-10, T-E466-11

## Round 1 — CHANGES_REQUESTED — by code-reviewer

### Summary
- Feature `e466-conductor` (ticket `docs/tickets/E466.md` S1–S9), lane e466, diff `e3a5f63b...c4421394`: the fourteenth prompt `conductor` (prompt-only), `content/skill-conductor.md`, `tools/conductor.ts` + `scripts/conductor.mjs` (open / close / wake / state / wave-done / check over a `ConductorDeps` seam), `integrator.relaunch` replacing one sentence in place in `content/skill-integrator.md`, docs, qa tests `test/e466-*.test.mjs` + fixtures, and five owned re-pins.
- Tests and implementation match every automatable scenario (S1–S8) and the architecture. The full suite is green: 5016/5019 pass, 0 fail, 3 skipped. Every expected-red entry is green and no test fails outside the manifest.
- Binding constraints hold: owned paths only, `tools/lane-launch.ts` untouched, `CLAUDE.md` 250 lines, integrator SOP 269 lines with only the one sentence replaced, no `scripts/conductor.mjs` call in the integrator SOP, no server/gate/error-code change, no tmux/background session, `dist/` matches a fresh build.
- One required finding: after this diff, `docs/install.md` still says "All 13 registered prompts" above a list of fourteen. `docs/architecture.md` line 18 says the same and is outside the lane's allowed paths. The cut's Copy / Strings never listed either count. Scenario (cut) defect → pm.
- Verdict: CHANGES_REQUESTED.

### AC Completeness
- AC S1 — implemented — `tools/registry.ts:1211-1216` (appended 14th entry, `prompt.description` verbatim), `prompts/conductor.ts:1-12`; `tw_switch_role` enum unchanged.
- AC S2 — implemented — `content/skill-conductor.md` byte-identical to `sop.conductor` (checked by extracting the block from the spec); no `tw_update_state` string.
- AC S3 — implemented — `tools/conductor.ts:247-294` (one `driver.open(launchCommand(primary,"integrator"))`, ready wait from the launcher's exported constants only, `sendText` slash line then `takeoverLine`), `:312-320` (close → `EXIT_LINE` to the recorded id only).
- AC S4 — implemented — `tools/conductor.ts:111-161` (state file `agc-conductor.json` in the realpath'd git common dir, version 1, a file that does not parse is refused and left as it is, tmp + rename writes).
- AC S5 — implemented — `tools/conductor.ts:345-402` (decision table rows 0–9, both facts evaluated with no short-circuit, reply in mailbox-watch block format with `hop: —`, order /exit → closeFinished → open, `done` after the last wave).
- AC S6 — implemented — `tools/conductor.ts:404-424` (`out.gone`, step `integrator-gone`, exit 1, `driver.open` never called).
- AC S7 — implemented — `content/skill-conductor.md` `## Usage limits`.
- AC S8 — implemented — `content/skill-integrator.md:107`: base text with exactly the two-moments sentence replaced by `integrator.relaunch`, byte-checked. Still 269 lines.
- AC S9 — device-or-person — the checklist `qa_reports/manual-verification_e466-conductor.md` is adequate. It covers integrator 1 closed after wave 1, integrator 2 opened with the take-over line, finished lane windows closed while `stopped — …` lanes keep theirs, the `all waves done` stop, plus optional gone and resume checks.
- Build contract Docs — implemented as cut — `CLAUDE.md` follows `claude.lines` exactly (250 lines). `README.md` has `readme.count` and `readme.row`. `docs/install.md` has `install.line`. `docs/config.md` has `config.conductor` after the `waveDoneAt` section's closing `---`, with that section byte-identical. **But see Correctness F1: the cut omitted two prompt-count facts this feature makes false.**

### Correctness
- **F1 — required (scenario defect → pm).** `docs/install.md:349` reads `All 13 registered prompts (\`tools/registry.ts\` → \`PROMPT_REGISTRY\`):`. This diff appends a fourteenth bullet under it (`docs/install.md:364`) and a fourteenth registry entry, so the sentence is false after the change. `docs/architecture.md:18` (`13 registered prompts (tools/registry.ts):`) is made stale by the same feature. It sits outside this lane's allowed paths. Precedent: when the thirteenth prompt landed, the lane updated both lines (commit `efe3f446`, "prompt and role counts 12 to 13"). This cut's Copy / Strings lists `readme.count` and `claude.lines` but no install or architecture count, so sr-engineer could not add either without an unlisted string (SOP 5a). Fix route:
  1. pm amends the cut with an `install.count` row (`All 14 registered prompts`).
  2. pm decides how `docs/architecture.md:18` gets fixed: either the integrator extends the out-of-bounds acceptance to that one line, or it is fixed after merge.
  3. sr-engineer applies the change.
- Tests (step 4 / 4a): every automatable scenario S1–S8 has one test with the exact title its `Verification:` line names. Each test runs against the public interface (`runConductorCli`, the real script for S4, `prompts/list` over stdio for S1, composed prompt text for S2/S7), and its assertions fail on a wrong outcome. Examples: exact `[text,newline]` pairs per `sendText`, decoy window untouched, event order /exit → closeFinished → open, untracked check via `git status --ignored`, a state file that does not parse left byte-identical. No loose assertions or internals tests found.
- Ad-hoc probe beyond the tests (temp repo, harness stand-ins). Every result matches the architecture's decision table and OQ1/OQ4/OQ7:
  - `open --record` → `fan-out <record>`, manifest null.
  - Reopen while the integrator is alive → refused.
  - A report naming a missing manifest → unmet `fact.report`.
  - First met report → manifest recorded, `接手 specs/…，開始第 2 波次` sent.
  - `wave-closed` resume → no fact seams run, close-finished run, `done`.
  - `wake` → `WAKE_LINE` to the recorded id.
- Coverage: line coverage is not measured by tooling here. Commands are exercised by S3–S6 plus the probe.

### Quality
- No findings in implementation code. Naming follows the launcher (`OUT` / `CONDUCTOR_OUT`, `§A–§F` sections). The ready-wait loop duplicates `startSession` (~15 lines) as the architecture's Decision Record sanctions, using only the launcher's exported constants.
- **Comment check (5d)**: `agc check — comments` gives 6 advisory warnings, all on qa-owned test headers: `test/e466-*.test.mjs` and `test/fixtures/e466/harness.mjs` long WHY blocks, plus a 33.4% comment ratio in `test/e466-integrator-sop.test.mjs`. Kept: the per-scenario WHY header is the repo's established qa-engineer test convention (for example `test/e443b-served-text.test.mjs`), and none is in shipped or served code. — optional to trim.
- recommended: no test exercises `open --record` followed by a first-wave `wave-done` that learns the manifest (OQ1), or `wake`. Both were verified by the probe above; no scenario requires them.

### Architecture
- No findings. `tools/conductor.ts` follows `specs/e466-conductor-architecture.md`:
  - It has the §A–§F seams and the `ConductorDeps` shape.
  - It imports from `tools/lane-launch.ts`, `tools/config.ts` and `tools/fanout-manifest.ts` without editing them.
  - `scripts/conductor.mjs` is the three-line wrapper with `script.header` verbatim.
- The OQ7 condition is kept. `open` refuses only while the step is `opening` / `integrator-open` and the window exists. The SOP keeps reopening after "integrator gone" on the human's word ("Continue only when the human says so.").

### Security
- No findings. Every child process uses `spawnSync` with argv arrays (no shell). A report's manifest must match `\S+`, must not be absolute, `..` or outside primary, and must be an existing file. That is the only report-derived text later typed into a terminal (`takeoverLine`). The PR number is digits only. The boundary argv cases in S3 (empty `--record`, `--wave 0` / `two`, extra flags, 100k-char argument) exit 2 with nothing opened. The state file is refused when it does not parse and is never overwritten. No secrets.

### Performance
- No findings. Each command does O(messages) mailbox parses and a constant number of child processes. Ready-wait polling is bounded by the launcher's `READY_TIMEOUT_MS`. Nothing touches a hot path, and there is no regression against base.

### Verdict
CHANGES_REQUESTED — the code and tests satisfy S1–S8, but the feature leaves the prompt count in `docs/install.md` (and `docs/architecture.md`) at 13 while fourteen prompts are registered, and the cut never sourced those count updates (scenario defect, pm).
