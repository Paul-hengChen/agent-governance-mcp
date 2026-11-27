# Fan-out: e443a wave-column fixture
base: abc1234    integration branch: integ/e443a-fixture
mailbox: ../lanes/_mailbox

Synthetic manifest for test/e443a-wave-columns.test.mjs (A1-1, A1-2): a Lanes table with the 波次 column right
after 相依 (header shape 3). Waves are integers; every 相依 cell is 無 or names lanes of the same or an earlier
wave, written with each separator the format accepts (`, ` / `、` / `，`).

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | 波次 |
|---|---|---|---|---|---|---|---|---|
| la | TA | feat/la-fixture | ../lanes/la | `src/a.ts`、`.current/la/**` | `src/b.ts` | 做：a　不做：b | 無 | 1 |
| lb | TB | feat/lb-fixture | ../lanes/lb | `src/b.ts` | `src/a.ts` | 做：b　不做：a | 無 | 1 |
| lc | TC | feat/lc-fixture | ../lanes/lc | `src/c.ts` | `src/a.ts` | 做：c　不做：a | la, lb | 2 |
| ld | TD | feat/ld-fixture | ../lanes/ld | `src/d.ts` | `src/a.ts` | 做：d　不做：a | la、lc | 2 |
| le | TE | feat/le-fixture | ../lanes/le | `src/e.ts` | `src/a.ts` | 做：e　不做：a | lb，ld | 3 |

## Dispatch pins
- la、lb、lc、ld、le：無 pin。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | fixture approval | test fixture |
