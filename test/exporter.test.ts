import assert from "node:assert/strict";
import test from "node:test";
import { exportAliases } from "../src/exporter.js";
import type { AliasDefinition } from "../src/parser.js";

test("exportAliases renders bash and zsh alias syntax", () => {
  const aliases: AliasDefinition[] = [
    { name: "gs", command: "git status", line: 1 },
    { name: "ll", command: "ls -la", line: 2 }
  ];

  assert.equal(exportAliases(aliases, "bash"), "alias gs='git status'\nalias ll='ls -la'");
  assert.equal(exportAliases(aliases, "zsh"), "alias gs='git status'\nalias ll='ls -la'");
});

test("exportAliases renders fish abbr syntax", () => {
  const aliases: AliasDefinition[] = [{ name: "gp", command: "git push", line: 1 }];

  assert.equal(exportAliases(aliases, "fish"), "abbr --add gp 'git push'");
});
