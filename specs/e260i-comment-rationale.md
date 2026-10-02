# e260i comment rationale

Rationale moved out of long comment blocks in `test/context-budget.test.mjs` and `test/render-structure.test.mjs` by lane e260i of ticket E260 (spec: `specs/e260i-budget-render-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).`, and the text it points to lives in the section named after its test file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead. Only comments moved: no assertion, test name, assertion message, string or budget number changed.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the tests, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260i/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: filled in as trim tasks land |

## test/context-budget.test.mjs

Sections below are in file order. Test names such as `t-measure-runs` are the ids used in the old map, not literal test titles; the live test titles carry the acceptance-criterion ids of the cited specs.

### Spec-to-test map (file header)

The spec is `specs/context-budget-reduction.md`. The header comment mapped its criteria to tests:

| criterion | tests |
|---|---|
| measurement (AC1) | t-measure-runs, t-measure-labels |
| reduction (AC2) | t-strip-reduces, t-lean-under-target |
| enforcement preserved (AC3) | t-lite-omits-chain, t-lite-keeps-universal, t-full-keeps-chain, t-hook-lite, t-hook-full |
| no routing regression (AC4) | t-full-keeps-chain: chain roles still receive sections 3.1 and 4 verbatim; the transition logic is covered by the existing transitions test suite |
| manifest imported, not regex-copied (DR-4) | t-manifest-not-duplicated |

The header also recorded the compose-not-strip change: the file used to call `stripChainOnly` and `stripDesignOnly` directly. Both functions were deleted when `prompts/build.ts` began composing constitution fragments additively through `composeConstitution()`. Tests of the two strippers' internals (unit tests, regex parity, cross-axis permutation and orphan-marker sweeps) were removed. Tests of outcomes (what a dispatch mode contains or omits) were re-pointed to `composeConstitution()` and still hold. `stripRationale` and `stripOriginTags` are unchanged and their tests were kept verbatim. A later comment noted that the "exactly one balanced chain-only fence" test was also removed, because composition selects fragments by tag and never parses markers; the replacement contract is the manifest test here plus `test/compose-equivalence.test.mjs`.

### Lean always-on bundle cap history

The lean-bundle test asserts `lean <= <cap>` in approximate tokens (characters divided by 4). Each raise was a qa-owned re-measure with the cap set to the exact measured size (the "zero headroom" convention), except the early raises that kept some headroom. The lean path loads core-tagged and chain-tagged constitution fragments and the lite coordinator skill, so an edit to any of them moves the figure. Ticket codes are those of the then-current backlog rows.

| ticket or release | cap change | what the raise absorbed |
|---|---|---|
| v3.24.0 (B2) | 2100 to 2300 | about 200 tokens of editing headroom; the earlier raise from 2000 to 2100 had left a 2-token margin |
| v3.27.0 | 2300 to 2400 | net growth from the constitution edits A1 to B3 and the A4 wording; measured 2348 |
| v3.31.0 | 2400 to 2600 | the section 1 self-converge relaxation clause; measured 2528 |
| v3.28.0 | 2600 to 2700 | the section 1 design-sourced assets line; the lean path stripped chain parts only, so the design-only line counted; measured 2641 |
| v3.38.0 (F2) | 2700 to 2850 | the scope-creep visual-fidelity example in the lite coordinator skill (+91 tokens); measured 2791 |
| pm-cut-approval-gate | 2850 to 3010 | cut-approval SOP text in the lite coordinator skill and the skill-pm step 7a expansion; measured 2958 |
| cut-approval-coordinator-attestation | 3010 to 3030 | the Cut-Approval Gate bullet in `const-08-chain-31-mid.md` plus pointer-line dedup edits; exact |
| a13-section1-polish | 3030 to 3087 | the `const-01-core-head.md` Terse and Watermark rewrite (output-length policy, two-row watermark table with the `fable` tier); exact |
| a11-escalation-grammar | 3087 to 3332 | the canonical Escalation call format and WHEN/DO/ELSE bullets in `const-05-chain-mid.md`; exact |
| b8-external-ref-ledger | 3332 to 3386 | the lite skill Auto-Routing stop condition for `EXTERNAL_REFS_UNRESOLVED`; exact |
| c7-version-assertion-ownership | 3386 to 3491 | the `const-05-core-standards.md` "Test ownership" bullet rewrite (a narrow import-path-retarget carve-out, +420 characters); exact |
| c9-protocol-fields | 3491 to 3685 | the Escalation-call-format rewrite promoting `next_role`, `resume_of` and `review_verdict` to first-class fields (with the `REVIEW_VERDICT_STATUS_MISMATCH` prose) plus a rewording in `const-12-chain-r10-s4.md`; exact |
| c14-dispatch-pins | 3685 to 3761 | the Pin-override bullet under the Watermark rule in `const-01-core-head.md`; exact |
| a12-partials-limits-registry | 3761 to 4027 | the `## Limits` table at the top of `const-01-core-head.md`; the lite skill does not use the partial mechanism; exact |
| d2-server-brake-accounting | 4027 to 4085 | server-tracked hop-counter wording in the lite skill, the `hop` row of the Limits table and the `HOP_CAP_EXCEEDED` bullet; exact |
| e7-governed-git-surface | 4085 to 4297 | the section 6 "Sanctioned git operations (ALL roles)" whitelist bullet in `const-15-core-tail.md`, unfenced so it counts on every path; the same raise re-synced a test title that had stalled at an older cap; exact |
| e24-exemptions-manifest | 4297 to 4485 (+188) | the section 2 "Build-gate exemptions" bullet in `const-05-core-standards.md`; exact |
| e25-git-vocabulary | 4485 to 4544 (+59) | stash and stash-pop added to the sanctioned git list and the destructive file-checkout form clarified in `const-15-core-tail.md`; exact |
| e59-const6-waiver-clause | 4544 to 4667 (+123) | the section 6 "Dependency audit at build gate" rewrite: the "waived in the PR description" escape became a pre-dated advisory-record disposition (advisory id, decision, re-review trigger) binding every build-running role; exact |
| e43-test-file-ask-at-dispatch | 4667 to 4868 (+201) | the three-branch rewrite of the section 2 "Conditional test writing" bullet (230 to 1032 characters), bought deliberately because the one-sentence form was unexecutable for a Task-dispatched qa-engineer; fencing the causal clause as rationale was considered and rejected with the numbers in hand (see the backlog row for that ticket); exact |
| e130-lane-default | 4868 to 4912 (+44) | an edit to the hand-edit rule in `const-05-core-standards.md` (a net shrink) and a new sentence in the Document Priority paragraph of `const-15-core-tail.md` (a larger growth); exact |
| e178a-integrator-role | 4912 to 5157 (+245) | the section 6 amendment in `const-15-core-tail.md`: the `git fetch` clause, the sub-bullet forbidding `commit --amend`, the integrator-only git-ops grant and the tool-internal-ops sub-bullet; the same delta appears in the design-arm, non-design and teamwork floors; exact |
| E231 | 5157 to 5415 | a rule telling every role what it may never write in any durable output (comment, report, commit message), in the same core-tagged fragment; exact |
| E258 | 5415 to 5548 | the Comment-discipline bullet in `const-15-core-tail.md`; exact |

Why the growth was accepted: each bullet is core- or chain-tagged and ships on the lean path by design; the bumps track proportionate rule growth, not a blowout.

### omitConstitution floor

The size-delta test measures `buildPromptForRole` with and without `omitConstitution` for the lite coordinator skill on a non-design fixture: full 2575, omitted 1070, saved 1505 approximate tokens. The floor of 1200 sits about 300 below the measured saving so routine content edits do not flap it. The spec is `specs/c6-c11-prompt-state-injection.md` (its AC-9 asks for a concrete number); the end-to-end dedup proof is in `test/prompt-state-footer.test.mjs`.

### Hook test isolation

`runHook()` runs the SessionStart hook against a throwaway workspace with a `.current/` marker. Before the fix it used the repo itself as the project directory, so the hook wrote its cross-process dedup marker into the repo's own `.current/`. That marker is read from disk by the server by design, so a later test process (the teamwork-lite AC3b test, spawning the real server against the same root inside the 120-second window) saw a fresh marker, substituted the sentinel for the constitution and failed its constitution-header assertion. This was a test-infra defect, not a product bug. The fix loosened no assertion; the hook derives its content root from its own file location, not from the project directory variable.

### Design-arm constitution floor history

The AC8 design-arm test measures `stripRationale(stripOriginTags(CONSTITUTION))` with the test's own chars/4 estimator and asserts a cap (final 10057) plus a saving of at least 240 (raw minus stripped). The design arm keeps the design-only fenced text, so this floor sits above the non-design floor. Each bump was qa-owned (sr-owned where noted) and set to the exact re-measured value with zero headroom. A core-tagged edit lands on both arms, so the design-only saving stays put; the saving figures below are raw minus stripped.

| ticket or release | cap change | what happened |
|---|---|---|
| constitution-conditional-load phase 2 | rebaselined to 4239 | three more design-only fence pairs (six pairs, twelve marker lines); the markers are not stripped on the design arm, so the figure grew; raw 4311; the non-design path saves about 1830 |
| v3.28.0 | 4239 to 4304 | the design-sourced-assets line in section 1, inside a design-only fence |
| v3.40.0 | 4304 to 4523 | the Baseline manifest gate bullet in section 3.1 (design-only fence) |
| governance-tag-strip | 4523 down to 4487 | the build now strips origin tags first, so the test composes like production; measuring raw-only would have failed at 4735 against the old cap |
| cut-approval-coordinator-attestation | 4487 to 4957 | the Cut-Approval Gate bullet in `const-08-chain-31-mid.md`, chain-tagged |
| pm-repair-resume-routing (v3.47.0) | 4957 to 5260 | the Amend-Resume Edge bullet in the same fragment; saving 273 (raw 5533) |
| a13-section1-polish | 5260 to 5316 | the Terse/Watermark rewrite in `const-01-core-head.md` (output-length policy, two-row watermark table with the `fable` tier); raw 5589; saving 273 |
| a11-escalation-grammar | 5316 to 5561 | the canonical Escalation call format and WHEN/DO/ELSE bullets in `const-05-chain-mid.md`; raw 5834 |
| b8-external-ref-ledger | 5561 to 5616 | the section 7 External-reference policy rewrite in `const-15-core-tail.md`; raw 5889 |
| c7-version-assertion-ownership | 5616 to 5721 | the Test ownership bullet rewrite (about 420 characters net) in `const-05-core-standards.md`; raw 5994 |
| c9-protocol-fields | 5721 to 6024 | the Escalation-call-format rewrite, the Amend-Resume and code-reviewer-verdict rewrite, and one rewording in `const-12-chain-r10-s4.md`; raw 6297 |
| c14-dispatch-pins | 6024 to 6100 | the pin-override bullet in `const-01-core-head.md`; raw 6373 |
| a12-partials-limits-registry | 6100 to 6391 | the new Limits table in `const-01-core-head.md` plus reference-by-name rewrites in four fragments; raw 6664 |
| a12-followup-qa-round-name | 6391 to 6399 | the `qa_round` name-reference rewrite in `const-06-chain-31-head.md`; raw 6672 |
| e10-lease-override | 6399 to 7064 | the Lease-Override and Bookkeeping-Write bullets in section 3.1; raw 7362; saving 298 |
| e7-governed-git-surface (sr-owned) | 7064 to 7275 | the section 6 sanctioned-git-operations whitelist bullet in `const-15-core-tail.md`; unfenced because the exactly-two-rationale-fences test forbids a third, so its full text counts; raw 7573 |
| e14-e16-release-hardening (sr-owned) | 7275 to 7435 | the single-role judge dispatch charter sentences appended to the Amend-Resume Edge bullet |
| e5-intake-tiering | 7435 to 7863 | the Cut-Approval Auto-Tier bullet (about 1780 characters); the handoff notes said 7859 and 7863, qa re-measured 7863 |
| e18-write-provenance | 7863 to 8437 | the Stamp-Provenance and QA Completion-Evidence bullets (about 602 approximate tokens before tag stripping); raw 8790; saving 353 |
| e24-exemptions-manifest | 8437 to 8625 | the Build-gate exemptions bullet in `const-05-core-standards.md`, same delta as the lean path |
| e25-git-vocabulary | 8625 to 8685 | the git stash addition and checkout clarification in the section 6 bullet; raw 9038; saving 353 |
| e59-const6-waiver-clause | 8685 to 8804 | the Dependency-audit bullet rewrite (a pre-dated advisory-record disposition replaces the PR-description waiver); raw 9170; saving 366 |
| e40-nonqa-completed-tasks-write-gate | 8804 to 9187 | the Non-QA Completed-Tasks Gate row in `const-08-chain-31-mid.md`, core-tagged; raw 9567; saving 380 |
| e43-test-file-ask-at-dispatch | 9187 to 9374 | the three-branch rewrite of the section 2 test-file rule; the pairing with the non-design floor is unchanged at 2098 |
| e130-lane-default | 9374 to 9421 | a shrink in `const-05` plus a growth in `const-15`, both core; pairing still 2098 |
| e178a-integrator-role | 9421 to 9666 | the section 6 amendment (git fetch clause, `commit --amend` forbidden sub-bullet, integrator-only grant, tool-internal-ops sub-bullet); the pairing drifted to 2097 by rounding, not by a design-only regression |
| E231 | 9666 to 9924 | the information-hygiene and generic-citation rule in the same core fragment; pairing back to 2098 |
| E258 | 9924 to 10057 | the Comment-discipline bullet in `const-15-core-tail.md` |

### Teamwork coordinator bundle cap history

The design-arm coordinator test composes the bundle like `buildPromptForRole`: `stripRationale(stripOriginTags(CONSTITUTION))`, a separator, then `stripRationale(stripOriginTags(body))` for the coordinator skill, measured with chars/4. The coordinator is a chain role, so on a design feature it keeps the full section 3.2 (the false-PASS incident was a coordinator-authored accept-policy, so section 3.2 binds the coordinator on design work) and this worst-case bundle is the design-arm size. The six design-only marker pairs are not stripped on this arm, so the bundle grew at the phase-2 rebaseline. Each bump is qa-owned (sr-owned where noted) and set to the exact re-measured value, zero headroom, except where a row says otherwise. Constitution-side growth is the same delta as in the design-arm constitution floor history above.

| ticket or release | cap change | what happened |
|---|---|---|
| constitution-conditional-load phase 2 | rebaselined to 7703 | measured exact on the working tree |
| v3.28.0 | 7703 to 7768 | the design-sourced-assets line in section 1 plus the matching sr-engineer skill rule (marker-line cost counts on this arm) |
| v3.40.0 | 7768 to 7987 | the Baseline manifest gate bullet (design-only fence) plus the qa-visual Step A.0 enforcement note |
| pm-cut-approval-gate | 7987 to 8160 | the cut-approval stop-condition entry in the coordinator Auto-Routing section; measured 8109, so about 51 tokens of editing headroom (the one row with headroom) |
| governance-tag-strip | 8160 down to 8078 | origin tags are now stripped from both constitution and skill body first, matching production; the coordinator skill carried three origin fences (Visual Verdict Boundary, Drift Reconcile, Subagent Token Observability); the headline saving of this feature for the worst-case per-dispatch bundle |
| cut-approval-coordinator-attestation | 8078 to 8635 | the Cut-Approval Gate bullet in `const-08-chain-31-mid.md` plus the coordinator stop-condition 6 dedup and self-check rewrite; the handoff note said 8625, qa re-measured 8635 |
| pm-repair-resume-routing (v3.47.0) | 8635 to 9050 | the Amend-Resume Edge bullet plus the coordinator Auto-Routing stop-condition 7 entry (the coordinator carries `resume_of` onto the routing write when relaying a PM amendment) |
| a13-section1-polish | 9050 to 9106 | the Terse/Watermark rewrite in `const-01-core-head.md`; the coordinator skill was untouched |
| a11-escalation-grammar | 9106 to 9545 | the canonical Escalation call format and WHEN/DO/ELSE bullets plus the coordinator Escalation Routes table conversion |
| b8-external-ref-ledger | 9545 to 9699 | the section 7 rewrite plus a coordinator Auto-Routing stop condition for `EXTERNAL_REFS_UNRESOLVED` |
| c8-crash-resume-protocol | 9699 to 10774 | 48 additive lines in the coordinator skill (the `dispatch_pins` convention, the Pinned-tier expectation, a new `## Crash-Resume Protocol` section of three steps, a Crash detection row), spec-mandated and purely additive, no constitution change |
| c7-version-assertion-ownership | 10774 to 10879 | the Test ownership bullet rewrite (about 420 characters net); the c8 growth stacks unchanged |
| c9-protocol-fields | 10879 to 11290 | the constitution-side growth of that ticket (+303) plus the coordinator Auto-Routing, Escalation Routes and Gate Summary prose rewrite (`next_role` and `resume_of` as first-class fields) |
| c14-dispatch-pins | 11290 to 11415 | the pin-override bullet (+76) plus a rewrite of three `dispatch_pins` passages in the coordinator skill |
| c5-c18-watermark-configcache | 11415 to 11445 | the coordinator Correction strategy prose rewrite (about +30), distinguishing absent (append) from mismatched (strip the wrong trailing line, then append the canonical one) |
| c17-dispatch-brief-template | 11445 to 11815 | the Dispatch Brief Template subsection (a fenced template of six invariant lines plus framing) and the repointed `prompt=` phrasing; the handoff note said about 11815, confirmed exact |
| b9-token-budget-brake | 11815 to 12247 | the Token Budget Brake subsection after Subagent Token Observability plus a Token budget brake Escalation Routes row; no schema bump, no server-side gate |
| a12-partials-limits-registry | 12247 to 12538 | the constitution-side growth (+291: Limits table and reference-by-name rewrites); the coordinator skill does not adopt the partial mechanism |
| a12-followup-qa-round-name | 12538 to 12547 | the `qa_round` name-reference growth (+8), constitution side only |
| d2-server-brake-accounting | 12547 to 13046 | the `hop` cap row and `HOP_CAP_EXCEEDED` bullet in `const-01-core-head.md` plus the coordinator hop-counter rewrite (server-tracked `hop_count`), a Hop counter scope paragraph and a hop-cap Escalation Routes row |
| d5-server-side-stale-dispatch-detection | 13046 to 13298 | coordinator prose only: a Stale-dispatch detection row, a fresh-session pointer on the Crash detection row, an intro rewrite, and a new step 0 in the Crash-Resume Protocol |
| d6-host-capability-compose-axis | no bump | the monolithic coordinator skill file was retired; this cap now measures the historical everything-ships bundle, the full-capability composition (`taskTool: true` reproduces the monolith byte for byte), not the lean in-server default |
| e1-feature-scoped-state-design | 13298 to 13537 | the Feature-Scope Gate note in the Fallback Playbook plus a `FEATURE_LEASE_HELD` Escalation Routes row in `coord-03-core-fallback.md` |
| e4-design-source-credibility-gate | 13537 to 13669 | the Source-credibility gate stop-condition row in `coord-03-core-fallback.md` |
| e10-lease-override | 13669 to 14333 | the Lease-Override and Bookkeeping-Write bullets (+665); the coordinator skill was untouched |
| e7-governed-git-surface (sr-owned) | 14333 to 14544 | the section 6 sanctioned-git-ops whitelist bullet (+211 stripped); only the release-engineer skill, which is not in this bundle, gained a pointer |
| e14-e16-release-hardening (sr-owned) | 14544 to 14740 | the single-role judge dispatch sentences (+160) plus a pointer-only sentence on the `coord-03-core-fallback.md` Amend-Resume relay row (about 36) |
| e5-intake-tiering | 14740 to 15958 | the Cut-Approval Auto-Tier bullet (+428) plus the coordinator Backlog Intake Loop section, auto-tier writer action and cut-approval-gate row amendment in `coord-03` and the Cheapest-Compliant-Path Intake step 4a in `coord-07`; the handoff notes said 15953 and 15958; growth +1218 is proportionate to about 1780 plus 3800 characters before stripping |
| e18-write-provenance | 15958 to 16532 | the Stamp-Provenance and QA Completion-Evidence bullets (+574); the coordinator skill was untouched |
| e24-exemptions-manifest | 16532 to 16720 | the Build-gate exemptions bullet (+188) |
| e25-git-vocabulary | 16720 to 16779 | the section 6 git-ops bullet edit (about +59) |
| e59-const6-waiver-clause | 16779 to 16898 | the Dependency-audit bullet rewrite (+119) |
| e40-nonqa-completed-tasks-write-gate | 16898 to 17281 | the Non-QA Completed-Tasks Gate row (+383); no coordinator fragment touched |
| e72-claim-vs-state-diff | 17281 to 17498 | the Claim-vs-state mismatch Escalation Routes row plus its Known non-mismatches note in `coord-03-core-fallback.md`; the constitution floor is untouched |
| e43-test-file-ask-at-dispatch | 17498 to 17844 | +346: +187 from the constitution fragment plus about 159 from `coord-02-host-dispatch.md` (the new Test-file placement template line and its target-conditional inclusion rule); the coordinator bundle is the only measured bundle carrying coord-02, which is host-tagged `host:claude-code`, so the other three bumps of that ticket are +187 and +201 |
| e96-dispatch-preference-explicit | 17844 to 17984 | +140: coord-02's anti-nudge sentence and the WHEN/DO section 3.2 surfacing clause, plus coord-03's re-conditioned fallback line (genuine unavailability, or a self-contained tool-error or unknown-subagent-type case, replacing a dangling pointer); both spans are core or host-tagged and land in this bundle only; measured through `composeSkill`, `hostCapabilitiesFor("claude-code")`, `stripOriginTags`, `stripRationale`, in `buildPromptForRole` order |
| e111-lane-worktree-evidence | 17984 to 18303 | +319: coord-03's Worktree bootstrap obligation paragraph under the Feature-Scope Gate (symlink back to the primary checkout for `qa_reports/`, `review_reports/` and `specs/`, with the mkdir-first, dangling-symlink and top-level-only caveats) plus a clause on the Feature-lease gate row pointing at it |
| e87-e95-release-citation-accuracy | 18303 to 18369 | +66: coord-03's Evidence-Citation Convention section, a backlog citation rule requiring the eventual archive path rather than the pre-archive root; its rationale sentence is block-fenced and strips on every dispatch, so only the heading and one normative sentence survive (the whole +66); the sibling CHANGELOG-citation check lives in the release-engineer skill, outside this bundle |
| e91-e103-dispatch-pin-mechanics | 18369 to 18570 | +201: coord-02's required `model` dispatch-argument clause (resolve from `dispatch_pins`, else the role's agent-file `model` frontmatter, with a no-resolvable-tier escape hatch), coord-03's Crash-Resume step 3 reword and coord-04's Pinned-tier expectation reword (both trade enforcement-implying framing for honest self-report detection); the test title, stale at 18303, was reconciled in the same edit; measured 74280 characters |
| e109-workspace-feature-anchoring | 18570 to 18722 | +152: the Anchoring rule sentence appended to the Feature-Scope Gate paragraph (every per-workspace mechanism is anchored to `workspace_path`; a multi-lane plan lives in a tracked backlog or spec artifact, never inferred across lane handoffs); deliberately not rationale-fenced, because fencing strips the sentence from this exact bundle and would pass the cap by deleting the deliverable; measured 74887 characters |
| e142-release-tooling-wave25 | 18722 to 18747 | +25: one clause on the Anchoring rule separating keying (`workspace_path`) from resolution (the Worktree bootstrap obligation), additive and unfenced for the same reason, partly offset by wrapping the sentence's own provenance code in an origin tag that strips; measured 74987 characters; after stripping the literal provenance code is gone while the new clause survives verbatim |
| e113-feature-level-rollup | 18747 to 18982 | +235: the Feature-close roll-up obligation sentence appended to the Feature-Scope Gate paragraph, unfenced for the same reason (a fence would delete the normative must-derive-and-present obligation); only its provenance code is origin-tagged; measured 75925 characters |
| e110-pm-parallel-lane-template | 18982 to 18990 | +8: the `touches` column (header, separator and `<paths>` in both placeholder rows) in the Split Table template in `coord-01-core-head.md` |
| e174-flat-path-sweep | 18990 to 19284 | +294: the `dispatch_mechanism: "task"` invariant line in coord-02's Dispatch Brief Template plus coord-03's flat-path retargets and two new attestation lines for `"switch_role"` and `"inline"`; no constitution-side edit |
| e179-ticket-allocation-wiring | 19284 to 19408 | +124: coord-03's Lane findings are numbered at finish time paragraph in the Backlog Intake Loop; the composed-monolith golden `test/fixtures/compose-golden/skill-coordinator-monolith.txt` was re-baselined with `scripts/capture-constitution-golden.mjs` (diff-verified minimal, +2 lines, that fixture only) |
| e130-lane-default | 19408 to 19799 | +391: coord-03's Lane-start default paragraph (wires the Complexity Scope Gate to `agc feature start`) plus a small Split Table How to proceed wording addition in coord-01; much larger than the +47 constitution-only bump because coord-01 and coord-03 compose into this bundle; the golden grew about 1440 bytes and was re-baselined, diff-verified |
| e178a-integrator-role | 19799 to 20044 | +245, identical to the constitution floor delta: only `const-15-core-tail.md` changed, so the coordinator golden was not re-baselined |
| E231 | 20044 to 20310 | the information-hygiene and generic-citation rule in the constitution side; the golden was unchanged after the capture script ran |
| E258 | 20310 to 20434 | the Comment-discipline bullet, constitution side |

