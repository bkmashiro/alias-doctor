import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AliasDefinition {
  name: string;
  command: string;
  line: number;
}

export interface HistoryEntry {
  command: string;
  timestamp?: number;
  raw: string;
}

const ALIAS_PATTERN = /^\s*alias\s+([A-Za-z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|([^\s#]+))(?:\s+#.*)?\s*$/;
const ZSH_HISTORY_PATTERN = /^:\s*(\d+):\d+;(.*)$/;

export async function parseRcFile(filePath: string): Promise<AliasDefinition[]> {
  const contents = await fs.readFile(filePath, "utf8");
  return parseRcContents(contents);
}

export function parseRcContents(contents: string): AliasDefinition[] {
  const aliases: AliasDefinition[] = [];
  const lines = contents.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const match = line.match(ALIAS_PATTERN);
    if (!match) {
      continue;
    }

    const [, name, doubleQuoted, singleQuoted, bare] = match;
    aliases.push({
      name,
      command: doubleQuoted ?? singleQuoted ?? bare ?? "",
      line: index + 1
    });
  }

  return aliases;
}

export async function parseHistoryFile(filePath: string): Promise<HistoryEntry[]> {
  const contents = await fs.readFile(filePath, "utf8");
  return parseHistoryContents(contents);
}

export function parseHistoryContents(contents: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const zshMatch = line.match(ZSH_HISTORY_PATTERN);
    if (zshMatch) {
      entries.push({
        command: zshMatch[2].trim(),
        timestamp: Number(zshMatch[1]),
        raw: line
      });
      continue;
    }

    entries.push({
      command: line.trim(),
      raw: line
    });
  }

  return entries;
}

export type ShellType = "zsh" | "bash";
export type ExportShellType = ShellType | "fish";

export function detectShell(shellArg?: string, rcPath?: string, historyPath?: string): ShellType {
  if (shellArg === "zsh" || shellArg === "bash") {
    return shellArg;
  }

  const shellHints = [rcPath, historyPath, process.env.SHELL]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (shellHints.some((value) => value.includes("bash"))) {
    return "bash";
  }

  return "zsh";
}

export function resolveDefaultPaths(shell: ShellType): { rcPath: string; historyPath: string } {
  const homeDir = os.homedir();
  const rcPath = shell === "bash" ? ".bashrc" : ".zshrc";
  const historyPath = shell === "bash" ? ".bash_history" : ".zsh_history";

  return {
    rcPath: path.join(homeDir, rcPath),
    historyPath: path.join(homeDir, historyPath)
  };
}
