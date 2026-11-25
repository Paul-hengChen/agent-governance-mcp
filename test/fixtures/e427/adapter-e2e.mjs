// Fixture test file for test/e427-scenario-results-node.test.mjs (AC10). Never run by the suite glob
// test/*.test.mjs: it deliberately holds a skipped, a todo and a failing test.

import { test, describe } from "node:test";

describe("outer", () => {
  describe("inner", () => {
    test("leaf", () => {});
  });
});

test("skipped one", { skip: true }, () => {});

test("todo one", { todo: true }, () => {});

test("failing one", () => {
  throw new Error("deliberate failure");
});

test("parent", async (t) => {
  await t.test("child", () => {});
});
