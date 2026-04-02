import test from "node:test";
import assert from "node:assert/strict";
import { parseHistoryContents, parseRcContents } from "../src/parser.js";

test("parses alias with double quotes", () => {
  const aliases = parseRcContents('alias foo="bar"\n');
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0]?.name, "foo");
  assert.equal(aliases[0]?.command, "bar");
});

test("parses alias with single quotes", () => {
  const aliases = parseRcContents("alias foo='bar'\n");
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0]?.command, "bar");
});

test("parses alias with no quotes", () => {
  const aliases = parseRcContents("alias foo=bar\n");
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0]?.command, "bar");
});

test("parses zsh history format", () => {
  const entries = parseHistoryContents(": 1712345678:0;git status\n");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.timestamp, 1712345678);
  assert.equal(entries[0]?.command, "git status");
});

test("parses plain bash history format", () => {
  const entries = parseHistoryContents("ls -la\n");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.timestamp, undefined);
  assert.equal(entries[0]?.command, "ls -la");
});
