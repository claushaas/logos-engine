# LLM Integration Strategy

## Principle

LOGOS Engine exists to structure the use of AI for transforming an initial user intention into complete, coherent, auditable documentation.

AI is not an optional add-on to the product experience.

AI is a core part of the system because it enables:

- interpretation of unclear user input;
- synthesis of long-form answers;
- discovery of missing context;
- identification of contradictions;
- risk analysis;
- generation of structured documentation;
- refinement of business, product, design, and technical reasoning.

However, AI must not become an unchecked source of truth.

The system should combine AI-assisted reasoning with deterministic structures such as profiles, schemas, decision registries, validation rules, and document templates.

## Core Position

The correct model is not:

```text
LOGOS Engine works without AI, and AI only improves it.
```

The correct model is:

```text
LOGOS Engine uses AI as the reasoning and synthesis layer, constrained by explicit structure, traceability, and user confirmation.
```

## Role of AI

AI is responsible for helping the user move from diffuse intent to structured documentation.

It should support:

- asking context-aware questions;
- interpreting user answers;
- extracting decisions;
- distinguishing facts, assumptions, hypotheses, and open questions;
- identifying gaps;
- identifying downstream implications;
- suggesting risks;
- drafting document sections;
- improving clarity and consistency;
- generating implementation-ready documentation.

## Role of Deterministic Structure

Deterministic structure remains essential.

Profiles, schemas, validation rules, document templates, and decision registries provide the guardrails that make AI output reliable, auditable, and consistent.

The deterministic layer is responsible for:

- defining canonical phases;
- defining required documents;
- defining expected decisions;
- validating completeness;
- tracking decision status;
- preserving traceability;
- rendering predictable document structures;
- preventing AI from silently inventing facts.

## V1 Strategy

In V1, LOGOS Engine should include AI as a central workflow component.

The V1 should still avoid unnecessary complexity.

The goal is not to build a fully autonomous multi-agent system.

The goal is to build a structured AI-assisted documentation engine.

## V1 AI Responsibilities

The V1 AI layer should support:

- generating follow-up questions from profile context;
- summarizing and normalizing user answers;
- extracting proposed decisions;
- drafting sections of canonical Markdown documents;
- identifying unclear or contradictory answers;
- suggesting assumptions when information is incomplete;
- producing gap analysis;
- producing risk notes;
- recommending the next useful question group.

## V1 Non-Goals

The V1 AI layer should not attempt to:

- autonomously decide on behalf of the user;
- perform unrestricted market research;
- generate final facts without confirmation;
- overwrite confirmed decisions silently;
- replace validation rules;
- replace profile schemas;
- act as an implementation agent;
- coordinate multiple agents;
- automatically build the final app or artifact.

## Required Safeguards

If AI is used — and AI is expected to be used in the core workflow — the system must:

- show generated suggestions as proposed;
- require user confirmation for decisions;
- distinguish generated content from confirmed knowledge;
- preserve source answers for traceability;
- mark assumptions explicitly;
- never treat inferred information as validated fact;
- keep provider abstraction;
- make external transmission explicit;
- support local and remote providers when possible.

## Provider Abstraction

LOGOS Engine should not be hard-coupled to a single AI provider.

The provider layer should support different execution modes over time:

- hosted commercial LLM providers;
- OpenRouter-compatible providers;
- local models;
- future internal or self-hosted inference.

A future provider interface may look like this:

```ts
type LlmProvider = {
  complete(input: LlmRequest): Promise<LlmResponse>;
};
```

## Provider Configuration

Users should bring their own LLM access.

LOGOS Engine should not create provider accounts, issue API keys, or hide provider costs.

The user should be able to configure AI access through an explicit command such as:

```bash
logos config ai
```

The configuration flow should ask for:

- provider preset;
- endpoint URL;
- model id;
- token source;
- optional request limits or timeout;
- whether remote transmission is allowed for the current workspace.

The token source should be one of:

- environment variable;
- operating system keychain or credential store, if supported;
- manual session entry for temporary use.

The default recommendation is environment-variable based credentials.

LOGOS Engine should store non-secret provider configuration in local config files, but should not store raw API tokens in the project workspace by default.

Recommended project config:

```json
{
  "ai": {
    "enabled": true,
    "provider": "openai-compatible",
    "endpoint": "https://api.example.com/v1",
    "model": "provider/model-name",
    "tokenEnvVar": "LOGOS_LLM_API_KEY",
    "transmission": "remote-explicit"
  }
}
```

Recommended storage locations:

- `.logos/config.json` for project-specific, non-secret AI settings;
- user shell environment for API tokens;
- optional global user config for default provider preferences;
- optional OS keychain integration for users who opt in.

`LOGOS_LLM_API_KEY` should be supported as a generic default token variable.

Provider-specific variables may also be supported for convenience, but the core system should normalize them into the same provider config model.

## Provider Presets

V1 should include presets for common provider styles, while keeping a custom provider path available.

Recommended presets:

- `openai-compatible` for providers that expose an OpenAI-compatible HTTP API;
- `openai` as a convenience preset over the OpenAI-compatible adapter;
- `openrouter` as a convenience preset over the OpenAI-compatible adapter;
- `anthropic` for Anthropic-compatible message APIs;
- `ollama` for local models;
- `lm-studio` for local OpenAI-compatible endpoints;
- `custom` for any endpoint and protocol the user wants to configure manually.

Each preset should define:

- protocol adapter;
- default endpoint;
- expected token environment variable;
- whether a token is required;
- whether the provider is local or remote;
- default timeout;
- model id examples.

Presets must be editable. They should reduce setup friction, not prevent custom endpoints.

## Privacy

The system should be explicit about what is sent to an AI provider.

Default behavior should favor transparency and user control.

The user should understand:

- which provider is being used;
- what project context is included;
- whether files are transmitted externally;
- whether generated output is proposed or confirmed.

For local models, no project content should leave the machine.

For remote providers, external transmission must be clear and configurable.

## AI Output Statuses

AI-generated output should be classified before entering the documentation system.

Recommended statuses:

- `draft`: generated text not yet reviewed;
- `proposed`: suggested decision or assumption;
- `confirmed`: explicitly accepted by the user;
- `rejected`: discarded by the user;
- `needs_review`: useful but incomplete or uncertain.

## Human Confirmation

The user remains the authority over final decisions.

AI may propose:

- interpretations;
- summaries;
- assumptions;
- risks;
- document drafts;
- implementation directions.

But the system must avoid converting AI proposals into confirmed project decisions without user confirmation.

## Future AI Capabilities

Future versions may support:

- richer diagnostics;
- architecture critique;
- business model critique;
- financial model review;
- launch strategy review;
- implementation prompt generation;
- profile-aware document refinement;
- dependency impact analysis;
- agent-ready implementation briefs;
- integrations with coding agents.

## Strategic Summary

LOGOS Engine is an AI-structured documentation and intent clarification system.

The AI layer provides reasoning, synthesis, interrogation, and drafting.

The deterministic layer provides structure, traceability, validation, and safety.

The user provides judgment and confirmation.
