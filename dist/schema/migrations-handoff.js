// Coded by @sr-engineer
// handoff.md YAML frontmatter migrations. Self-registers on import — call sites
// in tools/handoff.ts pull this module in for the side-effect.
import { CURRENT_VERSIONS, registerMigration } from "./versions.js";
// v0 → v1: pre-versioning handoffs simply lacked the `schema_version` key.
// No field rename, no value coercion — just stamp the version. Future
// migrations (v1→v2 etc.) would live below this one.
registerMigration({
    kind: "handoff",
    from: 0,
    to: 1,
    up: (input) => ({ ...input, schema_version: 1 }),
});
// Compile-time guard: if CURRENT_VERSIONS.handoff is ever bumped without a
// matching registration added above, the runner's missing-step error fires
// at read time. This reference makes the dependency explicit for grep.
void CURRENT_VERSIONS.handoff;
//# sourceMappingURL=migrations-handoff.js.map