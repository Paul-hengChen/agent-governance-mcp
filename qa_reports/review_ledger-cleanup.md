# QA Review — ledger-cleanup (maintenance pass)

**Date:** 2026-06-11
**Author:** qa-engineer
**Scope:** QA-owned maintenance — test-label truth fix + stale T-CR ledger cleanup. No implementation/sr work, no production code change.

---

## 1. Test-label truth fix (test-owner, Constitution §2)

**File:** `test/context-budget.test.mjs`

The AC2 test NAME on L80 documented a cap of `<= 2400 ~tok`, but the assertion on L96 already enforced `<= 2600`. The inline comment trail (L81–90) records the cap-raise history — 2100 → 2300 (v3.24.0) → 2400 (v3.27.0) → 2600 (v3.31.0, §1 Self-converge relaxation). The name string was simply never updated on the last (v3.31.0) bump, so the label drifted out of sync with the assertion.

- **Before:** `test("AC2: lean always-on bundle is below the raw baseline and within target (<= 2400 ~tok)", ...`
- **After:**  `test("AC2: lean always-on bundle is below the raw baseline and within target (<= 2600 ~tok)", ...`

**Note:** The assertion at L96 (`lean <= 2600`) was already correct and was NOT changed; neither were the comments (L81–90) nor any other test. This is a cosmetic label-truth fix only — the test name now matches the assertion it describes.

---

## 2. Stale T-CR ledger cleanup (4 rows closed by supersession)

Rows `T-CR-01`..`T-CR-04` (tasks.md L47–50) were the *original* constitution-restructure task chain. Per the constitution-restructure PM handoff, that chain was abandoned and replaced by a revised (-REV) chain that already PASSed and shipped (feature complete v3.32.0; `content/constitution-rationale.md` exists). The four originals lingered as open checkboxes, showing dead work in `tw_detect_drift`. Closed via `tw_complete_task` (qa-engineer) — supersession close, same pattern as the T481 close in the v3.24 batch. Not hand-edited.

| Row | Disposition | Reason dead |
|-----|-------------|-------------|
| T-CR-01 (Architect) | DESCOPED | Zero-code content-edit feature; no architecture pass needed. Restructure delivered through the -REV chain. |
| T-CR-02 (Sr-engineer) | SUPERSEDED by T-CR-02-REV (PASS) | `content/constitution-rationale.md` authored; `constitution.md` byte-untouched (git diff empty). Evidence: `qa_reports/review_T-CR-04-REV.md`. |
| T-CR-03 (Code-reviewer) | SUPERSEDED by T-CR-02-REV/T-CR-04-REV (PASS) | Code-review verification folded into the -REV chain. |
| T-CR-04 (QA) | SUPERSEDED by T-CR-04-REV (QA PASS) | All ACs verified in `qa_reports/review_T-CR-04-REV.md` — rationale doc well-formed, constitution byte-untouched, lite bundle no regression, npm test green. |

---

## 3. Gate — test suite

`npm test` → **608 pass / 608, 0 fail** (unchanged count; the label change is cosmetic and touches no assertion). Green.

---

## Verdict

PASS — label now matches assertion, 4 stale T-CR rows closed by supersession, suite green. Nothing further to build; the three shipped features (constitution-restructure v3.32.0, governance-text-load, decodename-cleanup) await a human release decision. package.json stays 3.31.0 (version bump is human-owned).
