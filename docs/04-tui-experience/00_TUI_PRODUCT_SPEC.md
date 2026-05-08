# TUI Product Spec

## Purpose

The TUI is the primary interface for LOGOS Engine V1.

It should feel like a structured conversation with a rigorous project architect, not like a form.

## Commands

The primary CLI entrypoint is `logos`, which opens the TUI.

Inside the TUI, ordinary text input is conversation with AI. Slash commands exist for explicit system operations and exceptional control flows.

### `/init`

Initializes LOGOS Engine in the current directory.

### `/continue`

Resumes the AI-led intake conversation.

### `/diagnose`

Runs diagnostics and shows gaps.

### `/generate`

Renders or refreshes documents.

### `/validate`

Checks phase readiness.

### `/status`

Shows current project progress.

### `/config ai`

Configures LLM provider access.

## Interaction Principles

- Ask in small batches.
- Explain why a question matters.
- Allow "I don't know yet".
- Store assumptions explicitly.
- Do not shame uncertainty.
- Avoid fake certainty.
- Prefer progress with traceability.

## Conversation Round Size

Recommended:

- minimum: 3 questions;
- ideal: 5 to 8 questions;
- maximum: 12 questions.

These are AI behavior guidelines, not a deterministic questionnaire contract. The AI may ask fewer questions when one answer unlocks useful documentation work.

## Navigation

The user should be able to:

- answer;
- skip;
- mark as assumption;
- go back;
- save and exit;
- view related docs;
- run diagnostics.

## Slash Command Behavior

- Slash commands should start with `/`.
- Slash commands should support autocomplete.
- Slash commands should show short descriptions and option hints.
- Slash command results should render in the TUI, not as raw terminal output.
- Destructive slash commands should ask for confirmation.
- Slash commands should not be required for normal intake progress.

## UX Tone

The TUI should be:

- precise;
- calm;
- minimal;
- direct;
- useful.
