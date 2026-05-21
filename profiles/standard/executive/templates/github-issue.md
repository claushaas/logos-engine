# {{title}}

## Purpose

{{description}}

## Type

`{{type}}`

## Priority

`{{priority}}`

## Source Normative Documents

{{#sourceNormativeDocuments}}
- `{{.}}`
{{/sourceNormativeDocuments}}

## Acceptance Criteria

{{#acceptanceCriteria}}
- [ ] {{.}}
{{/acceptanceCriteria}}

## Dependencies

{{#dependsOn}}
- `{{.}}`
{{/dependsOn}}

## Related Execution Context

- Initiative: `{{initiativeId}}`
- Workstream: `{{workstreamId}}`

## LOGOS Metadata

```json
{
  "logosItemId": "{{id}}",
  "type": "{{type}}",
  "status": "{{status}}",
  "priority": "{{priority}}",
  "initiativeId": "{{initiativeId}}",
  "workstreamId": "{{workstreamId}}",
  "origin": "{{origin}}",
  "requiresReview": {{requiresReview}}
}
```
