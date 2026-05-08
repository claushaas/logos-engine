# Privacy

LOGOS Engine is a local-first application. It runs on your machine and writes to your filesystem.

## What Stays Local

- Your project answers, decisions, and assumptions.
- Your workspace state in `.logos/`.
- All generated documentation (until you commit and push it).
- Profile definitions and templates.
- All file paths on your machine.

## What May Be Sent to a Remote Provider

When you configure a remote LLM provider (OpenAI, Anthropic, OpenRouter, or a custom endpoint), the engine sends:

### For AI Operations (`generate_follow_up_questions`, `extract_decision_proposals`, etc.)

- The specific AI operation type.
- Profile-defined prompt template.
- Relevant user answers (current session or specific phase).
- Relevant confirmed decisions.
- Relevant assumptions.
- Relevant open questions.
- Document contract metadata (structure, sections, completion criteria).
- Profile phase definitions.

### What Is Never Sent

- Arbitrary source code files from your project.
- Files outside `.logos/` and profile directories unless explicitly included as relevant context.
- Your file system paths.
- Other projects or workspaces.
- Raw API tokens (these are loaded server-side by the provider from your environment variable).
- Your Git history or `.git/` contents.

## Inspecting What Is Sent

Use `/config ai --show` to see your provider configuration (with tokens redacted).

The engine includes a **transmission disclosure** data structure so you can inspect what context would be included in a request before it is sent.

## No Telemetry

LOGOS Engine does not:

- Collect usage data.
- Send telemetry.
- Phone home.
- Track sessions.
- Include analytics.

## Git Safety

- `.logos/config.json` stores the token environment variable *name*, not the value.
- Raw API keys are never written to tracked files.
- The `.gitignore` in an initialized workspace excludes sensitive paths by default.

## Recommendations

1. Use environment variables for API keys (e.g. `LOGOS_LLM_API_KEY`).
2. Never commit `.env` files containing real keys.
3. Review provider privacy policies before configuring a remote provider.
4. Use local providers (Ollama, LM Studio) if you want zero data to leave your machine.
5. Run `/config ai --show` to verify your configuration before generating documents with AI.

## Local-Only Mode

If no remote provider is configured, LOGOS Engine operates entirely offline:

- Deterministic flows only.
- Profile-defined question ordering.
- Document templates render with available state.
- AI-drafted sections are left blank and marked as incomplete.
- No network activity at all.

This is the default. Remote providers are always opt-in.
