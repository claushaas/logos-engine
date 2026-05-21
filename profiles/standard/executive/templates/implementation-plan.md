# {{project.name}} — Implementation Plan

**Generated At:** {{generatedAt}}  
**Source Executive Plan:** `{{sourceExecutivePlanPath}}`  
**Readiness Status:** `{{source.readinessStatus}}`  
**Overall Confidence:** `{{confidence.overall}}`

---

## 1. Project Summary

{{project.description}}

---

## 2. Source Normative Documents

{{#source.normativeDocuments}}
- `{{.}}`
{{/source.normativeDocuments}}

---

## 3. Roadmap

{{#execution.roadmaps}}
### {{title}}

{{description}}

- Status: `{{status}}`
- Horizon: `{{horizon}}`

{{/execution.roadmaps}}

---

## 4. Milestones

{{#execution.milestones}}
### {{id}} — {{title}}

{{objective}}

**Status:** `{{status}}`

#### Exit Criteria

{{#exitCriteria}}
- [ ] {{.}}
{{/exitCriteria}}

{{/execution.milestones}}

---

## 5. Initiatives

{{#execution.initiatives}}
### {{id}} — {{title}}

{{purpose}}

- Status: `{{status}}`
- Workstream: `{{workstreamId}}`
- Milestone: `{{milestoneId}}`

#### Deliverables

{{#deliverables}}
- `{{.}}`
{{/deliverables}}

{{/execution.initiatives}}

---

## 6. Execution Items

{{#execution.items}}
### {{id}} — {{title}}

- Type: `{{type}}`
- Status: `{{status}}`
- Priority: `{{priority}}`
- Initiative: `{{initiativeId}}`
- Workstream: `{{workstreamId}}`

{{description}}

#### Acceptance Criteria

{{#acceptanceCriteria}}
- [ ] {{.}}
{{/acceptanceCriteria}}

#### Source Documents

{{#sourceNormativeDocuments}}
- `{{.}}`
{{/sourceNormativeDocuments}}

{{/execution.items}}

---

## 7. Risks

{{#execution.risks}}
### {{id}} — {{title}}

- Likelihood: `{{likelihood}}`
- Impact: `{{impact}}`

{{description}}

**Mitigation:** {{mitigation}}

{{/execution.risks}}

---

## 8. Decisions

{{#execution.decisions}}
### {{id}} — {{title}}

**Status:** `{{status}}`

{{context}}

**Decision:** {{decision}}

#### Consequences

{{#consequences}}
- {{.}}
{{/consequences}}

{{/execution.decisions}}