### Skill token cap histories (pm and sr-engineer)

Both tests measure the body as production composes it, `stripRationale(stripOriginTags(expandSkill(body)))` after removing frontmatter, and assert `~tok <= cap`. Same zero-headroom rule as the lean bundle: a raise is a qa-owned re-measure set to the exact figure unless a row says otherwise. The pm test title still says 4376 while the asserted cap is 4401.

skill-pm.md (final cap 4401):

| ticket or release | cap change | what happened |
|---|---|---|
| pm-cut-approval-gate | 2322 to 2850 | step 7a Cut-Approval Gate SOP (inline cut draft workflow, design-link rule, re-arm description); measured 2800, so about 50 tokens of headroom |
| governance-tag-strip | 2850 down to 2817 | the real pipeline strips origin tags before rationale; the skill carries one origin fence (the Geometric-Density Split Gate provenance tag nested in rationale), so composing like production trims a few bytes below the raw-only 2830; the aim was a lower cap, not fresh slack |
| pm-repair-resume-routing (v3.47.0) | 2817 to 2918 | the PM SOP records `resume_of: <role>` on its amend write, pointing at the constitution chain section; exact |
| a13-section1-polish | 2918 to 3196 | the `## Spec Schema` minimal-complete-passing-example block, partly offset by removing the Output-rule word-cap sentence; exact |
| a11-escalation-grammar | 3196 to 3225 | the Escalation Routes table converted to the canonical const-05 call format; exact |
| b8-external-ref-ledger | 3225 to 3327 | the Resource Audit Gate row rewrite (records `external_refs` entries via `tw_update_state`); exact |
| c9-protocol-fields | 3327 to 3377 | Auto-Routing, Escalation Routes and Gate Summary prose rewrite (`next_role` and `resume_of` as first-class fields instead of `pending_notes` tokens); exact |
| c16-c10-role-boundary | 3377 to 3473 | a cut-template rule in the Task Format section: release bookkeeping (version bump, CHANGELOG, backlog done-marking) goes to release-engineer, never onto a qa-engineer or sr-engineer task by default; exact |
| a12-partials-limits-registry | 3473, unchanged | re-baseline: the test now expands the partial token like production; the figure came out the same as the earlier raw-only one because the token and the expanded step-1 line differ by about 1 token, so only the computation changed |
| e2-bugfix-repro-gate | 3473 to 3775 | the "Bugfix mode" paragraph (`dispatch_mode="bugfix"` guidance, opt-back-in note, one Task-Format example); exact |
| e4-design-source-credibility-gate | 3775 to 3922 | the Source-Credibility Gate row in the Gate Summary table (an awareness-only pointer; the design-auditor authors the attestation); exact |
| e3-outcome-shaped-acceptance | 3922 to 4128 | the conditional `proof:` annotation convention and worked example in the Spec Schema Acceptance Criteria bullet; the same bump fixed a title that had stalled at an older cap; exact |
| e110-pm-parallel-lane-template | 4128 to 4376 | the `Parallel-Lane Cut` Gate Summary row (seed, fan-out, join template, per-AC `proof:` audit step, `serial — shared layer` guardrail), the step 2 ordered-sequence mention and the cut-header `touches` column with its definition; exact |
| e164-e167-content-wave45 | 4376 to 4401 | the `touches` definition's governance-bookkeeping exclusion clause (excludes `tasks.md`, `.current/**`, `qa_reports/**`, `review_reports/**`); exact; the lean always-on floor was unaffected |

