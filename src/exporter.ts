import type { AliasDefinition, ExportShellType } from "./parser.js";

export function exportAliases(aliases: AliasDefinition[], shell: ExportShellType): string {
  return aliases
    .map((alias) => formatAlias(alias, shell))
    .join("\n");
}

function formatAlias(alias: AliasDefinition, shell: ExportShellType): string {
  const escaped = escapeSingleQuotes(alias.command);

  if (shell === "fish") {
    return `abbr --add ${alias.name} '${escaped}'`;
  }

  return `alias ${alias.name}='${escaped}'`;
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, `'\\''`);
}
