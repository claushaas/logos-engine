# ADR-0010 — Use HTML Only as Derived Artifact

## Status

Proposed

## Context

HTML provides rich formatting and navigability that Markdown lacks. However, HTML is not version-control friendly, not easily diffable, and not universally editable. Generating HTML as the canonical output would make iteration and review harder.

## Decision

HTML output is generated exclusively as a derived artifact from Markdown canonical documents. HTML is never the source of truth. HTML artifacts may include navigation, styling, and interactivity not present in the Markdown source.

## Consequences

Markdown remains the authoritative format for review and version control. HTML can be regenerated at any time from the Markdown source. HTML artifacts can be enriched with presentation logic without affecting the source document.

## Alternatives Considered

- HTML as canonical output with Markdown derived
- Both Markdown and HTML as independent canonical outputs
- Skip HTML entirely

## Trade-offs

HTML generation may lag behind Markdown updates. Some Markdown features may not translate cleanly to HTML.

## Follow-up Actions

- Implement HTML artifact generator
- Define HTML template and styling
- Wire HTML generation into export pipeline
