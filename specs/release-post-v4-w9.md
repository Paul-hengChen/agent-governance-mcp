# release-post-v4-w9

## Problem Statement
`main` @ `c1ea80b` (PR #34 merge, equal to `origin/main`) is 34 commits past the `v4.11.0` tag (`c04af50`, `package.json` 4.11.0). The change set is post-v4 fan-out wave 9 (plan `specs/fanout-post-v4-w9.md`, closed 2026-10-19, wave PR #34), plus the v4.11.0 post-release bookkeeping (PR #32, merge `9205e84`) and the wave-9 plan PR (#33, merge `125b552`, the dispatch base). There are two lanes, merged `--no-ff` and conflict-free into `integ/post-v4-w9` in the order e226 → e351:
- **e226** (E226, E349, E350; merge `61acbc9`). E226/E349: `content/skill-integrator.md` gets a new *Tool calls* paragraph. Every agc tool call becomes `node <agc install>/scripts/<tool>.mjs`, and `agc …` falls back to `node <agc install>/bin/agc-init.mjs …`. Every `node scripts/verify-release.mjs --ci-check` call becomes "the repo's CI check", with a `gh run list --commit <sha>` fallback when no addendum names a command. The 5a evidence and new-findings rows gain an `artifacts: "local"` reading. Repo facts (shared generated artifacts, build, `dist/`, bookkeeping check, `this repo:` call forms) now point at the addendum, and the base-fix dependency audit points at Constitution §6. `docs/lane-protocol-addendum.md` §5 gains three lines (other agc tools' repo-relative call forms, this repo's CI check, the 5c bookkeeping check). The addendum's `## ` headings and every section other than §5 are unchanged. E350: the same call-form change in `content/skill-pm.md` (Manifest-Tier row plus the inline `<agc install>` definition), `content/const-08-chain-31-mid.md` (Constitution §3.1 manifest-tier condition 3) and `content/coord-03-core-fallback.md` (manifest-tier writer action and the feature-rollup call). Because const-08 and coord-03 are composed into bundles, QA regenerated seven compose goldens and re-baselined four `test/context-budget.test.mjs` caps. QA also re-pinned the owned SOP tests (`e178a`, `e285`, `e286`, `e292-integrator-sop`, `e295`, `e296`, `e329`) and added `test/e226-integrator-sop-portable.test.mjs`, `test/e349-integrator-repo-facts.test.mjs` and `test/e350-fanout-call-form.test.mjs`. Code review was round 1 CHANGES_REQUESTED, because the lane-wide expected-red list was missing (`qa_reports/expected-red_e226-integrator-sop-portable.txt` was added in reply), and round 2 APPROVED. QA PASSed in one round.
- **e351** (E351, E352; merge `e91c254`). Only `docs/lane-protocol.md` changes (+5/−1, `## ` headings unchanged). In §1, the fallback when `agc` is not on PATH becomes `node <agc 安裝位置>/bin/agc-init.mjs`, and the addendum may override it. §3 gets three `artifacts: local` lines that name E196 and E217 as known gaps. §4 gets one `artifacts: local` line. QA added `test/e351-lane-protocol-gaps.test.mjs`. Code review APPROVED and QA PASS, each in one round.

These paths are untouched since `v4.11.0`: `package.json`, `package-lock.json`, `index.ts`, `dist/**`, `tools/`, `gates/`, `schema/`, `scripts/`, `bin/`, `prompts/`, `templates/`, `guards/`, `transport/`, `lib/`, `.github/`, `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `.current/.config.json`, `docs/config.md`, and every `content/` file except the four named above. `GATE_REGISTRY` stays at 34 entries and no schema version changes (`CURRENT_VERSIONS` = handoff 15, tasks 2, sqlite 2, config 2). This release is content-only: it changes constitution text (const-08), the coordinator SOP (coord-03), the PM and integrator SOPs, and the lane rules. No compiled code changes.

The manifest records these accepted exceptions (結案), carried as context and not re-litigated:
1. Both lanes' PMs wrote `next_role=sr-engineer` before the cut pre-review. The integrator caught this, and no build ran before approval.
2. The e226 PM hand-edited five task descriptions in `.current/e226/tasks.md` (the E340 gap; no checkbox changed).
3. sr and code-reviewer were both opus in both lanes (same-model note in the reviews), and qa ran on the default sonnet.
4. The e226 sr ran the full suite once without the test lock. QA re-ran the final full suite under the lock.

Nobody has yet confirmed that the two lanes' evidence still holds on the committed `main` tree as a whole. This is an evidence-only release gate, and no code is written here.

**Version: decided by the human — v4.12.0 MINOR.** QA verifies against the CURRENT version 4.11.0. Release-engineer owns the bump to 4.12.0, the CHANGELOG entry, the three `agc-version` stamps, `agc check` at the new version, the `release/*` PR (main is protected), the tag and GitHub release, and evidence archiving.

## User Stories
- As release-engineer, I want a QA PASS before I ship v4.12.0, so that I do not have to re-check closed lane work. The PASS confirms that:
  - each wave-9 lane's evidence is present and green on main;
  - the suite, build, audit, version and CI checks (Node 20 and 22) are green;
  - the built prompt bundles carry the new call forms: the constitution's manifest-tier condition 3, the coordinator's writer action and roll-up call, the PM Manifest-Tier row, and the integrator SOP's *Tool calls*, CI-check, `artifacts: "local"` and Constitution §6 wording. No repo-relative `node scripts/` call is left in the integrator SOP, and the goldens and budget caps match the shipped text;
  - the lane rules (E351/E352) and addendum (E349) changes are as specified, and render still points lanes at both files without leaking either;
  - v4.11.0 behaviour is unregressed.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.11.0`, when the diff is classified, then every changed path belongs to one of the classes below. These paths must not appear: `package.json`, `package-lock.json`, `tsconfig*`, `index.ts`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `README.md`, `dist/`, `tools/`, `schema/`, `guards/`, `gates/`, `transport/`, `lib/`, `prompts/`, `templates/`, `bin/`, `scripts/`, `.github/`, `.current/.config.json`, `docs/config.md`, `docs/schema-versions.md`, `docs/integrator-revision-2026-10-08.md`, the lite goldens (`test/fixtures/compose-golden/build-lite-*.txt`, `hook-lite.txt`), `test/e290-lane-protocol-generic.test.mjs`, `test/e294-lane-enterworktree.test.mjs`, `test/e288-integrator-stage0.test.mjs`, `test/e297-main-protected-sop.test.mjs`, `test/e336-portable-pull.test.mjs`, `test/e130-lane-default.test.mjs`, `test/e177a-manifest.test.mjs`, `test/e246-mailbox-teardown.test.mjs`, `test/e289-config-key.test.mjs`, `test/e289-render-addendum.test.mjs` and `test/skill-frontmatter.test.mjs`. Under `content/`, only the four e226 files may change. The classes:
  - **e226** (E226/E349/E350): `content/skill-integrator.md`, `content/skill-pm.md`, `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md`, `docs/lane-protocol-addendum.md`, the seven goldens `test/fixtures/compose-golden/{build-full-design-fd,build-full-design,build-full-nondesign-fd,build-full-nondesign,constitution-monolith,hook-full,skill-coordinator-monolith}.txt`, `test/context-budget.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e285-integrator-session-handoff.test.mjs`, `test/e286-integrator-trust-and-git.test.mjs`, `test/e292-integrator-sop.test.mjs`, `test/e295-hop-cap-and-sop-halves.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e329-integrator-sop-followups.test.mjs`, `test/e226-integrator-sop-portable.test.mjs` (new), `test/e349-integrator-repo-facts.test.mjs` (new), `test/e350-fanout-call-form.test.mjs` (new), `specs/e226-*`.
  - **e351** (E351/E352): `docs/lane-protocol.md`, `test/e351-lane-protocol-gaps.test.mjs` (new), `specs/e351-*`.
  - **Lane evidence**: `qa_reports/review_T-E{226,349,350,351}-0*.md`, `qa_reports/expected-red_e226-integrator-sop-portable.txt`, `review_reports/review_T-E{226,349,350,351}-0*.md`.
  - **Bookkeeping**: this covers the v4.11.0 post-release PR #32 and the wave-9 plan PR #33. The paths are `specs/fanout-post-v4-w9.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `tasks.md`, `.current/_primary/**` and `.current/history/2026-10/{e226,e351}/**`.

  Any path outside these classes is a finding to report. Cross-check: `owners` attributes every non-bookkeeping wave path to the lane named here (AC8 (b)).
  proof: `git diff --name-only v4.11.0..HEAD`; `git log --oneline v4.11.0..HEAD` (expect 34 commits); `git diff --name-only v4.11.0..HEAD -- package.json package-lock.json 'tsconfig*' index.ts CHANGELOG.md CLAUDE.md AGENTS.md .antigravityrules README.md dist tools schema guards gates transport lib prompts templates bin scripts .github .current/.config.json docs/config.md docs/schema-versions.md docs/integrator-revision-2026-10-08.md 'test/fixtures/compose-golden/build-lite-*' test/fixtures/compose-golden/hook-lite.txt test/e290-lane-protocol-generic.test.mjs test/e294-lane-enterworktree.test.mjs test/e288-integrator-stage0.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs test/e130-lane-default.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e289-config-key.test.mjs test/e289-render-addendum.test.mjs test/skill-frontmatter.test.mjs` (expect empty); `git diff --name-only v4.11.0..HEAD -- content test/fixtures` (expect only the four `content/` files and the seven goldens above).

- **AC2** — Given the two lane features, when each lane's evidence is checked on the committed main tree, then each lane has the code-reviewer APPROVED and qa PASS records named below. Each `.current/history/2026-10/<lane>/handoff.md` reads `status: "PASS"` and `last_agent: "qa-engineer"`. The latest verdict in each file governs: an earlier CHANGES_REQUESTED or FAIL round closed by a later APPROVED or PASS is not a failure. Lanes and features:
  - **e226** `e226-integrator-sop-portable` (T-E226-01..05, T-E349-01/02, T-E350-01..03). QA: `qa_reports/review_T-E226-05.md` (its `covers:` line names all ten ids), plus `review_T-E226-0{1,2,3,4}.md`, `review_T-E349-0{1,2}.md` and `review_T-E350-0{1,2,3}.md`, each with one PASS block. Review: `review_reports/review_T-E226-01.md`, `review_T-E226-02.md`, `review_T-E349-01.md` and `review_T-E350-01.md` (each round 1 CHANGES_REQUESTED, then round 2 APPROVED, which governs). The expected-red list `qa_reports/expected-red_e226-integrator-sop-portable.txt` exists.
  - **e351** `e351-lane-protocol-gaps` (T-E351-01/02). QA: `qa_reports/review_T-E351-01.md` (`covers: T-E351-01, T-E351-02`, PASS) and `qa_reports/review_T-E351-02.md` (PASS). Review: `review_reports/review_T-E351-01.md` (APPROVED).

  Each lane ledger `.current/history/2026-10/<lane>/tasks.md` shows every row `[x]` (10 for e226, 2 for e351). Each backlog row for E226, E349 and E350 reads DONE and names merge `61acbc9`, and each row for E351 and E352 reads DONE and names `e91c254`. `61acbc9`, `e91c254`, `125b552` and `9205e84` are ancestors of HEAD. Backlog rows E354–E357 exist (numbered, not DONE).
  proof: `grep -n -E '^- Verdict:|^## Verdict' review_reports/review_T-E{226,349,350,351}-0*.md`; `grep -n -E '^covers:|^## .*— (PASS|FAIL) —' qa_reports/review_T-E{226,349,350,351}-0*.md`; `ls qa_reports/expected-red_e226-integrator-sop-portable.txt`; `grep -E '^(active_feature|status|last_agent):' .current/history/2026-10/e{226,351}/handoff.md`; `grep -E '^- \[' .current/history/2026-10/e{226,351}/tasks.md | cut -c1-40`; `grep -n -E '^\| (E226|E349|E350|E351|E352|E354|E355|E356|E357) ' docs/backlog.md | cut -c1-200`; `git merge-base --is-ancestor 61acbc9 HEAD && git merge-base --is-ancestor e91c254 HEAD && git merge-base --is-ancestor 125b552 HEAD && git merge-base --is-ancestor 9205e84 HEAD; echo exit=$?` (expect `exit=0`).

- **AC3** — Given the committed HEAD tree, when the full test suite runs under the test lock (local Node 22), then it exits 0 with zero failures, and the tally (total/pass/skipped) is reported. For reference, e226 recorded 3568/3566 (2 skipped) on `26d1a44` and e351 recorded 3565/3563 (2 skipped) on `b89dd19`, each on its own lane HEAD. A red in a test the backlog already lists as load-sensitive is rerun once (single file, then full suite) and is not a gate failure. That list is the E238/E254/E278 family, `test/e132-lane-registry.test.mjs` gap-7 (E348), and the timing flakes earlier waves recorded under host load. Any other red is a failure, including `test/e234-hygiene-scan.test.mjs`, which scans tracked files.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the tally and `node --version`).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt, then committed `dist/` is byte-identical to a fresh build. `scripts/check-version.mjs` passes against the CURRENT version (4.11.0; the bump belongs to release-engineer). `npm run check:bookkeeping` and `npm run check:md-tables` exit 0.
  proof: `npm run build && git status --porcelain dist/` (expect empty); `node scripts/check-version.mjs; echo exit=$?`; `npm run check:bookkeeping; echo exit=$?`; `npm run check:md-tables; echo exit=$?`.

- **AC5** — Given the dependency set, when audited, then `npm audit --audit-level=high` exits 0 (counts reported), and `package.json` and `package-lock.json` are byte-identical to `v4.11.0`.
  proof: `npm audit --audit-level=high; echo exit=$?`; `git diff --stat v4.11.0..HEAD -- package.json package-lock.json` (expect empty).

- **AC6** — Given the `agc check`-class checks, when run on HEAD, then they pass. `agc check` exits 0 at the CURRENT 4.11.0 stamps in `CLAUDE.md`, `AGENTS.md` and `.antigravityrules` (the 4.12.0 stamps belong to release-engineer). `node scripts/check-transitions-sync.mjs` passes.
  proof: `node bin/agc-init.mjs check; echo exit=$?`; `node scripts/check-transitions-sync.mjs; echo exit=$?`.

- **AC7** (Node 20 verdict rests on CI) — Given local is Node 22 and CI runs Node 20 + 22, when the CI record is read, then five runs each concluded `success` with jobs `test (20)` and `test (22)` both `success`:
  - the `main` push run `39248384039` on HEAD (`c1ea80b`);
  - the integration-branch push run `39247223059` on the PR #34 head `4490696`;
  - the integration run `39246553167` on `e91c254`, which the manifest's 結案 cites;
  - the lane runs `39246128505` (e226 head `c1c9132`) and `39239867881` (e351 head `436f189`), which the manifest's 5a rows cite.

  QA does not run the suite under Node 20 locally: the shared `node_modules` is built for Node 22, so a local Node 20 run fails the SQLite tests for environment reasons.
  proof: `git rev-parse HEAD` (expect `c1ea80b…`); `for r in 39248384039 39247223059 39246553167 39246128505 39239867881; do gh run view $r --json headSha,conclusion,jobs --jq '.headSha, .conclusion, (.jobs[] | .name + " " + .conclusion)'; done` (expect each run `success`, `test (20) success`, `test (22) success`; head shas `c1ea80b…`, `4490696…`, `e91c254…`, `c1c9132…`, `436f189…`).

- **AC8** — Given the closed wave-9 manifest and the unchanged fanout tool, when the read-only commands run on the compiled output, then:
  - (a) Hard condition: across every `specs/fanout-*.md`, validate exits 0 except `fanout-wave5.1.md` and `fanout-wave6.md`. Those two exit 2 with exactly `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`, unchanged since `v4.11.0`. The closed wave-9 manifest validates (`fanout: ok — 2 dispatchable lane(s), 0 provisional, 10 decision(s)`).
  - (b) `owners specs/fanout-post-v4-w9.md --range v4.11.0...HEAD` exits 1. Its summary reads `fanout owners: 61 path(s), 45 hit(s), 2 dispatchable lane(s)`, with 39 HIT lines for e226 and 6 for e351. The HIT lines attribute `content/skill-integrator.md`, `content/skill-pm.md`, `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md` and `docs/lane-protocol-addendum.md` to e226, and `docs/lane-protocol.md` to e351. The 16 non-HIT paths are all in AC1's Bookkeeping class.
  - (c) `handoff specs/fanout-post-v4-w9.md --closing` exits 0 and prints a `## 接手步驟` section with the four `###` sub-items (`核對 primary`, `已結案`, `待人類決定`, `進行中的背景工作`).
  - (d) `handoff --check specs/fanout-post-v4-w9.md` ends with a `fanout handoff --check: 5 fact(s) checked, …` summary and exits 0 or 1. `MOVED` lines are acceptable. Any `DIFF` line names only `git status` or `lane-status`, and is explained by this release feature's own uncommitted bookkeeping (this spec, `.current/_primary/*`, `qa_reports/`) or by its new `active_feature`.
  - (e) The generic usage (no subcommand) exits 2 and has exactly 5 lines starting `       node scripts/fanout.mjs` (`scripts/fanout.mjs` and `tools/fanout-*.ts` are unchanged since `v4.11.0`; E345 and the `## 接手步驟` call-form text are out of this wave).

    All of these runs write nothing (`git status --porcelain` unchanged across them) and print no stack trace.
  - (f) The fanout regression and hard-condition tests pass unchanged.
  proof:
  - (a) `for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f" >/dev/null 2>"$TMPDIR/v.err"; e=$?; [ $e -ne 0 ] && echo "$f exit=$e $(grep -o -E 'error: [A-Z_]+' "$TMPDIR/v.err" | sort -u | tr '\n' ' ')"; done` (expect only the two lines for wave5.1 and wave6); `node scripts/fanout.mjs validate specs/fanout-post-v4-w9.md; echo exit=$?`.
  - (b)–(e) `git status --porcelain > "$TMPDIR/s0"`; `node scripts/fanout.mjs owners specs/fanout-post-v4-w9.md --range v4.11.0...HEAD > "$TMPDIR/own.txt"; echo exit=$?; grep '^fanout owners' "$TMPDIR/own.txt"; grep '^HIT' "$TMPDIR/own.txt" | grep -o -E '\((e226|e351):' | sort | uniq -c; grep -E '^HIT  (content/(skill-integrator|skill-pm|const-08-chain-31-mid|coord-03-core-fallback)\.md|docs/lane-protocol(-addendum)?\.md) ' "$TMPDIR/own.txt"`; `node scripts/fanout.mjs handoff specs/fanout-post-v4-w9.md --closing > "$TMPDIR/h.txt"; echo exit=$?; grep -E '^##|^###' "$TMPDIR/h.txt"`; `node scripts/fanout.mjs handoff --check specs/fanout-post-v4-w9.md; echo exit=$?`; `node scripts/fanout.mjs 2>&1 | grep -c '^       node scripts/fanout.mjs'` (expect 5); `git status --porcelain | diff "$TMPDIR/s0" - && echo unchanged`.
  - (f) `node --test test/e177a-manifest.test.mjs test/e177a-check-cli.test.mjs test/e283-validate-handoff.test.mjs test/e284-fanout-handoff.test.mjs test/e289-render-addendum.test.mjs test/e292-external-deps-validate.test.mjs test/e292-handoff-sister-sha.test.mjs test/e343-render-pointer-guard.test.mjs test/e322-owners.test.mjs test/e331-git-diff-failure.test.mjs test/e332-absolute-path-boundaries.test.mjs test/e316-cut-heading-variants.test.mjs test/e337-subitem-order.test.mjs test/e338-backtick-glob.test.mjs test/e339-non-ascii-manifest.test.mjs test/e178b-fanout-unmatched.test.mjs test/e177b-lane-status.test.mjs test/e177b-mailbox-watch.test.mjs test/e178b-lane-watch.test.mjs`.

- **AC9** — Given E350 changes constitution and coordinator text that is composed into bundles, when the built bundles, goldens and budget caps are checked, then:
  - (a) Source: `grep -l 'node scripts/' content/*.md` names only `content/skill-release-engineer.md`, which is unchanged since `v4.11.0` and out of scope. `content/const-08-chain-31-mid.md` holds `node <agc install>/scripts/fanout.mjs check --cut` once. `content/coord-03-core-fallback.md` holds `node <agc install>/scripts/` twice (feature-rollup and fanout check --cut). `content/skill-pm.md` holds `<agc install>` twice (call form plus the inline definition).
  - (b) Built bundles from `dist/prompts/build.js` `buildPromptForRole`, counted per role:
    - `skill-pm.md`: four counts `1 1 1 0`. These are const-08 condition 3 `` (3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0 ``, the PM row call form, the PM inline definition, and `node scripts/`.
    - `skill-coordinator.md`: four counts `1 1 2 0`. These are condition 3, `` `node <agc install>/scripts/feature-rollup.mjs <feature>` ``, `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` (condition 3 plus the coord-03 writer action), and `node scripts/`.
    - `skill-sr-engineer.md`: two counts `1 0` (condition 3 and `node scripts/`), which shows the constitution change reaches a non-coordinator chain bundle.
  - (c) Goldens: exactly the seven goldens in AC1 changed. Their word-diff since `v4.11.0` consists only of 7 `scripts/fanout.mjs` → `<agc install>/scripts/fanout.mjs` swaps and 1 `scripts/feature-rollup.mjs` → `<agc install>/scripts/feature-rollup.mjs` swap. No golden holds `node scripts/fanout.mjs` or `node scripts/feature-rollup.mjs`. The five lite goldens are unchanged.
  - (d) Budget: the `test/context-budget.test.mjs` diff since `v4.11.0` is `14 10`, and it re-baselines exactly four caps to the values recorded by the e226 lane: skill-pm 4823 → 4849, design-arm constitution 10523 → 10527, teamwork bundle 21633 → 21644, non-design constitution 8426 → 8429.
  - (e) The composition, golden and budget tests pass: `context-budget`, `compose-equivalence`, `e90-golden-capture-completeness`, `skill-manifest`, `e350-fanout-call-form`, `e296-manifest-tier`, `skill-frontmatter`, `prompt-state-footer`, `render-structure`, `constitution-deliverable-guard`, `agc-adapters`.
  proof: `grep -l 'node scripts/' content/*.md` (expect only `content/skill-release-engineer.md`); `git diff --stat v4.11.0..HEAD -- content/skill-release-engineer.md` (expect empty); `grep -o -F 'node <agc install>/scripts/fanout.mjs check --cut' content/const-08-chain-31-mid.md | wc -l; grep -o -F 'node <agc install>/scripts/' content/coord-03-core-fallback.md | wc -l; grep -o -F '<agc install>' content/skill-pm.md | wc -l` (expect 1, 2, 2); then the bundle probe below (expect `pm 1 1 1 0`, `coordinator 1 1 2 0`, `sr-engineer 1 0`); `git diff --word-diff=porcelain v4.11.0..HEAD -- test/fixtures/compose-golden/ | grep -E '^[-+]' | grep -v -E '^(\+\+\+|---)' | sort | uniq -c` (expect exactly `7 -scripts/fanout.mjs`, `1 -scripts/feature-rollup.mjs`, `7 +<agc install>/scripts/fanout.mjs`, `1 +<agc install>/scripts/feature-rollup.mjs`); `grep -l -F -e 'node scripts/fanout.mjs' -e 'node scripts/feature-rollup.mjs' test/fixtures/compose-golden/*.txt` (expect none); `git diff --numstat v4.11.0..HEAD -- test/context-budget.test.mjs` (expect `14 10`); `grep -n -E '<= (4849|10527|21644|8429)\b' test/context-budget.test.mjs`; `node --test test/context-budget.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/skill-manifest.test.mjs test/e350-fanout-call-form.test.mjs test/e296-manifest-tier.test.mjs test/skill-frontmatter.test.mjs test/prompt-state-footer.test.mjs test/render-structure.test.mjs test/constitution-deliverable-guard.test.mjs test/agc-adapters.test.mjs`.

    Bundle probe (run from the repo root):
    ```sh
    node --input-type=module <<'EOF'
    const b = await import(process.cwd() + '/dist/prompts/build.js');
    const t = r => b.buildPromptForRole(r, 'x', process.cwd()).messages.map(m => m.content.text).join('\n');
    const c = (s, n) => s.split(n).length - 1;
    const P = t('skill-pm.md'), C = t('skill-coordinator.md'), S = t('skill-sr-engineer.md');
    const cond3 = '(3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0';
    console.log('pm', [cond3, '`node <agc install>/scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md`', "(`<agc install>` = agc's install directory; the repo addendum may give its own call form)", 'node scripts/'].map(n => c(P, n)).join(' '));
    console.log('coordinator', [cond3, '`node <agc install>/scripts/feature-rollup.mjs <feature>`', 'node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>', 'node scripts/'].map(n => c(C, n)).join(' '));
    console.log('sr-engineer', [cond3, 'node scripts/'].map(n => c(S, n)).join(' '));
    EOF
    ```

- **AC10** — Given the E351/E352 lane-rules change and the E349 addendum change, when the docs and the render output are checked, then:
  - (a) `docs/lane-protocol.md`: its `## ` heading lines are byte-identical to `v4.11.0` (eight headings). Its diff since `v4.11.0` is `5 1`. It holds `node <agc 安裝位置>/bin/agc-init.mjs` exactly once (§1), `artifacts: local` exactly twice (zero at `v4.11.0`; §3 and §4), and exactly one line naming both E196 and E217.
  - (b) The E290 generic-rules invariant still holds: none of these strings occurs in `docs/lane-protocol.md`: `node bin/agc-init.mjs`, `npm run build`, `rm node_modules`, `dist/`, `tasks-index-receipt.json`, `check-md-tables`, `test/e130-lane-default.test.mjs`, `NEW-TICKETS.md`, `node scripts/fanout.mjs`, `註解 proof`, `compose-golden`, `context-budget`, `content/**`, `test/`.
  - (c) `docs/lane-protocol-addendum.md`: its six `## ` headings are byte-identical to `v4.11.0`. Its diff since `v4.11.0` is `3 0`. Everything outside `## §5` is byte-identical to `v4.11.0` (`## §7` unchanged). `## §5` holds `node scripts/verify-release.mjs --ci-check --sha <sha>`, `npm run check:bookkeeping` and `node scripts/test-lock.mjs -- npm test`.
  - (d) Two-layer render from primary with this repo's config: `render specs/fanout-post-v4-w9.md e351 --summary x --reading y --base 125b552` exits 0. Its reading line starts `先完整讀 docs/lane-protocol.md` and also names `docs/lane-protocol-addendum.md`, both relative. The line directly after it starts `` `feature start` 建好 worktree 之後，呼叫 `EnterWorktree` ``.
  - (e) Leak check: no line of `docs/lane-protocol.md` or `docs/lane-protocol-addendum.md` that is longer than 20 characters after trimming occurs in that rendered prompt.
  - (f) The E351 test and every test that reads the lane rules pass: `e351-lane-protocol-gaps`, `e349-integrator-repo-facts` (addendum §5), and the unedited `e290`, `e294`, `e130-lane-default`, `e177a`, `e177b-mailbox-watch`, `e246`, `e289-config-key`, `e289-render-addendum`, `e342`, `e343`. The lane-rule assertions in `e178a`, `e286`, `e295`, `e296` and `e329` run under AC11 (c).
  proof: `diff <(git show v4.11.0:docs/lane-protocol.md | grep '^## ') <(grep '^## ' docs/lane-protocol.md) && echo headings-same`; `git diff --numstat v4.11.0..HEAD -- docs/lane-protocol.md docs/lane-protocol-addendum.md` (expect `5 1` and `3 0`); `grep -c -F 'node <agc 安裝位置>/bin/agc-init.mjs' docs/lane-protocol.md; grep -c -F 'artifacts: local' docs/lane-protocol.md; git show v4.11.0:docs/lane-protocol.md | grep -c -F 'artifacts: local'; grep -c -E 'E196.*E217' docs/lane-protocol.md` (expect 1, 2, 0, 1); `for s in 'node bin/agc-init.mjs' 'npm run build' 'rm node_modules' 'dist/' 'tasks-index-receipt.json' 'check-md-tables' 'test/e130-lane-default.test.mjs' 'NEW-TICKETS.md' 'node scripts/fanout.mjs' '註解 proof' 'compose-golden' 'context-budget' 'content/**' 'test/'; do printf '%s ' "$(grep -c -F -- "$s" docs/lane-protocol.md)"; done; echo` (expect fourteen `0`); `diff <(git show v4.11.0:docs/lane-protocol-addendum.md | grep '^## ') <(grep '^## ' docs/lane-protocol-addendum.md) && echo addendum-headings-same`; `diff <(git show v4.11.0:docs/lane-protocol-addendum.md | awk '/^## §5/{s=1} /^## §7/{s=0} !s') <(awk '/^## §5/{s=1} /^## §7/{s=0} !s' docs/lane-protocol-addendum.md) && echo outside-s5-same`; `awk '/^## §5/{s=1} /^## §7/{s=0} s' docs/lane-protocol-addendum.md | grep -c -F -e 'node scripts/verify-release.mjs --ci-check --sha <sha>' -e 'npm run check:bookkeeping' -e 'node scripts/test-lock.mjs -- npm test'` (expect 3); `node scripts/fanout.mjs render specs/fanout-post-v4-w9.md e351 --summary x --reading y --base 125b552 > "$TMPDIR/r9.txt"; echo exit=$?; grep -n -E '^先完整讀 docs/lane-protocol\.md|^.feature start. 建好 worktree 之後' "$TMPDIR/r9.txt" | cut -c1-120` (expect two consecutive line numbers, the first naming `docs/lane-protocol-addendum.md`); `cat docs/lane-protocol.md docs/lane-protocol-addendum.md | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | awk 'length($0)>20' | while IFS= read -r l; do grep -F -q -- "$l" "$TMPDIR/r9.txt" && echo "LEAK: $l"; done; echo leak-check-done` (expect no `LEAK:` line); `node --test test/e351-lane-protocol-gaps.test.mjs test/e349-integrator-repo-facts.test.mjs test/e290-lane-protocol-generic.test.mjs test/e294-lane-enterworktree.test.mjs test/e130-lane-default.test.mjs test/e177a-manifest.test.mjs test/e177b-mailbox-watch.test.mjs test/e246-mailbox-teardown.test.mjs test/e289-config-key.test.mjs test/e289-render-addendum.test.mjs test/e342-config-doc-wording.test.mjs test/e343-render-pointer-guard.test.mjs`.

- **AC11** — Given the E226/E349 integrator SOP changes and the `v4.11.0` shipped behaviour, when the built bundle and the current tree are checked, then:
  - (a) In `buildPromptForRole('skill-integrator.md', …)` output (from `dist/prompts/build.js`), each of these occurs exactly once:
    - ``**Tool calls**: agc's tools are written `node <agc install>/scripts/<tool>.mjs` ``;
    - `` `agc …` is `node <agc install>/bin/agc-init.mjs …` when `agc` is not on PATH ``;
    - `` `gh run list --commit <sha>`, then `gh run view <run id>` ``;
    - `Constitution §6 requires`;
    - `` under `artifacts: "local"` the evidence paths are excluded from the branch ``;
    - `` under `artifacts: "local"` read `<worktree>/.current/<lane>/pending-tickets.md` instead ``;
    - `(the repo addendum lists them)`.

    In the same bundle, `node scripts/`, `verify-release.mjs` and `(this repo:` occur zero times. In `content/skill-integrator.md` itself, `node scripts/`, `verify-release`, `npm run build`, `npm run check:bookkeeping` and `this repo:` each occur zero times, `<agc install>` occurs 28 times, and `the repo's CI check` occurs 6 times.
  - (b) Re-pin sizes since `v4.11.0` (`git diff --numstat`, added/removed): `e178a` 4/4, `e285` 1/1, `e286` 3/3, `e292-integrator-sop` 3/3, `e295` 7/5, `e296` 2/2, `e329` 2/2. `e288`, `e297` and `e336` are unedited (AC1).
  - (c) The integrator-SOP and content-pin tests pass: `e226-integrator-sop-portable`, `e349-integrator-repo-facts`, `e350-fanout-call-form`, `e178a`, `e285`, `e286`, `e288`, `e292-integrator-sop`, `e295`, `e296`, `e297`, `e329`, `e336`, `skill-frontmatter`.
  - (d) v4.11.0 non-regression: the `v4.11.0` tag resolves to `c04af50` and is an ancestor of HEAD, and `CHANGELOG.md` has the `[4.11.0]` entry. `HOP_CAP` is 14, `GATE_REGISTRY` has 34 entries, and `CURRENT_VERSIONS` is `{"handoff":15,"tasks":2,"sqlite":2,"config":2}`. The v4.11.0 behaviour tests pass (E292 sister repos and external deps, E343, E342, E290; run under AC8 (f) and AC10 (f), plus `e292-config-sister-repos` below), and so do the governance-core tests.
  proof: the integrator probe below (expect `1 1 1 1 1 1 1 0 0 0`); `for s in 'node scripts/' 'verify-release' 'npm run build' 'npm run check:bookkeeping' 'this repo:'; do printf '%s ' "$(grep -c -F -- "$s" content/skill-integrator.md)"; done; echo` (expect five `0`); `grep -o -F '<agc install>' content/skill-integrator.md | wc -l` (expect 28); `grep -o -F "the repo's CI check" content/skill-integrator.md | wc -l` (expect 6); `git diff --numstat v4.11.0..HEAD -- test/e178a-integrator-role.test.mjs test/e285-integrator-session-handoff.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e292-integrator-sop.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e329-integrator-sop-followups.test.mjs`; `node --test test/e226-integrator-sop-portable.test.mjs test/e349-integrator-repo-facts.test.mjs test/e350-fanout-call-form.test.mjs test/e178a-integrator-role.test.mjs test/e285-integrator-session-handoff.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e288-integrator-stage0.test.mjs test/e292-integrator-sop.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e297-main-protected-sop.test.mjs test/e329-integrator-sop-followups.test.mjs test/e336-portable-pull.test.mjs test/skill-frontmatter.test.mjs`; `git rev-parse v4.11.0^{commit}` (expect `c04af500814b8a5e32c89848feafa75c23c845a0`); `git merge-base --is-ancestor v4.11.0 HEAD; echo exit=$?`; `grep -n '\[4.11.0\]' CHANGELOG.md`; `grep -n 'const HOP_CAP = 14' tools/transitions.ts`; `node --input-type=module -e "import {GATE_REGISTRY} from './dist/gates/registry.js'; import {CURRENT_VERSIONS} from './dist/schema/versions.js'; console.log(Object.keys(GATE_REGISTRY).length, JSON.stringify(CURRENT_VERSIONS))"` (expect `34 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`); `node --test test/e292-config-sister-repos.test.mjs test/e324-zod-telemetry-under-current.test.mjs test/e325-drift-version-peek-race.test.mjs test/e326-empty-branch-run-poll.test.mjs test/verify-release.test.mjs test/e320-ci-check-sha.test.mjs test/hop-count-transitions.test.mjs test/dispatch-pins.test.mjs test/e308-single-source-tier-enum.test.mjs test/error-code-contract.test.mjs test/e35-pipeline-order.test.mjs test/e299-check-bookkeeping.test.mjs test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs test/e234-hygiene-scan.test.mjs`.

    Integrator probe (run from the repo root):
    ```sh
    node --input-type=module <<'EOF'
    const b = await import(process.cwd() + '/dist/prompts/build.js');
    const I = b.buildPromptForRole('skill-integrator.md', 'x', process.cwd()).messages.map(m => m.content.text).join('\n');
    const c = n => I.split(n).length - 1;
    console.log([
      "**Tool calls**: agc's tools are written `node <agc install>/scripts/<tool>.mjs`",
      '`agc …` is `node <agc install>/bin/agc-init.mjs …` when `agc` is not on PATH',
      '`gh run list --commit <sha>`, then `gh run view <run id>`',
      'Constitution §6 requires',
      'under `artifacts: "local"` the evidence paths are excluded from the branch',
      'under `artifacts: "local"` read `<worktree>/.current/<lane>/pending-tickets.md` instead',
      '(the repo addendum lists them)',
      'node scripts/', 'verify-release.mjs', '(this repo:'
    ].map(c).join(' '));
    EOF
    ```

QA writes PASS only if all of AC1–AC11 hold.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings (evidence-verification only) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- These all belong to release-engineer's SOP:
  - the **version bump to 4.12.0** (`package.json`, `package-lock.json`, the `index.ts` Server literal);
  - the **CHANGELOG entry**;
  - the **three `agc-version` stamps**;
  - **`agc check` at 4.12.0**;
  - the **`release/*` branch and PR** (main is protected, E297);
  - the **tag and GitHub release**;
  - **evidence archiving**.
- **Leak rule (carries forward)**: the release commit uses the noreply email from `.git/config`. The CHANGELOG, release notes and tag message contain no local paths, usernames, or adopter/customer names. This spec contains none.
- Not verified or fixed here:
  - the follow-ups filed by the wave-9 lanes (E354–E357; E356 is the addendum preamble that still says it only fills 見補充規則 places);
  - the `## 接手步驟` call-form text that `tools/fanout-handoff.ts` generates, and E345 (both kept out of the wave by the manifest);
  - the earlier queue items E340 and E341, and E293 (deferred).
- No code, test or content edits. A red found by QA routes back to the coordinator and is not fixed inside this feature.

## Dependencies / Prerequisites
- `release-post-v4-w8` is released (tag `v4.11.0`, `c04af50`; bookkeeping PR #32, merge `9205e84`). Its primary handoff (last write 2026-10-19T09:21Z, release-engineer, `Released v4.11.0`) is terminal. The new `active_feature` `release-post-v4-w9` supersedes it on the primary workspace, with no lane.
- QA PASS of T-RELW9-01..05 is release-engineer's precondition. Dispatch is PM to qa-engineer via the evidence-only single-role judge-dispatch edge (Constitution §3.1 `resume_of`), the same edge v4.5.0–v4.11.0 used. The coordinator writes that edge after cut approval.
- Version decided by the human: v4.12.0 MINOR (decided in the coordinator's chat).
- Dispatch pins for this feature (human directive, carried from `release-post-v4-w8`): `pm=opus`, `qa-engineer=sonnet`, `release-engineer=opus`. The coordinator re-asserts them on the cut-approval write.
- No `design/release-post-v4-w9.md`. `## Mode` is not armed, and the feature is non-visual.
- No external references. The Resource Audit Gate hits are internal spec, doc and CI-run pointers only (GitHub Actions run ids are read with `gh`, inside this repo), so the `external_refs` field is omitted.
- Known advisory: the `T-REL4-02` drift note is ignored per the human's standing instruction. Do not `tw_sync`.
- Environment: local is Node 22; CI runs Node 20 + 22. QA runs the suite under the test lock on Node 22 only (AC3); the Node 20 verdict is AC7. The ad-hoc probes in AC8 and AC10 write only under `$TMPDIR`.
- Changed since the v4.11.0 gate: this wave changes no compiled code (no `dist/`, `tools/` or `scripts/` diff), so the fanout behaviour probes of the v4.11.0 gate become regression runs (AC8 (f)). The new verification weight is on prompt composition (AC9, AC11) because const-08 and coord-03 are in composed bundles.
- Bookkeeping: this spec and the T-RELW9 rows in `.current/_primary/tasks.md` are left uncommitted on local main. Release-engineer carries them onto its `release/*` or `docs/*` branch (main is protected).

## Task Format
- [ ] T-RELW9-01 [P0] qa-engineer: verify AC1 + AC2 (diff-path classification since v4.11.0; per-lane review/qa evidence, closed PASS handoffs and ledgers for e226, e351; backlog done-marks, merge shas, E354–E357 rows) | depends_on: none
- [ ] T-RELW9-02 [P0] qa-engineer: verify AC3 + AC4 + AC5 + AC6 + AC7 (full suite under test lock on Node 22, clean build, check-version at 4.11.0, check:bookkeeping, check:md-tables, npm audit, agc check, transitions-sync, five CI runs Node 20 + 22) | depends_on: none
- [ ] T-RELW9-03 [P0] qa-engineer: verify AC8 (validate hard condition, w9 owners/handoff read-only, five-line usage, fanout regression tests) | depends_on: none
- [ ] T-RELW9-04 [P0] qa-engineer: verify AC9 (E350 call forms in content and in pm/coordinator/sr built bundles, golden word-diff, four budget caps, composition tests) | depends_on: none
- [ ] T-RELW9-05 [P0] qa-engineer: verify AC10 + AC11 (E351/E352 lane-protocol, E290 invariant, addendum §5 only, two-layer render and leak check; integrator SOP strings in built bundle, no node scripts/ left, re-pin sizes, SOP tests; v4.11.0 non-regression) | depends_on: none
