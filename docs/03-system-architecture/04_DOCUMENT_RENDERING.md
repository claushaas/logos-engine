# Document Rendering

## Purpose

The renderer transforms structured state into Markdown documents.

## Core Rule

Markdown is a projection, not the source of truth.

## Rendering Sources

The renderer may use:

- decisions;
- answers;
- assumptions;
- risks;
- profile templates;
- validation results;
- diagnostics.

## Document Section Pattern

Each generated document should follow a predictable structure:

```md
# Title

## Purpose

## Confirmed Decisions

## Assumptions

## Open Questions

## Risks

## Dependencies

## Draft Content

## Next Actions
```

Not every document needs every section, but the pattern should remain consistent.

## Generated vs Manual Content

A key design decision:

V1 should avoid complex bidirectional sync.

Recommended approach:

- generated sections are clearly marked;
- user notes can live in manual sections;
- regeneration preserves manual sections where possible;
- destructive overwrites require confirmation.

## Frontmatter

Each document may include YAML frontmatter:

```yaml
---
logos:
  document_id: product.product_thesis
  profile: app-business
  generated_at: 2026-05-07
  source: decision-registry
---
```

## Rendering Modes

### Safe Render

Create missing documents but do not overwrite existing ones.

### Refresh Render

Update generated sections while preserving manual sections.

### Force Render

Overwrite generated documents after explicit confirmation.
