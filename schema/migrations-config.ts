// Coded by @sr-engineer
// .current/.config.json migrations. Self-registers on import — call sites in
// tools/config.ts pull this module in for the side-effect.

import { CURRENT_VERSIONS, registerMigration } from "./versions.js";

// v0 → v1: pre-versioning configs simply lacked the `schema_version` key.
// No field rename, no value coercion — just stamp the version.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "config",
  from: 0,
  to: 1,
  up: (input) => ({ ...input, schema_version: 1 }),
});

// v1 → v2: introduces the optional `artifacts` key ("local" | "repo"), the
// adopter's declared choice of whether governance runtime artifacts are kept
// out of git or tracked. Stamp-only on purpose: an absent key means the
// workspace never declared a choice, and seeding "local" here would fabricate
// a declaration — `agc check` relies on absence to tell the user to choose.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "config",
  from: 1,
  to: 2,
  up: (input) => ({ ...input, schema_version: 2 }),
});

// Compile-time grep anchor: bumping CURRENT_VERSIONS.config without a matching
// registration triggers the runner's missing-step error at first read.
void CURRENT_VERSIONS.config;
