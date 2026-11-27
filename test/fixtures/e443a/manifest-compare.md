# Fan-out: e443a wave-compare fixture
base: abc1234    integration branch: integ/e443a-fixture
mailbox: ../lanes/_mailbox

Synthetic manifest for test/e443a-wave-compare.test.mjs (A1-4..A1-7), built from wave-table.md: TA and TB are
parallel in wave 1 there, and this manifest serialises them (lane lb's 相依 = la); TC depends on TA and lane lc
reaches la through 相依. Every 擁有 token is inside its ticket's allowed paths or is lane bookkeeping.

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | 波次 |
|---|---|---|---|---|---|---|---|---|
| la | TA | feat/la-fixture | ../lanes/la | `src/a.ts`、`src/a/**`、`src/a/x.ts`、`.current/la/**`、`qa_reports/`、`tasks.md` | `src/b.ts` | 做：a　不做：b | 無 | 1 |
| lb | TB | feat/lb-fixture | ../lanes/lb | `src/b.ts`、`review_reports/` | `src/a.ts` | 做：b　不做：a | la | 1 |
| lc | TC | feat/lc-fixture | ../lanes/lc | `src/c.ts`、`test/c-*.test.mjs`、`specs/lc-*.md` | `src/a.ts` | 做：c　不做：a | la | 2 |

## Dispatch pins
- la、lb、lc：無 pin。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | fixture approval | test fixture |
