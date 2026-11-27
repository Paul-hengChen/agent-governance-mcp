# Fan-out: e443a batch-render fixture
base: abc1234    integration branch: integ/e443a-fixture
mailbox: ../lanes/_mailbox

Synthetic manifest for test/e443a-batch-render.test.mjs (A1-9..A1-11). 8-column Lanes table, so batch render is
tested on its own. Lane lx holds two tickets that have ticket files; lane ly names a ticket with no ticket file;
lane lz's 票 cell names no ticket id.

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| lx | TX1、TX2 | feat/lx-batch | ../lanes/lx | `src/x.ts`、`test/x.test.mjs` | `src/y.ts` | 做：x　不做：y | 無 |
| ly | TY | feat/ly-batch | ../lanes/ly | `src/y.ts` | `src/x.ts` | 做：y　不做：x | 無 |
| lz | 、 | feat/lz-batch | ../lanes/lz | `src/z.ts` | `src/x.ts` | 做：z　不做：x | 無 |

## Dispatch pins
- lx：`sr-engineer=opus`。
- ly、lz：無 pin。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | fixture approval | test fixture |
