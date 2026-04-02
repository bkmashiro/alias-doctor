#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { Command } from "commander";
import { analyzeAliases, filterHistoryByDays } from "./analyzer.js";
import { exportAliases } from "./exporter.js";
import { formatReport, toJsonReport } from "./formatter.js";
import {
  detectShell,
  parseHistoryContents,
  parseRcContents,
  resolveDefaultPaths,
  type ExportShellType,
  type ShellType
} from "./parser.js";
import { analyzeSuggestions, formatSuggestions, maybeAppendSuggestions } from "./suggest.js";

interface CliOptions {
  rc?: string;
  history?: string;
  days: number;
  minUses: number;
  json?: boolean;
  shell?: ShellType;
  suggest?: boolean;
  export?: ExportShellType;
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
  .option("--suggest", "Analyze history and suggest new aliases")
  .option("--export <shell>", "Export aliases as bash|zsh|fish syntax")
  .action(run);

program.parseAsync(process.argv);

async function run(options: CliOptions): Promise<void> {
  if (options.suggest && options.export) {
    throw new Error("--suggest and --export cannot be used together");
  }

  const shell = detectShell(options.shell, options.rc, options.history);
  const defaults = resolveDefaultPaths(shell);
  const rcPath = options.rc ?? defaults.rcPath;
  const historyPath = options.history ?? defaults.historyPath;

  if (options.export) {
    const rcContents = await readTextFile(rcPath);
    const aliases = parseRcContents(rcContents);
    const output = exportAliases(aliases, options.export);
    process.stdout.write(output.length > 0 ? `${output}\n` : "");
    return;
  }

  if (options.suggest) {
    const [rcContents, historyContents] = await Promise.all([readTextFile(rcPath), readTextFile(historyPath)]);
    const aliases = parseRcContents(rcContents);
    const historyEntries = parseHistoryContents(historyContents);
    const suggestions = await analyzeSuggestions(aliases, historyEntries);

    process.stdout.write(`${formatSuggestions(historyPath, historyEntries.length, suggestions)}\n`);
    const appended = await maybeAppendSuggestions(rcPath, suggestions);
    if (appended) {
      process.stdout.write(`Added ${suggestions.filter((suggestion) => !suggestion.conflicts).length} aliases to ${rcPath}.\n`);
    }
    return;
  }

  const [rcContents, historyContents] = await Promise.all([readTextFile(rcPath), readTextFile(historyPath)]);

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
