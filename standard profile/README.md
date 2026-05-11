# LOGOS Engine Standard Documentation Profile

This directory contains the canonical documentation registry used by LOGOS Engine to structure, generate, review, validate, present, and operationalize project documentation.

It defines the standard profile for transforming an unclear project idea into canonical Markdown documents, derived HTML artifacts, and execution-ready agent packs.

## Structure

- **`docs.yml`** — Root documentation registry defining axes, phase registry, output model, global rules, quality model, dependency policy, agent policy, and roadmap integration.
- **`phases/`** — Phase-level YAML definitions containing document specifications, sections, dependencies, guiding questions, and generated outputs.

## Axes

LOGOS Engine separates project clarity into two complementary axes:

| Axis | Role |
| --- | --- |
| `normative` | Defines the structural, strategic, product, technical, market, and operational foundations of the project. |
| `temporal` | Converts approved normative documentation into roadmaps, milestones, implementation plans, changelogs, and execution-oriented plans. |

## The Normative Axis

The normative axis answers the complete lifecycle of a project from foundation through sustained operations:

| Phase | Central Question |
| --- | --- |
| `01-foundation` | Why does this project exist? |
| `02-validation` | Does this project deserve to advance? |
| `03-product` | What exactly will be built? |
| `04-engineering` | How will it be built reliably? |
| `05-go-to-market` | How will it reach the market? |
| `06-operations` | How will it remain alive and healthy? |

## The Temporal Axis

The temporal axis is not a competing documentation phase.

It derives execution artifacts from approved normative documentation, including:

- roadmaps;
- implementation plans;
- milestones;
- changelogs;
- decision timelines;
- agent execution plans.

In short:

```txt
Normative Axis = what must be true
Temporal Axis = what must happen next
```

## Output Model

The standard profile separates structure, canonical content, presentation, and execution:

| Layer | Format | Role |
| --- | --- | --- |
| Structure | YAML | Defines metadata, sections, questions, dependencies, rules, quality gates, and agent instructions. |
| Canonical Content | Markdown | Contains the source of truth for project decisions and generated documentation. |
| Presentation | HTML | Provides derived navigable artifacts for review, understanding, and decision-making. |
| Agent Packs | Markdown | Provides derived execution prompts and context packs for implementation, review, research, and coding agents. |

## Source of Truth Rules

YAML and Markdown are canonical.

HTML artifacts and agent packs are derived outputs. They should not be edited as primary sources. When source documents change, derived artifacts should be regenerated from the canonical YAML and Markdown.

## Quality and Agent Policies

The registry defines global quality checks for:

- completeness;
- internal consistency;
- boundary integrity;
- traceability;
- decision clarity;
- unresolved questions;
- explicit assumptions;
- contradiction detection.

Agents using this profile must:

- avoid inventing missing project facts;
- mark assumptions explicitly;
- preserve phase boundaries;
- prefer unresolved questions over silent inference;
- generate canonical Markdown before derived artifacts;
- avoid treating HTML as source of truth;
- produce review notes when contradictions are detected.

## How to Read

1. Start with `docs.yml` to understand the global registry.
2. Read `phaseRegistry` to see which phase files are active.
3. Read each `phases/*.yml` file for document definitions, sections, dependencies, guiding questions, and expected outputs.
4. Generate or review Markdown documents as the canonical project documentation.
5. Generate HTML artifacts and agent packs only as derived outputs.

## How to Use

Use this profile when a project needs to move from unclear idea to structured execution.

The intended flow is:

```txt
Idea
→ YAML structure
→ Markdown canonical docs
→ HTML review artifacts
→ Agent packs
→ Roadmap and implementation plans
```
