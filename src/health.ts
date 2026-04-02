import { filterHistoryByDays } from "./analyzer.js";
import { analyzeConflicts, type AliasConflictReport, type ConflictOptions } from "./conflicts.js";
import type { AliasDefinition, HistoryEntry } from "./parser.js";
import { suggestAliasName } from "./suggest.js";

const UNUSED_WINDOW_DAYS = 30;
const MAX_SCORE = 100;
const UNUSED_PENALTY = 10;
const CONFLICT_PENALTY = 15;
const DUPLICATE_PENALTY = 5;
const SUGGESTION_BONUS = 5;

export interface AliasHealthReport {
  totalAliases: number;
  unusedAliases: number;
  conflicts: number;
  duplicates: number;
  suggestionsUsed: number;
  score: number;
  grade: string;
  recommendation: string;
  conflictReport: AliasConflictReport;
}

export async function analyzeHealth(
  aliases: AliasDefinition[],
  historyEntries: HistoryEntry[],
  options: ConflictOptions & { now?: number } = {}
): Promise<AliasHealthReport> {
  const recentHistory = filterHistoryByDays(historyEntries, UNUSED_WINDOW_DAYS, options.now ?? Date.now());
  const commandCounts = new Map<string, number>();

  for (const entry of recentHistory) {
    const command = entry.command.trim();
    if (!command) {
      continue;
    }
    commandCounts.set(command, (commandCounts.get(command) ?? 0) + 1);
  }

  const unusedAliases = aliases.filter((alias) => (commandCounts.get(alias.command) ?? 0) === 0).length;
  const suggestionsUsed = aliases.filter((alias) => alias.name === suggestAliasName(alias.command)).length;
  const conflictReport = await analyzeConflicts(aliases, options);
  const conflicts = conflictReport.systemShadows.length + conflictReport.aliasShadows.length;
  const duplicates = conflictReport.duplicateTargets.length;

  const rawScore =
    MAX_SCORE -
    unusedAliases * UNUSED_PENALTY -
    conflicts * CONFLICT_PENALTY -
    duplicates * DUPLICATE_PENALTY +
    suggestionsUsed * SUGGESTION_BONUS;
  const score = Math.max(0, Math.min(MAX_SCORE, rawScore));
  const grade = scoreToGrade(score);
  const recommendation = buildRecommendation(unusedAliases, conflicts, duplicates, grade);

  return {
    totalAliases: aliases.length,
    unusedAliases,
    conflicts,
    duplicates,
    suggestionsUsed,
    score,
    grade,
    recommendation,
    conflictReport
  };
}

export function formatHealthReport(report: AliasHealthReport): string {
  return [
    "Alias Health Report",
    "",
    `Total aliases: ${report.totalAliases}`,
    `Unused (30+ days): ${report.unusedAliases}  (-10 points each = -${report.unusedAliases * UNUSED_PENALTY})`,
    `Conflicts: ${report.conflicts}  (-15 points each = -${report.conflicts * CONFLICT_PENALTY})`,
    `Duplicates: ${report.duplicates}  (-5 points each = -${report.duplicates * DUPLICATE_PENALTY})`,
    `Suggestions used: ${report.suggestionsUsed}  (+5 points each = +${report.suggestionsUsed * SUGGESTION_BONUS})`,
    "",
    `Score: ${report.score}/100 (${report.grade})`,
    `Recommendation: ${report.recommendation}`
  ].join("\n");
}

function scoreToGrade(score: number): string {
  if (score >= 90) {
    return "A";
  }
  if (score >= 75) {
    return "B";
  }
  if (score >= 70) {
    return "C";
  }
  if (score >= 60) {
    return "D";
  }
  return "F";
}

function buildRecommendation(unusedAliases: number, conflicts: number, duplicates: number, grade: string): string {
  if (grade === "A") {
    return "Alias set is in strong shape.";
  }

  if (unusedAliases > 0) {
    return `Remove ${unusedAliases} unused aliases to reach A grade.`;
  }

  if (conflicts > 0) {
    return `Resolve ${conflicts} conflict${conflicts === 1 ? "" : "s"} to improve reliability.`;
  }

  if (duplicates > 0) {
    return `Merge ${duplicates} duplicate target${duplicates === 1 ? "" : "s"} to reduce clutter.`;
  }

  return "Add clearer, reusable aliases for commands you type often.";
}
