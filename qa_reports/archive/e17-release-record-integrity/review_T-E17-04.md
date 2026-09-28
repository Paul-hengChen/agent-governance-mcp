# QA review — T-E17-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-13T10:50:41.401Z — PASS — by qa-engineer

VR-13 CI fix round — PASS. Root cause: test/verify-release.test.mjs's VR-13 built its "no gh on PATH" fixture from a hardcoded PATH="/usr/bin:/bin", assuming gh never lives there; true on macOS/Homebrew (git under /usr/bin, gh under /opt/homebrew/bin) but false on GitHub's ubuntu-latest hosted runners, which apt-install gh directly at /usr/bin/gh. There, Check 6 resolved and ran the real gh (unauthenticated — CI sets no GH_TOKEN/GITHUB_TOKEN), which exited non-zero and hit the gh-run-list-failed WARN branch (VR-14's territory) instead of the ENOENT WARN VR-13 asserts — turning CI red on every main push since v3.83.0. Product behavior (scripts/verify-release.mjs) was correct throughout; only the test's environment assumption was wrong. Fix: replaced the hardcoded path with noGhSystemPath(), a shim dir built from whatever git+cat the running test process's own PATH resolves to, guaranteeing gh's absence on any host; applied to all six Check-6 tests (VR-11..VR-16) for consistency. Audited the rest of the suite for the same class of env-dependence (ambient GH_TOKEN/GITHUB_TOKEN, other hardcoded PATH fixtures) — none found. Evidence: fix committed+pushed as 726480c; CI run 29243955469 green on both matrix legs; release self-check Check 6 (CI ground-truth) now reads OK against main on re-run; npm test 1424/1424 locally, 0 regressions. Full writeup in qa_reports/review_T-E17-04-vr13-ci-fix.md.