skill-sr-engineer.md (final cap 2852):

| ticket or release | cap change | what happened |
|---|---|---|
| v3.28.0 | 2048 to 2210 | the "Source assets, don't redraw them" rule in Design-Aware Pre-Flight step 3a; measured 2160, about 50 tokens of headroom |
| governance-tag-strip | 2210 down to 2138 | the densest origin-tag site among the skills (8 fences); composing like production measures 2138, and leaving the raw-only cap would have masked the real saving; exact |
| a11-escalation-grammar | 2138 to 2258 | the Escalation Routes table converted to the canonical call format; exact |
| c9-protocol-fields | 2258 to 2275 | the Escalation Routes column rewrite (note-token column became a structured-field column); exact |
| c15-expected-red-manifest | 2275 to 2469 | the new SOP step 7a (Expected-Red Manifest emission convention); exact |
| a12-partials-limits-registry | 2469, unchanged | re-baseline: the test now expands the partial token; measured 2407, still under the cap, so only the computation was corrected |
| e2-bugfix-repro-gate | 2469 to 2642 | the new step 3b "Repro-First (bugfix mode)" (write the repro test, confirm red, record the manifest, then fix; escape to pm); exact |
| e20-e21-crash-resilience-sop | 2642 to 2852 | two new SOP steps: 4a "Crash checkpoint before long steps" (a `bookkeeping_write` checkpoint before any long build or suite, plus a QA-added file-mode-only caveat) and 4b "HARD — long runs end in-turn"; the code-reviewer had cited 2848 before the caveat; exact |

