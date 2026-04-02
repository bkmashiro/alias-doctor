import chalk from "chalk";
import type { AuditReport } from "./analyzer.js";

export interface JsonAuditReport {
  ghosts: Array<{ name: string; command: string; uses: number; status: string }>;
  healthy: Array<{ name: string; command: string; uses: number }>;
  suggestions: Array<{ command: string; count: number; suggestedName: string; conflicts: boolean }>;
}

export function formatReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push(chalk.bold("Ghost aliases (defined but never used in selected history window):"));
  if (report.ghosts.length === 0) {
    lines.push(`  ${chalk.green("None")}`);
  } else {
    for (const entry of report.ghosts) {
      const icon = entry.uses === 0 ? "💀" : "⚠";
      const colorize = entry.uses === 0 ? chalk.red : chalk.yellow;
      const useLabel = entry.uses === 1 ? "1 use" : `${entry.uses} uses`;
      lines.push(
        `  ${colorize(entry.alias.name)} = ${chalk.dim(JSON.stringify(entry.alias.command))}  ${useLabel}  ${icon}`
      );
    }
  }

  lines.push("");
  lines.push(chalk.bold("Suggested new aliases (typed repeatedly):"));
  if (report.suggestions.length === 0) {
    lines.push(`  ${chalk.green("None")}`);
  } else {
    for (const suggestion of report.suggestions) {
      const conflict = suggestion.conflicts ? chalk.yellow("  (check conflicts)") : "";
      lines.push(
        `  ${chalk.dim(JSON.stringify(suggestion.command))}  ${chalk.gray("->")}  typed ${suggestion.count}x  ${chalk.gray(
          "->"
        )}  try: ${chalk.cyan(`alias ${suggestion.suggestedName}=${JSON.stringify(suggestion.command)}`)}${conflict}`
      );
    }
  }

  lines.push("");
  lines.push(chalk.bold("Healthy aliases (used regularly):"));
  if (report.healthy.length === 0) {
    lines.push(`  ${chalk.yellow("None")}`);
  } else {
    for (const entry of report.healthy) {
      lines.push(
        `  ${chalk.green(entry.alias.name)} = ${chalk.dim(JSON.stringify(entry.alias.command))}  ${chalk.green(
          `✓ ${entry.uses} uses`
        )}`
      );
    }
  }

  return lines.join("\n");
}

export function toJsonReport(report: AuditReport): JsonAuditReport {
  return {
    ghosts: report.ghosts.map((entry) => ({
      name: entry.alias.name,
      command: entry.alias.command,
      uses: entry.uses,
      status: entry.status
    })),
    healthy: report.healthy.map((entry) => ({
      name: entry.alias.name,
      command: entry.alias.command,
      uses: entry.uses
    })),
    suggestions: report.suggestions.map((suggestion) => ({
      command: suggestion.command,
      count: suggestion.count,
      suggestedName: suggestion.suggestedName,
      conflicts: suggestion.conflicts
    }))
  };
}
