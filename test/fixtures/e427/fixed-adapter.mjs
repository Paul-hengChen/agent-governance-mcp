// Fixture adapter for test/e427-check-scenario-tests.test.mjs (AC11): another project's readResults.
// It never opens resultsPath, so the checker exiting 0 proves it used this adapter and parsed no XML.

export function readResults(_resultsPath) {
  return [{ file: "spec/fixed.spec.js", title: "fixed suite > fixed title", status: "passed" }];
}
