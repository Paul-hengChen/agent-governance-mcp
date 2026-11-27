# Fan-out: e443a eight-column fixture
base: abc1234    integration branch: integ/e443a-fixture
mailbox: ../lanes/_mailbox

Synthetic pre-ticket manifest for test/e443a-wave-columns.test.mjs (A1-3): the 8-column Lanes header, no 波次
column, so 相依 stays free text — lane lb's 相依 cell is prose, which must still validate.

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| la | TA | feat/la-fixture | ../lanes/la | `src/a.ts` | `src/b.ts` | 做：a　不做：b | 無 |
| lb | TB | feat/lb-fixture | ../lanes/lb | `src/b.ts` | `src/a.ts` | 做：b　不做：a | la merged first — then rebase |

## Dispatch pins
- la、lb：無 pin。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | fixture approval | test fixture |
