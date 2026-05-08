# Commands

## Command Surface Model

LOGOS Engine is TUI-first.

The primary terminal command is:

```bash
logos
```

Running `logos` opens the interactive terminal UI for the current project.

Inside the TUI, commands are typed as slash commands, such as:

```text
/init
/continue
/status
```

Slash commands should support autocomplete, descriptions, argument hints, and keyboard navigation.

## CLI Entrypoint

The CLI entrypoint starts the product.

| Command | Behavior |
| --- | --- |
| `logos` | Opens the LOGOS TUI |
| `logos --help` | Prints CLI help |
| `logos --version` | Prints installed version |

V1 should avoid requiring users to remember many shell commands.

Scriptable non-interactive aliases may exist later, but they should be secondary to the TUI-first experience.

## TUI Slash Commands

These commands are typed inside the TUI command input.

| Slash Command | Behavior |
| --- | --- |
| `/init` | Initializes a workspace and starts setup |
| `/continue` | Resumes the next useful intake session |
| `/status` | Shows project progress |
| `/validate` | Runs validation and shows findings |
| `/diagnose` | Runs diagnostics and shows findings |
| `/generate` | Renders or refreshes documents |
| `/config ai` | Opens AI provider configuration |
| `/help` | Shows available slash commands |
| `/exit` | Saves current state and exits the TUI |

## Slash Command Options

Slash commands may accept arguments when useful.

```text
/validate --phase economics
/validate --all
/generate --safe
/generate --refresh
/generate --force
/config ai --show
/config ai --test
/config ai --disable
/config ai --provider openai --model gpt-4.1-mini --token-env LOGOS_LLM_API_KEY --allow-remote
```

Autocomplete should expose available options after the user types the command.

## TUI Actions

These actions happen inside screens, menus, and review flows.

- answer current question;
- skip current question;
- mark answer as unknown;
- mark answer as an assumption;
- go back to a previous question;
- save and exit;
- review AI-generated follow-up questions;
- accept or reject AI-generated follow-up questions;
- review proposed decisions;
- confirm or reject proposed decisions;
- view phase progress;
- view affected documents;
- run validation from the current screen;
- run diagnostics from the current screen;
- generate or refresh documents after confirmation;
- configure or review AI provider settings.

The TUI may expose these actions through menus, buttons, keyboard shortcuts, command palette items, or review screens.

## Command Behavior Rules

- `logos` must open the TUI by default.
- Slash commands are the primary command surface after the TUI starts.
- Slash commands must be discoverable through `/help` and autocomplete.
- Destructive actions must require confirmation.
- Long conversational flows should happen in dedicated TUI screens.
- The same application services should power slash commands and any future non-interactive CLI aliases.
- The TUI must not directly mutate project state; it should call command handlers or application services.

## `/init`

Creates a LOGOS workspace.

### Responsibilities

- detect project root;
- ask for project name;
- ask for profile;
- create `.logos/`;
- create `docs/`;
- initialize state files;
- generate initial documents.

## `/continue`

Continues guided intake.

### Responsibilities

- load project state;
- identify next useful phase;
- select question group;
- store answers;
- update decisions;
- offer document regeneration.

### Intake Actions

Phase 6 exposes guided intake actions through `/continue` subcommands. A richer
dedicated TUI question screen may use the same application services later.

```text
/continue
/continue answer <question-id> <answer>
/continue unknown <question-id>
/continue assume <question-id> <answer>
/continue skip <question-id>
/continue propose-followups
/continue accept-followups --all
/continue accept-followups <follow-up-id>
/continue save
```

Behavior rules:

- `/continue` shows the next bounded question group;
- `answer` stores the raw user answer and a separate normalized summary;
- `unknown` stores an unknown answer and creates a derived open question view;
- `assume` stores an assumption without confirming a decision;
- `skip` records an explicit skipped answer for the current intake session;
- `propose-followups` uses the AI operation contract to store follow-up
  questions as proposed;
- `accept-followups` makes proposed follow-ups session-active, but does not make
  them canonical profile questions;
- `save` persists the current intake session for later resume.

## `/diagnose`

Runs diagnostics.

### Responsibilities

- check missing decisions;
- check dependencies;
- check assumptions;
- check risks;
- report affected documents.

## `/generate`

Renders documents.

### Options

```text
/generate
/generate --safe
/generate --refresh
/generate --force
```

## `/validate`

Validates current phase or entire project.

### Options

```text
/validate
/validate --phase economics
/validate --all
```

## `/status`

Shows progress.

Example:

```text
Profile: App Business

Foundation: 80%
Market: 40%
Economics: 10%
Product: 30%
Architecture: 0%
GTM: 0%
```

## `/config ai`

Configures LLM access for AI-assisted workflows.

### Responsibilities

- select a provider preset;
- accept a custom endpoint;
- select or enter a model id;
- choose a token source;
- store non-secret config in `.logos/config.json` or user config;
- avoid writing raw tokens to project files by default;
- test provider connectivity when requested;
- show what project context may be sent to remote providers.

### Options

```text
/config ai
/config ai --show
/config ai --test
/config ai --disable
/config ai --provider <preset> --endpoint <url> --model <model-id> --token-env <env-var>
/config ai --allow-remote
```

Configuration flags:

- `--provider <preset>` selects a provider preset such as `openai-compatible`,
  `openai`, `openrouter`, `anthropic`, `ollama`, `lm-studio`, or `custom`;
- `--endpoint <url>` stores a non-secret endpoint override;
- `--model <model-id>` stores the model id;
- `--token-env <env-var>` stores the name of an environment variable, not the
  token value;
- `--timeout-ms <milliseconds>` stores a request timeout;
- `--allow-remote` records explicit acknowledgement that selected project
  context may be sent to a remote provider.

### Token Sources

Supported token sources should include:

- environment variable;
- optional operating system credential store;
- temporary session input.

The generic default environment variable should be:

```bash
LOGOS_LLM_API_KEY
```

## Future Slash Commands

```text
/export
/prompts
/issues
/graph
/profile create
```
