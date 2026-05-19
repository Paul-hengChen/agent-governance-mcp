// Coded by @sr-engineer
// .current/.config.json migrations. Self-registers on import — call sites in
// tools/config.ts pull this module in for the side-effect.
import { CURRENT_VERSIONS, registerMigration } from "./versions.js";
// v0 → v1: pre-versioning configs simply lacked the `schema_version` key.
// No field rename, no value coercion — just stamp the version. Future
// migrations (v1→v2 etc.) would live below this one.
registerMigration({
    kind: "config",
    from: 0,
    to: 1,
    up: (input) => ({ ...input, schema_version: 1 }),
});
// Compile-time grep anchor: bumping CURRENT_VERSIONS.config without a matching
// registration triggers the runner's missing-step error at first read.
void CURRENT_VERSIONS.config;
//# sourceMappingURL=migrations-config.js.map