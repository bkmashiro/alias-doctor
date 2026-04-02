import test from "node:test";
import assert from "node:assert/strict";
import { analyzeConflicts } from "../src/conflicts.js";
import type { AliasDefinition } from "../src/parser.js";

test("detects system shadows, alias shadowing, and duplicate targets", async () => {
  const aliases: AliasDefinition[] = [
    { name: "ll", command: "ls -la", line: 3 },
    { name: "g", command: "git", line: 5 },
    { name: "g", command: "grep", line: 9 },
    { name: "gs", command: "git status", line: 12 },
    { name: "gst", command: "git status", line: 18 }
  ];

  const report = await analyzeConflicts(aliases, {
    resolveCommandPath: async (name) => (name === "ll" ? "/usr/bin/ll" : undefined)
  });

  assert.deepEqual(report.systemShadows, [{ alias: aliases[0], commandPath: "/usr/bin/ll" }]);
  assert.deepEqual(report.aliasShadows, [{ name: "g", definitions: [aliases[1], aliases[2]] }]);
  assert.deepEqual(report.duplicateTargets, [{ command: "git status", aliases: [aliases[3], aliases[4]] }]);
});

test("returns empty sections when there are no conflicts", async () => {
  const aliases: AliasDefinition[] = [
    { name: "ga", command: "git add", line: 1 },
    { name: "gc", command: "git commit", line: 2 }
  ];

  const report = await analyzeConflicts(aliases, {
    resolveCommandPath: async () => undefined
  });

  assert.deepEqual(report, {
    systemShadows: [],
    aliasShadows: [],
    duplicateTargets: []
  });
});
