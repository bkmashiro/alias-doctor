import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAliases, filterHistoryByDays } from "../src/analyzer.js";
import { suggestAliasName } from "../src/suggest.js";
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

test("tracks warning and healthy aliases, sorts them, and skips blank history commands", () => {
  const aliases: AliasDefinition[] = [
    { name: "b", command: "git branch", line: 1 },
    { name: "a", command: "git add", line: 2 },
    { name: "c", command: "git commit", line: 3 }
  ];
  const history: HistoryEntry[] = [
    { command: "git add", raw: "git add" },
    { command: "git commit", raw: "git commit" },
    { command: " git commit ", raw: " git commit " },
    { command: "   ", raw: "   " }
  ];

  const report = analyzeAliases(aliases, history, 2);

  assert.deepEqual(
    report.aliases.map((entry) => ({ name: entry.alias.name, uses: entry.uses, status: entry.status })),
    [
      { name: "b", uses: 0, status: "ghost" },
      { name: "a", uses: 1, status: "warning" },
      { name: "c", uses: 2, status: "healthy" }
    ]
  );
  assert.deepEqual(report.ghosts.map((entry) => entry.alias.name), ["b", "a"]);
  assert.deepEqual(report.healthy.map((entry) => entry.alias.name), ["c"]);
});

test("flags suggestion name conflicts and orders suggestions by count", () => {
  const aliases: AliasDefinition[] = [{ name: "gs", command: "git status", line: 1 }];
  const history: HistoryEntry[] = [
    ...Array.from({ length: 3 }, () => ({ command: "git show", raw: "git show" })),
    ...Array.from({ length: 5 }, () => ({ command: "npm test", raw: "npm test" }))
  ];

  const report = analyzeAliases(aliases, history, 3);

  assert.deepEqual(report.suggestions, [
    { command: "npm test", count: 5, suggestedName: "nt", conflicts: false },
    { command: "git show", count: 3, suggestedName: "gs", conflicts: true }
  ]);
});

test("filterHistoryByDays drops entries older than the cutoff but keeps undated entries", () => {
  const now = Date.UTC(2026, 0, 10);
  const oneDayAgoSeconds = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);
  const threeDaysAgoSeconds = Math.floor((now - 3 * 24 * 60 * 60 * 1000) / 1000);

  const filtered = filterHistoryByDays(
    [
      { command: "recent", timestamp: oneDayAgoSeconds, raw: "recent" },
      { command: "old", timestamp: threeDaysAgoSeconds, raw: "old" },
      { command: "plain", raw: "plain" }
    ],
    2,
    now
  );

  assert.deepEqual(filtered, [
    { command: "recent", timestamp: oneDayAgoSeconds, raw: "recent" },
    { command: "plain", raw: "plain" }
  ]);
});

test("suggestAliasName uses the first alphanumeric character from each word", () => {
  assert.equal(suggestAliasName("!!!"), "cmd");
  assert.equal(suggestAliasName("~/projects/alias-doctor"), "p");
  assert.equal(suggestAliasName("/usr/local/bin/node"), "u");
  assert.equal(suggestAliasName("docker compose up"), "dcu");
  assert.equal(suggestAliasName("git checkout -b"), "gcb");
});
