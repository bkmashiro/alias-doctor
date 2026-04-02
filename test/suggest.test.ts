import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSuggestions, formatSuggestions } from "../src/suggest.js";
import type { AliasDefinition, HistoryEntry } from "../src/parser.js";

test("analyzeSuggestions filters by frequency, length, alias coverage, and command conflicts", async () => {
  const aliases: AliasDefinition[] = [{ name: "gs", command: "git status", line: 1 }];
  const history: HistoryEntry[] = [
    ...Array.from({ length: 12 }, () => ({ command: "git checkout -b", raw: "git checkout -b" })),
    ...Array.from({ length: 11 }, () => ({ command: "kubectl get pods", raw: "kubectl get pods" })),
    ...Array.from({ length: 15 }, () => ({ command: "git status", raw: "git status" })),
    ...Array.from({ length: 10 }, () => ({ command: "short", raw: "short" }))
  ];

  const suggestions = await analyzeSuggestions(aliases, history, {
    commandExists: async (name) => name === "kgp"
  });

  assert.deepEqual(suggestions, [
    { command: "git checkout -b", count: 12, suggestedName: "gcb", conflicts: false },
    { command: "kubectl get pods", count: 11, suggestedName: "kgp", conflicts: true }
  ]);
});

test("formatSuggestions prints the history path, total count, and alias commands", () => {
  const formatted = formatSuggestions("/tmp/.bash_history", 2341, [
    { command: "git checkout -b", count: 47, suggestedName: "gcb", conflicts: false }
  ]);

  assert.match(formatted, /Analyzing \/tmp\/\.bash_history \(2,341 commands\)\.\.\./);
  assert.match(formatted, /git checkout -b/);
  assert.match(formatted, /alias gcb='git checkout -b'/);
});
