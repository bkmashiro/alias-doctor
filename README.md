# alias-doctor

`alias-doctor` audits your shell aliases. It highlights ghost aliases that are defined but not used in your recent shell history, and it suggests new aliases for commands you type repeatedly.

## Features

- Parses alias definitions from `~/.zshrc` or `~/.bashrc`
- Parses both zsh extended history and plain bash history formats
- Finds ghost aliases by checking how often alias expansions appear in recent history
- Suggests new aliases for repeated commands that are not already aliased
- Supports human-readable output and `--json`

## Install

```bash
pnpm add -g alias-doctor
```

For local development:

```bash
pnpm install
pnpm build
node dist/index.js --help
```

## Usage

```bash
alias-doctor [options]
```

Options:

- `--rc <path>` Shell rc file (default: `~/.zshrc`, auto-detects bash/zsh)
- `--history <path>` History file (default: `~/.zsh_history` or `~/.bash_history`)
- `--days <n>` Analyze last `n` days of history (default: `90`)
- `--min-uses <n>` Min uses to suggest alias (default: `5`)
- `--json` JSON output
- `--shell <sh>` Force shell type: `zsh|bash`

Example:

```bash
alias-doctor --days 30 --min-uses 10
```

## How It Works

1. Reads your shell rc file and extracts `alias name=value` definitions.
2. Reads your shell history file and supports:
   - zsh extended history lines like `: 1712345678:0;git status`
   - plain bash history lines like `git status`
3. Filters history to the selected time window.
4. Counts how often aliased commands appear in history.
5. Suggests new aliases for commands seen at least `--min-uses` times that are not already aliased.

The tool treats aliases with `0` uses as ghosts, aliases with `1` use as weakly used, and everything above that as healthy.

## Supported Shells

- zsh
- bash

## Development

```bash
pnpm test
```
