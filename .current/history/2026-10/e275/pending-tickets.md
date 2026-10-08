# Pending tickets — lane e275

## Applied

```pending-ticket
lane_local_id: E275-NEW-1
title: Dependency-advisory record — the 2026-10-07 residual note misstates the fast-uri / ip-address re-review triggers, which have already fired on moderate advisories; also tighten the proxy-addr "no source file contains express" wording
priority: P3
depends_on: [E275]
source: code-reviewer, lane e275 review (review_reports/review_T-E275-01.md, findings Q1 recommended / Q2 optional), 2026-10-08
body: |
  Q1: the 2026-10-07 note in docs/dependency-advisories.md "Out of scope: residual low/moderate findings"
  says the ip-address section's own trigger names promotion to HIGH as the re-check point. That is wrong:
  the fast-uri second-round trigger ("a new fast-uri advisory published against >=3.1.7") and the
  ip-address trigger ("a new ip-address advisory published against >=10.5.0") carry no severity limit,
  and read literally both have fired on the moderate advisories npm audit now reports against
  fast-uri 3.1.7 and ip-address 10.5.0 (already present at the e275 base, not introduced by E275).
  Deferring them is still right (the record is HIGH/CRITICAL-scoped and E275 was cut HIGH-only), but the
  note should say the triggers fired and the re-review is deferred, as the sharp third-round text does.
  The reviewer's report carries suggested rewording.
  Q2 (cosmetic): the proxy-addr section's reachability line says no source file contains `express`;
  a test comment does. "No runtime source file" is exact.
  Doc-only edit to docs/dependency-advisories.md; whether to also take the fired moderate re-reviews is a
  separate decision for whoever picks this up.
```