### Non-design constitution floor history

The AC8 non-design test measures `stripRationale(stripOriginTags(composeConstitution({ chain: true, design: false })))` and asserts a cap (final 7959) plus a design-only saving (design-arm figure minus non-design figure) of at least 2080 approximate tokens. Core- and chain-tagged edits land on both arms, so each bump here mirrors the design-arm bump above and the saving stays near 2098. Every bump was qa-owned (sr-owned where noted), independently re-measured rather than taken from builder notes, and set to the exact value with zero headroom. The "saving" column is the saving after the change.

| ticket or release | cap change | saving | what happened |
|---|---|---|---|
| constitution-conditional-load phase 2 | 2409 | 1830 | first measurement on the working tree after the two extra spans were stripped; exact |
| governance-tag-strip | 2409 to 2403 | 1830 to 2084 | both sides now fold in stripOriginTags like production; the saving grows because the design-only spans also carry origin tags that only the fold removes |
| cut-approval-coordinator-attestation | 2403 to 2872 | 2085 | the Cut-Approval Gate bullet in `const-08-chain-31-mid.md`, chain-tagged, so it lands on the non-design path; exact |
| pm-repair-resume-routing (v3.47.0) | 2872 to 3175 | 2085 | the Amend-Resume Edge bullet in the same fragment; design-arm 5260 less 3175 |
| a13-section1-polish | 3175 to 3232 | 2084 | the `const-01-core-head.md` Terse/Watermark rewrite; core-head, so on both paths |
| a11-escalation-grammar | 3232 to 3477 | 2084 | the Escalation call format and WHEN/DO/ELSE bullets in `const-05-chain-mid.md`, chain-tagged |
| b8-external-ref-ledger | 3477 to 3531 | 2085 | the section 7 rewrite in `const-15-core-tail.md` |
| c7-version-assertion-ownership | 3531 to 3636 | 2085 | the Test ownership bullet rewrite in `const-05-core-standards.md` (about +420 characters net) |
| c9-protocol-fields | 3636 to 3939 | 2085 | the Escalation-call-format rewrite, the Amend-Resume and code-reviewer-verdict rewrite and one rewording in `const-12-chain-r10-s4.md`, all chain-tagged |
| c14-dispatch-pins | 3939 to 4016 | 2084 | the Pin-override bullet in `const-01-core-head.md` |
| a12-partials-limits-registry | 4016 to 4293 | 2098 | the `## Limits` table plus reference-by-name rewrites in three chain-tagged fragments; the saving widens by a few tokens because the `const-09` rewrite is design-only and lands on the design arm alone |
| a12-followup-qa-round-name | 4293 to 4302 | 2097 | the `qa_round` name-reference rewrite in `const-06-chain-31-head.md`, chain-tagged |
| e10-lease-override | 4302 to 4966 | 2098 | the Lease-Override and Bookkeeping-Write bullets in section 3.1, chain-tagged |
| e7-governed-git-surface (sr-owned) | 4966 to 5177 | 2098 | the section 6 sanctioned-git-ops whitelist bullet in `const-15-core-tail.md`, core-tagged so it lands equally on both sides |
| e14-e16-release-hardening (sr-owned) | 5177 to 5337 | 2098 | the single-role judge dispatch charter sentences in section 3.1, chain-tagged |
| e5-intake-tiering | 5337 to 5766 | 2097 | the Cut-Approval Auto-Tier bullet (+429, against +428 on the design arm: rounding) |
| e18-write-provenance | 5766 to 6340 | 2097 | the Stamp-Provenance and QA Completion-Evidence bullets (+574, equal on both arms) |
| e24-exemptions-manifest | 6340 to 6528 | 2097 | the Build-gate exemptions bullet in `const-05-core-standards.md` (+188) |
| e25-git-vocabulary | 6528 to 6587 | 2098 | the section 6 git-ops bullet edit (+59 to +60: rounding) |
| e59-const6-waiver-clause | 6587 to 6706 | 2098 | the Dependency-audit bullet rewrite (+119) |
| e40-nonqa-completed-tasks-write-gate | 6706 to 7089 | 2098 | the Non-QA Completed-Tasks Gate row in `const-08-chain-31-mid.md`; `const-08` is composed into chain and full-detail bundles, never lite (+383) |
| e43-test-file-ask-at-dispatch | 7089 to 7276 | 2098 | the Conditional test writing rewrite in `const-05`, core, so identical to the design-arm delta (+187) |
| e130-lane-default | 7276 to 7323 | 2098 | one shrink in `const-05` and one growth in `const-15`, both core (+47) |
| e178a-integrator-role | 7323 to 7569 | 2097 | the section 6 amendment in `const-15-core-tail.md` (+246, within 1 of the design-arm +245: rounding) |
| E231 | 7569 to 7826 | 2098 | the information-hygiene and generic-citation rule in the same core fragment |
| E258 | 7826 to 7959 | 2098 | the Comment-discipline bullet in `const-15-core-tail.md` |

