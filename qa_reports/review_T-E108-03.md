# QA review — T-E108-03

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-27T20:37:37.487Z — FAIL — by qa-engineer

FAIL — integrator-accepted AC5 clarification (spec commit 83ba1c3): agc eject --yes must state, when it edits or deletes a TRACKED host-trace file (tracked CLAUDE.md edited in place; tracked template-identical AGENTS.md/.antigravityrules deleted), that the change is uncommitted working-tree state for the user to review and commit. Verified live in two scratch git repos under $TMPDIR (HOME set to a separate temp dir): (A) whole-file delete of a tracked CLAUDE.md holding only the block, plus tracked AGENTS.md/.antigravityrules — git status shows ` D` on all three afterward, but no line in the printed output says so; (B) edit-in-place of a tracked CLAUDE.md with adopter prose — git status shows ` M CLAUDE.md`, again with no corresponding output line. The only related header note (\"untracked paths marked DELETE have no git recovery\") is gated on untrackedDelete, which is false or unset for every tracked host-trace path in both planClaudeBlockEntry and planAdapterFileEntry — so no note fires in either direction for a tracked file. Full detail in qa_reports/review_T-E108-01.md (covers: T-E108-01, T-E108-03). Did not add behaviour myself per dispatch instruction; routing to sr-engineer.

## 2026-09-27T21:01:38.829Z — PASS — by qa-engineer

QA round 2 PASS. Re-verified round-1 finding (AC5 tracked host-trace clarification, fix ceb3c4a) live against the real binary in scratch repos — Copy/Strings eject.tracked.host-trace-changed matches verbatim, both --yes and dry-run forms. Authored test/e108-eject.test.mjs (34 cases, AC1-AC25 + tracked host-trace cases A-D/G + both git-rm-line forms + boundary smoke) and one additive AC22 case in test/agc-adapters.test.mjs. AC23 verified by grep proof against docs/install.md. Full npm test on the clean committed tree (33c1d1e): 2888/2891 pass, 0 fail, 3 pre-existing unrelated skips, exit 0. Lane findings E108-NEW-1/E108-NEW-2 out of scope, unaffected.

