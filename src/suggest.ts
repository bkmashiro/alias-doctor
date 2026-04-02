import { appendFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AliasDefinition, HistoryEntry } from "./parser.js";

const execFileAsync = promisify(execFile);

export interface SuggestedAlias {
  command: string;
  count: number;
  suggestedName: string;
  conflicts: boolean;
}

export interface SuggestOptions {
  minFrequency?: number;
  minCommandLength?: number;
  commandExists?: (name: string) => Promise<boolean>;
}

export async function analyzeSuggestions(
  aliases: AliasDefinition[],
  historyEntries: HistoryEntry[],
  options: SuggestOptions = {}
): Promise<SuggestedAlias[]> {
  const minFrequency = options.minFrequency ?? 10;
  const minCommandLength = options.minCommandLength ?? 8;
  const commandExists = options.commandExists ?? commandExistsOnPath;
  const commandCounts = new Map<string, number>();

  for (const entry of historyEntries) {
    const command = entry.command.trim();
    if (!command) {
      continue;
    }

    commandCounts.set(command, (commandCounts.get(command) ?? 0) + 1);
  }

  const aliasedCommands = new Set(aliases.map((alias) => alias.command));
  const aliasNames = new Set(aliases.map((alias) => alias.name));
  const candidates = [...commandCounts.entries()]
    .filter(([command, count]) => count >= minFrequency && command.length > minCommandLength && !aliasedCommands.has(command))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  const suggestions = await Promise.all(
    candidates.map(async ([command, count]) => {
      const suggestedName = suggestAliasName(command);
      const conflicts = aliasNames.has(suggestedName) || (await commandExists(suggestedName));

      return {
        command,
        count,
        suggestedName,
        conflicts
      };
    })
  );

  return suggestions;
}

export function suggestAliasName(command: string): string {
  const name = command
    .split(/\s+/)
    .map((segment) => segment.match(/[A-Za-z0-9]/)?.[0] ?? "")
    .join("")
    .toLowerCase();

  return name || "cmd";
}

export function formatSuggestions(historyPath: string, historyCount: number, suggestions: SuggestedAlias[]): string {
  const lines = [`Analyzing ${historyPath} (${historyCount.toLocaleString()} commands)...`, ""];

  lines.push("Suggested new aliases (commands you type 10+ times):");
  if (suggestions.length === 0) {
    lines.push("  None");
    return lines.join("\n");
  }

  for (const suggestion of suggestions) {
    const conflict = suggestion.conflicts ? "  (conflict detected)" : "";
    lines.push(
      `  ${suggestion.command.padEnd(20)} -> typed ${suggestion.count}x  -> alias ${suggestion.suggestedName}='${suggestion.command}'${conflict}`
    );
  }

  return lines.join("\n");
}

export async function maybeAppendSuggestions(rcPath: string, suggestions: SuggestedAlias[]): Promise<boolean> {
  const appendable = suggestions.filter((suggestion) => !suggestion.conflicts);
  if (appendable.length === 0 || !stdin.isTTY || !stdout.isTTY) {
    return false;
  }

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const answer = await readline.question(`\nAdd to ${rcPath}? [y/n] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      return false;
    }
  } finally {
    readline.close();
  }

  const aliasLines = appendable.map((suggestion) => `alias ${suggestion.suggestedName}='${escapeSingleQuotes(suggestion.command)}'`);
  const content = `\n# Added by alias-doctor\n${aliasLines.join("\n")}\n`;
  await appendFile(rcPath, content, "utf8");
  return true;
}

async function commandExistsOnPath(name: string): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-lc", `command -v ${name} >/dev/null 2>&1`]);
    return true;
  } catch {
    return false;
  }
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, `'\\''`);
}
