// Coded by @sr-engineer
// tasks.md schema migrations. The on-disk version sentinel is a leading HTML
// comment (`<!-- schema_version: N -->`) prepended on line 1; the parser
// strips it before checkbox scanning. Self-registers on import.
import { CURRENT_VERSIONS, registerMigration } from "./versions.js";
// v0 → v1: pre-versioning task lists had no sentinel comment. Stamp v1 and
// leave the body untouched — no checkbox-format change, just versioning.
registerMigration({
    kind: "tasks",
    from: 0,
    to: 1,
    up: (input) => ({ schema_version: 1, body: input.body }),
});
// Compile-time grep anchor: bumping CURRENT_VERSIONS.tasks without a matching
// registration triggers the runner's missing-step error at first read.
void CURRENT_VERSIONS.tasks;
//# sourceMappingURL=migrations-tasks.js.map