#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { Command } from "commander";
import { analyzeAliases, filterHistoryByDays } from "./analyzer.js";
import { formatReport, toJsonReport } from "./formatter.js";
import {
  detectShell,
  parseHistoryContents,
  parseRcContents,
  resolveDefaultPaths,
  type ShellType
} from "./parser.js";

interface CliOptions {
  rc?: string;
  history?: string;
  days: number;
  minUses: number;
  json?: boolean;
  shell?: ShellType;
}

const program = new Command();

program
  .name("alias-doctor")
  .description("Audit shell aliases to find ghosts and suggest new ones.")
  .option("--rc <path>", "Shell rc file (default: ~/.zshrc, auto-detects bash/zsh)")
  .option("--history <path>", "History file (default: ~/.zsh_history or ~/.bash_history)")
  .option("--days <n>", "Analyze last N days of history", parseInteger, 90)
  .option("--min-uses <n>", "Min uses to suggest alias", parseInteger, 5)
  .option("--json", "JSON output")
  .option("--shell <sh>", "Force shell type: zsh|bash")
  .action(run);

program.parseAsync(process.argv);

async function run(options: CliOptions): Promise<void> {
  const shell = detectShell(options.shell, options.rc, options.history);
  const defaults = resolveDefaultPaths(shell);
  const rcPath = options.rc ?? defaults.rcPath;
  const historyPath = options.history ?? defaults.historyPath;

  const [rcContents, historyContents] = await Promise.all([
    readTextFile(rcPath),
    readTextFile(historyPath)
  ]);

  if (!options.json) {
    process.stdout.write(`Reading ${rcPath} and ${historyPath}...\n\n`);
  }

  const aliases = parseRcContents(rcContents);
  const historyEntries = filterHistoryByDays(parseHistoryContents(historyContents), options.days);
  const report = analyzeAliases(aliases, historyEntries, options.minUses);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(toJsonReport(report), null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatReport(report)}\n`);
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${filePath}: ${message}`);
  }
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, received: ${value}`);
  }
  return parsed;
}
