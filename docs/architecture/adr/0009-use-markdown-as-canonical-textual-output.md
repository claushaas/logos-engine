# ADR-0009 — Use Markdown as Canonical Textual Output

## Status

Proposed

## Context

The LOGOS Engine produces documentation artifacts. The primary textual output format must be version-control friendly, universally readable, and semantically rich enough to represent structured documentation.

## Decision

Use Markdown as the canonical textual output format. All document materialization targets Markdown as the primary output. Other formats (HTML, agent packs) are derived from Markdown, not generated independently.

## Consequences

Markdown files are diffable, reviewable, and editable without specialized tooling. Generated documents can be stored in version control alongside source code. Conversion to other formats is straightforward.

## Alternatives Considered

- HTML as canonical output
- Plain text only
- JSON or YAML as canonical, with rendering as a separate step
- PDF as primary output

## Trade-offs

Markdown has limited layout capabilities compared to HTML or PDF. Complex formatting requires extensions or conventions.

## Follow-up Actions

- Implement Markdown materializer
- Implement HTML artifact generation (derived)
- Implement agent pack generation (derived)
