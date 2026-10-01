#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the feature-level roll-up across lanes (E113); all
// logic is in tools/feature-rollup.ts. It is the manual entry point that the
// "Feature-close roll-up obligation" in coord-03-core-fallback.md names
// before a multi-lane feature is closed; see specs/e260c-bin-scripts.md.
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
