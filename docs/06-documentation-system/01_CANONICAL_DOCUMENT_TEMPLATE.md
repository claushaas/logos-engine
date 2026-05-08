# Canonical Document Template

Every generated document should follow this general pattern unless a profile overrides it.

```md
---
logos:
  document_id: example.document
  profile: app-business
  status: draft
---

# Document Title

## Purpose

Explain why this document exists.

## Confirmed Decisions

List confirmed decisions relevant to this document.

## Assumptions

List assumptions that are being used but are not validated.

## Open Questions

List unresolved questions.

## Risks

List relevant risks.

## Dependencies

List related documents, decisions, or downstream impacts.

## Main Content

Render the primary document content.

## Next Actions

List concrete next steps.
```

## Section Rules

### Confirmed Decisions

Must only contain user-confirmed information.

### Assumptions

Must clearly be marked as assumptions.

### Open Questions

Should be actionable.

### Risks

Should include severity where possible.

### Dependencies

Should connect documents and decisions.

## Manual Notes

Documents may include manual notes.

Recommended section:

```md
## Manual Notes

<!-- User-maintained content. LOGOS should preserve this section. -->
```
