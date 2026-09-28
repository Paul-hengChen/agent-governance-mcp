# Review — T-E231-01

covers: T-E231-01, T-E231-02

## Round 1 — APPROVED — by code-reviewer

Reviewed: commit `5855501` against its parent `af59a42` (the human-approved cut), checked against `specs/e231-info-hygiene-rule.md`. No architecture spec exists for this feature.

## Summary
- T-E231-01 adds the **Information hygiene** and **Generic citation** bullets to §6 of `content/const-15-core-tail.md`, placed after the `Tool-internal ops` sub-bullet and before `## 7. Cognitive Discipline`.
- T-E231-02 adds a pointer (one sentence, three lines) to the "Third-party assets are never committed" section of `CONTRIBUTING.md`. It also adds an optional, non-normative §6 entry to `content/constitution-rationale.md` and widens that file's Scope line to include §6.
- It adds `qa_reports/expected-red_e231-info-hygiene-rule.txt`, which lists 15 expected-red tests (golden-fixture and `~tok` ceiling tests).
- Nothing under `gates/`, `bin/`, `tools/`, `test/`, or `dist/` changed.
- Verdict: APPROVED. No required findings. One recommended finding and two optional findings follow.

## AC Completeness
AC1 — implemented — `content/const-15-core-tail.md:16-28`. I extracted the spec's Decision §1 fenced block, removed its 3-space fence indent, and diffed it against the fragment: the two are byte-identical, line wrapping included (`diff` exit 0). All five leak classes and the full list of durable outputs are there, including `pending_notes` and handoff. The protocol carve-out is there. Both Generic-citation exemptions are there.
AC2 — implemented (content side) — the fragment is core-tagged, so the bullets ship on every arm. The pinning test for this AC is qa-owned under T-E231-04 and is not part of this review.
AC3 — implemented — `CONTRIBUTING.md:116-118`. It is the only hunk in the file. It has zero removed lines and adds one sentence. The rest of the section is unchanged.
AC4 — out of scope for this review. It is qa-owned (T-E231-03), and the reds are recorded in the manifest.
AC5 — implemented — the diff of `content/const-15-core-tail.md` is one purely additive hunk of 13 added lines and 0 removed lines. §5, §7, and the rest of §6 are unchanged.
AC6 — implemented, so far — `git diff --stat af59a42 5855501 -- gates bin tools test dist` is empty. The touched files are all in the AC6 allow-list, plus the lane's own handoff/dispatch bookkeeping and the expected-red manifest, which is governance data. `docs/backlog.md` and the test files are still pending under later tasks.

## Correctness
No findings.
- Expected-red check (SOP step 4a): the manifest exists. I checked all 15 entries rather than a sample of 3. Every test name appears in its named file (for example, `test/context-budget.test.mjs:226`, `:1155`, `:1998` and `test/compose-equivalence.test.mjs:93`, `:136`, `:141`, `:148`). The sorted list of `not ok` names from an actual `npm test` run (2800 pass / 15 fail) is identical to the sorted manifest entries: no red is missing from the manifest, and no manifest entry is missing from the run.
- Placement is correct. The new bullets are top-level `- ` bullets under §6. They are not nested under the git-ops whitelist, which uses 2-space sub-bullets.

## Quality
- **recommended** — `content/constitution-rationale.md` (the "Why Generic citation is a separate bullet" paragraph) restates part of the normative text: "It exempts governance-internal artifacts (qa/review reports, handoff notes) and machine-validated fields". It also drifts from that text. The bullet names three internal artifacts (qa/review reports, `pending_notes`, handoff), but the paraphrase says "handoff notes", which a reader could take as either `pending_notes` or handoff but not both. A rationale file should explain *why*, not re-list *what*. Suggest replacing the parenthetical with a reference to the bullet, for example: "It exempts the artifacts the bullet names, because those are read by the tooling and its operators…". This does not block approval, because the file is non-normative and is never composed into a prompt (no matches for `constitution-rationale` under `prompts/`, `bin/`, or `tools/`).
- **optional** — `content/constitution-rationale.md` heading "Why Information hygiene has no exemption" is followed by "The one carve-out is…". The normative bullet has the same shape ("No artifact type is exempt" plus the protocol carve-out), so this is consistent with the spec. Still, "has no artifact-type exemption" would read more precisely.
- **optional** — `content/constitution-rationale.md:10` widens the Scope line to §6 but leaves the "Rationale target: v3.32.0" and "Primary sources" lines unchanged. The new §6 entry cites its own sources inline (the `CONTRIBUTING.md` section and backlog E104/E107), so this is cosmetic.
- **Self-application of the new rule** (the brief asked for this check):
  - The `CONTRIBUTING.md` sentence contains no ticket ids, internal URLs, codenames, keys, or local paths, and it reads on its own.
  - The rationale entry names leak classes by description ("a live design-tool file key", "a client's design screenshots") and quotes no literal values. It cites only tracked paths (`CONTRIBUTING.md`, plus the pre-existing `research/` sources). Every ticket id (E104, E107) sits next to a plain-language explanation on the same line, so none stands alone.
  - The rationale does use some tooling vocabulary ("dispatch arm", "lite mode", "qa report"). That is unavoidable in a document whose subject is this tooling's constitution, and it is not a leak. I have not raised it as a finding.
  - The commit message does not cite any absolute local path or internal link.

## Architecture
No architecture spec exists for this feature. The change fits the layering described in the spec's Decision section:
- Both rules live in a single core-tagged constitution fragment.
- No skill file restates them (`git diff --stat` shows no `content/skill-*.md` or `content/coord-*.md` changes).
- The adapter template is unchanged, as Decision §3 requires.
- No gate was added, as Decision §4 and AC6 require.

## Security
No findings. The change is content only, and no input crosses a trust boundary. The added text introduces no secrets, internal URLs, or literal keys, and the E104 incident is described only by class.

## Performance
No findings on runtime. The only cost is prompt size: the core fragment grows by about 250 `~tok` on every composed arm, lite included. The spec (Decision §5) expects this, and the qa-owned T-E231-03 re-baselines the ceilings. The rationale addition costs no context budget because that file is never composed.

## Verdict
APPROVED — Decision §1 bullets are byte-identical to the approved cut, the CONTRIBUTING pointer and fragment diff are purely additive, the red set exactly matches the manifest, and the one recommended finding (rationale paraphrase of the exemption list) is in a non-normative, uncomposed file.
