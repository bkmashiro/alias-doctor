import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import {
  detectShell,
  parseHistoryContents,
  parseHistoryFile,
  parseRcContents,
  parseRcFile,
  resolveDefaultPaths
} from "../src/parser.js";

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

test("ignores non-alias lines and preserves alias line numbers", () => {
  const aliases = parseRcContents("# comment\nexport FOO=bar\nalias gs='git status' # trailing comment\n");

  assert.deepEqual(aliases, [{ name: "gs", command: "git status", line: 3 }]);
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

test("skips blank history lines and trims commands", () => {
  const entries = parseHistoryContents("\n  \n: 1712345678:0;  git status  \n  ls -la  \n");

  assert.deepEqual(entries, [
    { command: "git status", timestamp: 1712345678, raw: ": 1712345678:0;  git status  " },
    { command: "ls -la", raw: "  ls -la  " }
  ]);
});

test("reads aliases from a file", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "alias-doctor-"));
  const rcPath = path.join(tempDir, "test.rc");

  try {
    await writeFile(rcPath, "alias ga='git add'\n", "utf8");

    const aliases = await parseRcFile(rcPath);

    assert.deepEqual(aliases, [{ name: "ga", command: "git add", line: 1 }]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("reads history from a file", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "alias-doctor-"));
  const historyPath = path.join(tempDir, "history");

  try {
    await writeFile(historyPath, "git status\n", "utf8");

    const entries = await parseHistoryFile(historyPath);

    assert.deepEqual(entries, [{ command: "git status", raw: "git status" }]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("detectShell prefers an explicit shell argument", () => {
  assert.equal(detectShell("bash", "/tmp/.zshrc", "/tmp/.zsh_history"), "bash");
  assert.equal(detectShell("zsh", "/tmp/.bashrc", "/tmp/.bash_history"), "zsh");
});

test("detectShell infers bash from rc path, history path, or SHELL env", () => {
  assert.equal(detectShell(undefined, "/tmp/.bashrc"), "bash");
  assert.equal(detectShell(undefined, undefined, "/tmp/.bash_history"), "bash");

  const originalShell = process.env.SHELL;
  process.env.SHELL = "/bin/bash";

  try {
    assert.equal(detectShell(), "bash");
  } finally {
    if (originalShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = originalShell;
    }
  }
});

test("detectShell defaults to zsh when no bash hints are present", () => {
  const originalShell = process.env.SHELL;
  delete process.env.SHELL;

  try {
    assert.equal(detectShell(undefined, "/tmp/.zshrc", "/tmp/.zsh_history"), "zsh");
    assert.equal(detectShell(), "zsh");
  } finally {
    if (originalShell !== undefined) {
      process.env.SHELL = originalShell;
    }
  }
});

test("resolveDefaultPaths returns shell-specific files in the home directory", () => {
  const home = os.homedir();

  assert.deepEqual(resolveDefaultPaths("bash"), {
    rcPath: path.join(home, ".bashrc"),
    historyPath: path.join(home, ".bash_history")
  });
  assert.deepEqual(resolveDefaultPaths("zsh"), {
    rcPath: path.join(home, ".zshrc"),
    historyPath: path.join(home, ".zsh_history")
  });
});
