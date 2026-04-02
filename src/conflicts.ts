import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AliasDefinition } from "./parser.js";

const execFileAsync = promisify(execFile);

export interface AliasConflictReport {
  systemShadows: SystemShadowConflict[];
  aliasShadows: AliasShadowConflict[];
  duplicateTargets: DuplicateTargetConflict[];
}

export interface SystemShadowConflict {
  alias: AliasDefinition;
  commandPath: string;
}

export interface AliasShadowConflict {
  name: string;
  definitions: AliasDefinition[];
}

export interface DuplicateTargetConflict {
  command: string;
  aliases: AliasDefinition[];
}

export interface ConflictOptions {
  resolveCommandPath?: (name: string) => Promise<string | undefined>;
}

export async function analyzeConflicts(
  aliases: AliasDefinition[],
  options: ConflictOptions = {}
): Promise<AliasConflictReport> {
  const resolveCommandPath = options.resolveCommandPath ?? commandPathOnPath;
  const aliasGroups = groupByName(aliases);
  const commandGroups = groupByCommand(aliases);

  const systemShadows = (
    await Promise.all(
      aliases.map(async (alias) => {
        const commandPath = await resolveCommandPath(alias.name);
        return commandPath ? { alias, commandPath } : undefined;
      })
    )
  )
    .filter((entry): entry is SystemShadowConflict => Boolean(entry))
    .sort((left, right) => left.alias.name.localeCompare(right.alias.name) || left.alias.line - right.alias.line);

  const aliasShadows = [...aliasGroups.entries()]
    .filter(([, definitions]) => definitions.length > 1)
    .map(([name, definitions]) => ({
      name,
      definitions: definitions.slice().sort((left, right) => left.line - right.line)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const duplicateTargets = [...commandGroups.entries()]
    .filter(([, definitions]) => definitions.length > 1)
    .map(([command, aliasesForCommand]) => ({
      command,
      aliases: aliasesForCommand.slice().sort((left, right) => left.name.localeCompare(right.name) || left.line - right.line)
    }))
    .sort((left, right) => left.command.localeCompare(right.command));

  return {
    systemShadows,
    aliasShadows,
    duplicateTargets
  };
}

export function formatConflictReport(report: AliasConflictReport): string {
  const lines = ["Conflict analysis:", ""];

  if (report.systemShadows.length === 0 && report.aliasShadows.length === 0 && report.duplicateTargets.length === 0) {
    lines.push("No conflicts found.");
    return lines.join("\n");
  }

  if (report.systemShadows.length > 0) {
    lines.push("🔴 Alias shadows system command:");
    for (const entry of report.systemShadows) {
      lines.push(`  ${entry.alias.name}=${JSON.stringify(entry.alias.command)}  ← command exists at ${entry.commandPath}`);
    }
    lines.push("");
  }

  if (report.aliasShadows.length > 0) {
    lines.push("🟡 Alias shadows another alias:");
    for (const entry of report.aliasShadows) {
      for (const definition of entry.definitions) {
        const suffix = definition === entry.definitions.at(-1) ? "  ← defined later, overwrites earlier alias" : "";
        lines.push(`  ${definition.name}=${JSON.stringify(definition.command)}${suffix}`);
      }
    }
    lines.push("");
  }

  if (report.duplicateTargets.length > 0) {
    lines.push("🟡 Duplicate targets:");
    for (const entry of report.duplicateTargets) {
      for (const alias of entry.aliases) {
        lines.push(`  ${alias.name}=${JSON.stringify(entry.command)}`);
      }
    }
  }

  return lines.join("\n").trimEnd();
}

function groupByName(aliases: AliasDefinition[]): Map<string, AliasDefinition[]> {
  const grouped = new Map<string, AliasDefinition[]>();
  for (const alias of aliases) {
    const group = grouped.get(alias.name);
    if (group) {
      group.push(alias);
    } else {
      grouped.set(alias.name, [alias]);
    }
  }
  return grouped;
}

function groupByCommand(aliases: AliasDefinition[]): Map<string, AliasDefinition[]> {
  const grouped = new Map<string, AliasDefinition[]>();
  for (const alias of aliases) {
    const group = grouped.get(alias.command);
    if (group) {
      group.push(alias);
    } else {
      grouped.set(alias.command, [alias]);
    }
  }
  return grouped;
}

async function commandPathOnPath(name: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("sh", ["-lc", `command -v -- ${shellEscape(name)}`]);
    const resolved = stdout.trim();
    return resolved.length > 0 ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
