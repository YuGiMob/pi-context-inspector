# pi-context-inspector

A [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) extension that opens a tabbed overlay with the full LLM context of the current session.

## Features

- **`/context`** opens an overlay with five tabs:
  - **[Stats]** — model name, token usage vs. context window, a 10×5 colored grid of estimated usage by category (system prompt, tools, skills, messages, available, auto-compact buffer), and safe-left tokens.
  - **[System]** — the full system prompt (scrollable, searchable).
  - **[Tools]** — active tool definitions with parameter schemas.
  - **[Messages]** — all session messages formatted with roles, models, token usage, tool calls and image placeholders.
  - **[Full]** — complete context dump: system prompt + messages + usage.
- **Scroll & search.** `↑↓`/`jk` scroll, `gg`/`G` jump, `/` live search with `n`/`N` match navigation, `y` copies the raw text to the clipboard.
- **Tab navigation.** `Tab` / `Shift+Tab` cycles tabs; `q` or `Escape` closes the overlay.

## Installation

```bash
pi install npm:pi-context-inspector
```

## Usage

Run `/context` at any point during a session. The token breakdown scales character-based estimates to the provider-reported usage, so category percentages are proportional to the real token count.
