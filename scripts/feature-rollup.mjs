#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the feature-level roll-up across lanes (E113). All
// logic lives in tools/feature-rollup.ts (compiled to
// dist/tools/feature-rollup.js) — this script only wires argv to it and prints
// the result, mirroring the existing scripts/summarize-metrics.mjs /
// scripts/smoke-rag.mjs pattern (plain Node ESM importing from
// dist/tools/*.js, zero script-level logic of its own).
//
// This is the manual entry point the coord-03-core-fallback.md "Feature-close
// roll-up obligation" points a PM/coordinator at before declaring a
// multi-lane feature closed. It is also the forward hook for the eventual
// `agc feature finish` (E130, Wave 7), which will call computeFeatureRollup /
// renderRollupReport directly instead of shelling out to this script.
//
// Usage: node scripts/feature-rollup.mjs <feature-id> [repo-root]
//        (repo-root defaults to the current working directory)

import { computeFeatureRollup, renderRollupReport } from "../dist/tools/feature-rollup.js";
import { laneRegistryList } from "../dist/tools/lane-registry.js";

const featureId = process.argv[2];
if (!featureId) {
  console.error("Usage: node scripts/feature-rollup.mjs <feature-id> [repo-root]");
  process.exit(1);
}

const repoRoot = process.argv[3] ?? process.cwd();

const report = computeFeatureRollup(featureId, { repoRoot, laneListProvider: laneRegistryList });
console.log(renderRollupReport(report));
