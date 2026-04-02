import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHealth } from "../src/health.js";
import type { AliasDefinition, HistoryEntry } from "../src/parser.js";

test("computes health score from unused aliases, conflicts, duplicates, and suggestion usage", async () => {
  const now = Date.UTC(2026, 3, 2);
  const recentTimestamp = Math.floor((now - 5 * 24 * 60 * 60 * 1000) / 1000);
  const staleTimestamp = Math.floor((now - 40 * 24 * 60 * 60 * 1000) / 1000);

  const aliases: AliasDefinition[] = [
    { name: "gs", command: "git status", line: 1 },
    { name: "ll", command: "ls -la", line: 2 },
    { name: "g", command: "git", line: 3 },
    { name: "g", command: "grep", line: 4 },
    { name: "gst", command: "git status", line: 5 }
  ];
  const history: HistoryEntry[] = [
    { command: "git status", timestamp: recentTimestamp, raw: "git status" },
    { command: "ls -la", timestamp: staleTimestamp, raw: "ls -la" }
  ];

  const report = await analyzeHealth(aliases, history, {
    resolveCommandPath: async (name) => (name === "ll" ? "/usr/bin/ll" : undefined),
    now
  });

  assert.equal(report.totalAliases, 5);
  assert.equal(report.unusedAliases, 3);
  assert.equal(report.conflicts, 2);
  assert.equal(report.duplicates, 1);
  assert.equal(report.suggestionsUsed, 4);
  assert.equal(report.score, 55);
  assert.equal(report.grade, "F");
  assert.equal(report.recommendation, "Remove 3 unused aliases to reach A grade.");
});

test("awards an A when aliases are active and conflict free", async () => {
  const now = Date.UTC(2026, 3, 2);
  const recentTimestamp = Math.floor((now - 2 * 24 * 60 * 60 * 1000) / 1000);
  const aliases: AliasDefinition[] = [
    { name: "gs", command: "git status", line: 1 },
    { name: "gc", command: "git commit", line: 2 }
  ];
  const history: HistoryEntry[] = [
    { command: "git status", timestamp: recentTimestamp, raw: "git status" },
    { command: "git commit", timestamp: recentTimestamp, raw: "git commit" }
  ];

  const report = await analyzeHealth(aliases, history, {
    resolveCommandPath: async () => undefined,
    now
  });

  assert.equal(report.unusedAliases, 0);
  assert.equal(report.conflicts, 0);
  assert.equal(report.duplicates, 0);
  assert.equal(report.suggestionsUsed, 2);
  assert.equal(report.score, 100);
  assert.equal(report.grade, "A");
});
