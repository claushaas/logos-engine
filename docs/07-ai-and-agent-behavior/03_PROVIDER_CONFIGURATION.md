# Provider Configuration

LOGOS Engine supports local and remote LLM providers through a provider-agnostic abstraction layer. AI calls always route through the provider interface, never directly to a specific provider SDK.

## Provider Model

The engine distinguishes between:

- **Local providers**: Ollama, LM Studio, or any OpenAI-compatible local endpoint. No data leaves your machine.
- **Remote providers**: OpenAI, Anthropic, OpenRouter, or custom endpoints. Project context is sent to the provider's servers.

## Configuration

AI provider settings live in `.logos/config.json` inside your workspace. A global defaults file can also be created for personal preferences.

### Provider Fields

| Field | Description |
|-------|-------------|
| `provider` | Preset name: `openai`, `anthropic`, `openrouter`, `ollama`, `lmstudio`, `openai-compatible`, or `custom` |
| `endpoint` | API endpoint URL |
| `model` | Model identifier (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |
| `tokenEnv` | Environment variable name for the API key (default: `LOGOS_LLM_API_KEY`) |
| `timeoutMs` | Request timeout in milliseconds |

### Example Configuration

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o",
    "tokenEnv": "LOGOS_LLM_API_KEY",
    "timeoutMs": 60000
  }
}
```

## Presets

### OpenAI

```bash
export LOGOS_LLM_API_KEY="sk-..."
```

Config:

```json
{ "ai": { "provider": "openai", "model": "gpt-4o" } }
```

### Anthropic

```bash
export LOGOS_LLM_API_KEY="sk-ant-..."
```

Config:

```json
{ "ai": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" } }
```

### OpenRouter

```bash
export LOGOS_LLM_API_KEY="sk-or-..."
```

Config:

```json
{ "ai": { "provider": "openrouter", "model": "openai/gpt-4o" } }
```

### Ollama (Local)

No API key needed. Ollama must be running locally.

```json
{ "ai": { "provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434" } }
```

### LM Studio (Local)

No API key needed. LM Studio must be running locally.

```json
{ "ai": { "provider": "lmstudio", "model": "local-model", "endpoint": "http://localhost:1234" } }
```

### Custom OpenAI-Compatible

```json
{
  "ai": {
    "provider": "openai-compatible",
    "endpoint": "https://your-endpoint.example.com/v1",
    "model": "your-model",
    "tokenEnv": "MY_CUSTOM_TOKEN_VAR"
  }
}
```

## Token Handling

- API keys are read from environment variables, never from project config files.
- `.logos/config.json` stores the *name* of the environment variable, not the key value.
- `/config ai --show` displays the current config with the token value redacted.
- Raw tokens are never committed to Git.

## The `/config ai` Command

```text
/config ai                          Show current AI config with tokens redacted
/config ai --provider openai        Set the provider
/config ai --model gpt-4o           Set the model
/config ai --token-env MY_VAR       Set the token environment variable name
/config ai --timeout-ms 180000      Set the request timeout in milliseconds
/config ai --test                   Check provider configuration deterministically
/config ai --show                   Show full config with redacted token
/config ai --disable                Remove AI configuration
```

## Running Without a Live Remote Provider

LOGOS Engine works without live remote AI credentials for operational tasks:

- Workspace initialization works.
- Provider configuration can be inspected and changed.
- State schemas can be validated.
- Default tests use mocked or fixture AI responses.
- No network calls are made.

The normal intake and document drafting workflow is AI-led. For an actual workspace, configure a local, mock, fixture, or remote provider before starting intake. If no provider is enabled, LOGOS should guide the user through provider setup instead of asking profile coverage prompts in a deterministic order.

## Testing a Provider

Use `/config ai --test` to verify configuration shape, remote disclosure, and token resolution without making a live model call. A configured provider can still time out during normal conversation if the model is slow; increase the request limit with `/config ai --timeout-ms <milliseconds>` or choose a faster model/provider.

## Privacy Considerations

See [Privacy](./04_PRIVACY.md) for details on what context is sent to remote providers.
