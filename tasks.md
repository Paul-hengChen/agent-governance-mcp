# Tasks: phase7-task-storage-abstraction
<!-- feature_id: phase7-task-storage-abstraction | created_at: 2026-05-15 | created_by: @sr-engineer -->

## Active

- [x] T01 [P0] Extend HandoffStorage interface with task ops (listTasks / getNextTask / completeTask / rollbackTask / addTask) and split file logic into tools/tasks-file.ts | depends_on: none (note: storage.ts + tasks-file.ts; FileHandoffStorage delegates to file helpers)
- [x] T02 [P0] Refactor tools/tasks.ts as thin delegator to getActiveStorage() so test imports stay stable and SQLite mode is reachable | depends_on: T01 (note: tasks.ts now 4 exported functions delegating through storage adapter)
- [x] T03 [P0] Implement SQLite task table + addTask/listTasks/getNextTask/completeTask/rollbackTask in SqliteHandoffStorage with prepared statements | depends_on: T01 (note: tasks table, idx_tasks_workspace_order, atomic UPDATEs with completed-state guard)
- [x] T04 [P0] Rewrite tools/drift.ts to read tasks via getActiveStorage().listTasks() — no direct fs access | depends_on: T01, T03 (note: drift.ts now storage-only; works in SQLite mode without mounted workspace)
- [x] T05 [P1] Register tw_add_task tool (zod schema + pre-flight + dispatch) so PM can seed tasks in HTTP mode | depends_on: T01 (note: tw_add_task added in index.ts; AddTaskArgs limits id≤200, description≤2000)
- [x] T06 [P2] Update README (tool count 7→8, Phase 7 roadmap row) | depends_on: T05 (note: README tools table + roadmap updated)

## Completed

<!-- tw_complete_task will move items here -->
