import type { AliasDefinition, HistoryEntry } from "./parser.js";

export interface AliasUsage {
  alias: AliasDefinition;
  uses: number;
  status: "ghost" | "warning" | "healthy";
}

export interface SuggestedAlias {
  command: string;
  count: number;
  suggestedName: string;
  conflicts: boolean;
}

export interface AuditReport {
  aliases: AliasUsage[];
  ghosts: AliasUsage[];
  healthy: AliasUsage[];
  suggestions: SuggestedAlias[];
  historyWindowStart?: number;
}

export function filterHistoryByDays(entries: HistoryEntry[], days: number, now = Date.now()): HistoryEntry[] {
  const cutoffSeconds = Math.floor((now - days * 24 * 60 * 60 * 1000) / 1000);
  return entries.filter((entry) => entry.timestamp === undefined || entry.timestamp >= cutoffSeconds);
}

export function analyzeAliases(
  aliases: AliasDefinition[],
  historyEntries: HistoryEntry[],
  minUses: number
): AuditReport {
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

  const aliasesWithUsage = aliases
    .map<AliasUsage>((alias) => {
      const uses = commandCounts.get(alias.command) ?? 0;
      const status = uses === 0 ? "ghost" : uses <= 1 ? "warning" : "healthy";
      return { alias, uses, status };
    })
    .sort((left, right) => left.uses - right.uses || left.alias.name.localeCompare(right.alias.name));

  const suggestions = [...commandCounts.entries()]
    .filter(([command, count]) => count >= minUses && !aliasedCommands.has(command))
    .map<SuggestedAlias>(([command, count]) => {
      const suggestedName = suggestAliasName(command);
      return {
        command,
        count,
        suggestedName,
        conflicts: aliasNames.has(suggestedName)
      };
    })
    .sort((left, right) => right.count - left.count || left.command.localeCompare(right.command));

  return {
    aliases: aliasesWithUsage,
    ghosts: aliasesWithUsage.filter((aliasUsage) => aliasUsage.status !== "healthy"),
    healthy: aliasesWithUsage.filter((aliasUsage) => aliasUsage.status === "healthy"),
    suggestions
  };
}

export function suggestAliasName(command: string): string {
  const segments = command
    .split(/\s+/)
    .map((segment) => segment.replace(/[^A-Za-z0-9/_-]/g, ""))
    .filter(Boolean);

  if (segments.length === 0) {
    return "cmd";
  }

  const joined = segments
    .slice(0, 3)
    .map((segment) => {
      if (segment.startsWith("~/")) {
        return segment.slice(2, 5);
      }

      if (segment.includes("/")) {
        const part = segment.split("/").filter(Boolean).at(-1) ?? segment;
        return part.slice(0, 3);
      }

      return segment.slice(0, segment.length <= 3 ? segment.length : 1);
    })
    .join("")
    .toLowerCase();

  return joined || "cmd";
}
