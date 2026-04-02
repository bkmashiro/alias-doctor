import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAliases } from "../src/analyzer.js";
import type { AliasDefinition, HistoryEntry } from "../src/parser.js";

test("ghost detection marks alias with zero uses as ghost", () => {
  const aliases: AliasDefinition[] = [{ name: "gs", command: "git status", line: 1 }];
  const history: HistoryEntry[] = [{ command: "git commit", raw: "git commit" }];

  const report = analyzeAliases(aliases, history, 5);

  assert.equal(report.ghosts.length, 1);
  assert.equal(report.ghosts[0]?.alias.name, "gs");
  assert.equal(report.ghosts[0]?.uses, 0);
});

test("suggests a repeated command that is not aliased", () => {
  const aliases: AliasDefinition[] = [{ name: "gc", command: "git commit", line: 1 }];
  const history: HistoryEntry[] = Array.from({ length: 10 }, () => ({
    command: "git status",
    raw: "git status"
  }));

  const report = analyzeAliases(aliases, history, 5);

  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.command, "git status");
  assert.equal(report.suggestions[0]?.count, 10);
});

test("does not suggest commands that are already aliased", () => {
  const aliases: AliasDefinition[] = [{ name: "gs", command: "git status", line: 1 }];
  const history: HistoryEntry[] = Array.from({ length: 10 }, () => ({
    command: "git status",
    raw: "git status"
  }));

  const report = analyzeAliases(aliases, history, 5);

  assert.equal(report.suggestions.length, 0);
});