The bundle test beside it (non-design sr-engineer bundle at least 1830 approximate tokens lighter than the design-armed one) was re-baselined for the two extra stripped spans: the saving grew from 1187 to 1830. It composes the non-design side with `composeConstitution({ chain: true, design: false })` and the design side from `CONSTITUTION`, each with the skill body appended.

### constitution-conditional-load test map

The spec is `specs/constitution-conditional-load.md`. Test names are the ids of the old map, not literal titles.

| criterion | tests |
|---|---|
| non-design strips (AC1) | t-ccl-strip-helper, t-ccl-build-nondesign-strips |
| design loads full (AC2) | t-ccl-build-design-loads, t-ccl-design-byte-equal |
| safe default (AC3) | t-ccl-no-state-strips, t-ccl-no-design-file-strips |
| byte-unchanged surviving rules (AC4) | t-ccl-r10-byte-equal, t-ccl-nonvisual-byte-equal |
| composition (AC5, HC5) | t-ccl-six-permutations, t-ccl-zero-orphans |
| anti-sweep on both arms (AC6) | t-ccl-antisweep-both-arms |
| lite interaction (AC7) | t-ccl-lite-nondesign-consistent |
| rebaselined floors (AC8) | t-ccl-nondesign-floor and the two rebaselined design-arm floors (4200 and 7665 at the time) |

