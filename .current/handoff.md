---
schema_version: 13
active_feature: "e51-skill-render-strip-parity"
status: "In_Progress"
last_updated: "2026-08-11T09:36:06.067Z"
last_agent: "pm"
prd_path: "/Users/paul.ph.chen/agent-governance-mcp/docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "E51 (backlog order 3, post-v3.96.0 table amended 2026-08-11). Backlog row IS the spec -> mini-chain sr-engineer -> code-reviewer -> qa-engineer, PM/ARCH skipped (E35-E38/E44-E49/E50 pattern). Defect verified in source: prompts/build.ts:391 stripOriginTags(taggedBody) + :397 fullDetail ? rawBody : stripRationale(rawBody); tools/role.ts:94 parseSkillFile(expandPartials(raw,loadFile)) returns body raw at :109, no strip. Both paths already share composeSkill -> expandPartials -> parseSkillFile. FOUR DECISIONS PINNED by coordinator boundary read; do not re-litigate: (1) shared helper in NEW prompts/text-transforms.ts, called by both AFTER parseSkillFile - NOT relocated into composeSkill/expandPartials, which sees frontmatter (build.ts:389: origin fences live in body prose, never YAML) and must not know fullDetail; (2) build.ts must RE-EXPORT stripRationale/stripOriginTags - ~40 call sites in test/context-budget.test.mjs + scripts/measure-context-cost.mjs import them from dist/prompts/build.js and Constitution section 2 bars sr from test logic, so re-export = zero test churn; (3) tools/role.ts gets non-fullDetail semantics (strip both) - tw_switch_role is the dispatch path and the acting agent is exactly who the markers are hidden from; (4) bin/agent-governance-context.mjs is a THIRD unstripped path, OUT OF SCOPE: non-stripping there is deliberate DR-2/DR-3 single-copy design (build.ts:80-82, :105-107), so revisiting it is a separate row. Comments falsified by this change, in scope for T-E51-01: build.ts:81, build.ts:106, tools/role.ts:89-92. AC: (1) no origin/rationale marker in tw_switch_role output for any ROLE_SKILL_MAP role; (2) all 8 test/fixtures/compose-golden/* byte-identical (pure refactor on the build path); (3) both strippers still importable from dist/prompts/build.js; (4) 1633/1633 green + new strip-parity tests; (5) hook untouched. Human approved inline 2026-08-11; auto-tier N/A (P2 over maxPriority P3, 3 files over maxFiles 2)."
dispatch_pins:
  sr-engineer: "fable"
  release-engineer: "opus"
evidence_schema: 2
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 5
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- PM intake pass complete (2026-08-11, post-v3.97.1), docs/backlog.md only: nothing implemented, no cut approved, no active_feature change, tasks.md untouched at zero open tasks. This is the E55-recommended post-release intake step, dispatched deliberately rather than remembered.
- Filed E56 (P3): governance-text-load-architecture DR-2 misdescribes production after E51 - satisfies its decision (one implementation) but falsifies its premise (one production call-site). Batched into execution order 6 with E39+E48(b) for CONTEXT only, with an explicit warning NOT to point the mirror sync check at it: DR-2 is a dated design record that is supposed to describe the past, so the fix is one amendment paragraph written once, not ongoing machinery.
- Filed E57 (P2, inserted at execution order 5 - ahead of the doc/mirror tail): five standing HIGH npm advisories (sharp<-libvips CVE-2026-33327/33328/35590, @xenova/transformers<-sharp, fast-uri, ip-address, js-yaml). Every per-release waiver was individually correct (no cut introduced them) but that has been the standing answer for several consecutive releases - the accretion pattern exemptions.count exists to make visible. Deliverable is a decision record per advisory, not necessarily code. js-yaml parses every handoff.md and is still flagged at 4.2.0, so no routine bump clears it; the sharp/@xenova chain is worth a stdio-mode reachability check first, since dropping it would close three of five.
- Folded the third dated instance into E52 rather than filing new: v3.97.1 emitted review_rounds:0 for a feature with one review round. Three instances now pin the actual mechanism, beyond the earlier off-by-one framing - the counter increments ONLY on a code-reviewer FAIL, so an APPROVED round is never counted at all. A clean one-pass feature always reports zero, making 'needed least review' and 'got none' indistinguishable. Strengthens option (ii) and narrows the open architect question to one thing: does anything read the emitted value as the live gate counter?
- NOT filed, deliberately: the mid-session node_modules prune (js-yaml missing, npm ls empty, package.json/lock unchanged in git, repaired with npm ci). One unexplained environment event with no reproduction does not warrant a ticket - the same 'infra ahead of evidence' reasoning E55 used to reject its own option (iii). Recorded inside E57's row so a second occurrence has a first data point to join.
- Next up: E53 (order 4, P2) - release-engineer:Blocked unreachable in ALLOWED_TRANSITIONS, plus the recommended audit of every other role's :Blocked reachability in the same pass. Does not clear auto-tier (P2), so its cut needs a human nod.

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
