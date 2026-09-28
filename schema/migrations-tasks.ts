// Coded by @sr-engineer
// tasks.md schema migrations. The on-disk version sentinel is a leading HTML
// comment (`<!-- schema_version: N -->`) prepended on line 1; the parser
// strips it before checkbox scanning. Self-registers on import.

import { CURRENT_VERSIONS, registerMigration } from "./versions.js";

// Payload envelope the runner sees: { schema_version, body } where `body` is
// the markdown after the sentinel was stripped (or the full file when no
// sentinel was present, i.e. v0).
export interface TasksPayload {
  schema_version?: number;
  body: string;
}

// v0 → v1: pre-versioning task lists had no sentinel comment. Stamp v1 and
// leave the body untouched — no checkbox-format change, just versioning.
registerMigration<TasksPayload, TasksPayload>({
  kind: "tasks",
  from: 0,
  to: 1,
  up: (input) => ({ schema_version: 1, body: input.body }),
});

// v1 → v2 (e125a spec AC3 / D-D): stamp only, body untouched. The MEANING of
// v2 is carried by WHICH PATH the file lives at: a v2 file at a legacy
// taskPaths location is a read-only index, a v1 file there is an unmigrated
// ledger, and `.current/<lane>/tasks.md` is the live ledger. That distinction
// lives in the tasks lane migration, not in this step. The bump also makes a
// pre-E125a server (max v1) refuse a v2 index loudly instead of writing to it.
registerMigration<TasksPayload, TasksPayload>({
  kind: "tasks",
  from: 1,
  to: 2,
  up: (input) => ({ schema_version: 2, body: input.body }),
});

// Compile-time grep anchor: bumping CURRENT_VERSIONS.tasks without a matching
// registration triggers the runner's missing-step error at first read.
void CURRENT_VERSIONS.tasks;
