# Agent Task: {{title}}

## Objective

{{description}}

## Execution Context

- LOGOS item ID: `{{id}}`
- Type: `{{type}}`
- Priority: `{{priority}}`
- Initiative: `{{initiativeId}}`
- Workstream: `{{workstreamId}}`

## Source Normative Documents

{{#sourceNormativeDocuments}}
- `{{.}}`
{{/sourceNormativeDocuments}}

## Required Work

{{instructions}}

## Acceptance Criteria

{{#acceptanceCriteria}}
- [ ] {{.}}
{{/acceptanceCriteria}}

## Dependencies

{{#dependsOn}}
- `{{.}}`
{{/dependsOn}}

## Constraints

- Do not change unrelated files.
- Preserve existing repository conventions.
- Preserve source traceability.
- Do not treat generated artifacts as canonical source unless explicitly instructed.
- If YAML is generated, avoid compact mappings that may trigger parser warnings.
- If schema behavior changes, update the relevant documentation or generated schema artifacts.

## Expected Outputs

{{#expectedArtifacts}}
- `{{.}}`
{{/expectedArtifacts}}

## Response Requirements

Return:

1. Summary of changes.
2. Files changed.
3. Validation performed.
4. Remaining risks or follow-up items.