The strip helper, the six-permutation test and the orphan-marker test no longer exist: `stripDesignOnly` and `stripChainOnly` were deleted when constitution fragments began to be composed by tag, so fragment selection happens once in `composeConstitution()` and markers are never parsed. The byte-identity contract is in `test/compose-equivalence.test.mjs`.

### Sentinel notes (conditional-load tests)

- The origin-tag strip removes the version suffix of several sentinels before they are checked, so the pinned literals dropped their suffix: the Visual evidence gate and `visual_round` sub-loop bullets, the Design-baseline scope and Self-converge relaxation bullets, and the reconcile-rule finding code. The Visual Widgets exception (v3.14.0) bullet was left un-fenced on purpose (a skip-site pinned by the builders and the reviewer), so its version tag still ships and its sentinel keeps the tag.
- Full-bullet anchors are used for the three section 1 Span B bullets because the bold-tag-only forms also appear in skill bodies that cite the constitution (for example the sr-engineer skill cites the Design-baseline scope bullet), which would let a sentinel survive in a skill and fail the section 1 strip check falsely. The openers are unique to the constitution section 1.
- The design-arm byte-equality tests slice a span out of the raw constitution, which still carries origin-fence markup, so they pass the slice through `stripOriginTags` before comparing against dispatch text that was origin-stripped by `buildPromptForRole`.
- The `fullDetail` round-trip: the section 1 "column-scroller picker" rationale fence sits inside a design-only fence (the rationale is nested inside design-only). `fullDetail` opts out of `stripRationale` but not of the design-only exclusion, so that example is absent on a non-design `fullDetail` dispatch, while the section 7 "see XYZ" example, in no design-only fence, survives on both arms.

## test/render-structure.test.mjs

(Filled in by the trim tasks T-E260I-09 and T-E260I-10.)
