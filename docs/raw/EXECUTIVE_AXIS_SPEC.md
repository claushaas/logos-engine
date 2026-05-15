# LOGOS Engine — Executive Axis Specification

**Status:** Draft v1  
**Scope:** Executive Axis / Portable Execution Model  
**Primary Output:** Portable JSON-based execution model  
**Secondary Outputs:** export adapters, human-readable artifacts, agent packs  
**Non-goal:** task management application

---

## 1. Executive Summary

The LOGOS Engine separates project clarification into two complementary axes:

```txt
Normative Axis → defines what must be true.
Executive Axis → defines what should happen next.
```

The **Normative Axis** is stable by nature. It is well-suited for Markdown, YAML, schemas, Git history, canonical documents, and long-lived project knowledge.

The **Executive Axis** is volatile by nature. It changes under pressure from daily work, interruptions, shifting priorities, new constraints, unexpected blockers, agent outputs, human judgment, and implementation feedback.

Because of that volatility, the Executive Axis **must not be implemented as a manually maintained tree of Markdown or YAML documents**. That would create friction, stale planning artifacts, and eventually a parallel task-management system.

Instead, the Executive Axis should be implemented as a **portable executive model**, represented canonically as JSON, generated from the Normative Axis, and exported through adapters into external execution tools such as:

- Linear;
- Notion;
- GitHub Issues;
- GitHub Projects;
- Markdown task files;
- CSV;
- HTML review artifacts;
- agent execution packs.

The central architectural conclusion is:

> **LOGOS is not the task manager. LOGOS is the execution compiler.**

LOGOS should derive structured execution from canonical project knowledge, but the day-to-day operation of tasks, status updates, assignments, comments, notifications, and collaboration should happen in tools designed for execution.

---

## 2. Problem Statement

The initial hypothesis was that the Executive Axis could be documented similarly to the Normative Axis, using files such as:

```txt
execution/
├── roadmap.yml
├── milestones.yml
├── initiatives.yml
├── tasks.yml
├── reviews.yml
├── evidence.yml
└── decisions.yml
```

This is structurally coherent but operationally weak.

The problem is not whether YAML or Markdown can represent execution. They can.

The problem is that execution is not static.

Execution changes because:

- priorities change;
- blockers appear;
- agent outputs require review;
- humans reconsider scope;
- external tools become the real operational surface;
- timelines shift;
- tasks are split, merged, cancelled, or superseded;
- decisions are made informally during work;
- new discoveries invalidate old assumptions.

A manually maintained file-based execution system would likely become stale.

The likely failure mode:

```txt
Daily work changes
  ↓
Execution YAML is not updated
  ↓
Files diverge from reality
  ↓
Users stop trusting the execution layer
  ↓
LOGOS becomes documentation-only
```

This would undermine the purpose of LOGOS: transforming unclear intent into usable clarity and action.

---

## 3. Strategic Constraint

LOGOS must not become a task management app.

Building a proprietary execution UI would introduce the wrong product gravity:

```txt
Execution planning
  ↓
Task dashboard
  ↓
Status workflows
  ↓
Notifications
  ↓
Collaboration
  ↓
Calendar logic
  ↓
Another project management tool
```

That is not the purpose of the project.

The Executive Axis must support execution without owning the entire operational surface.

Therefore:

> **LOGOS should generate execution structure, not host execution behavior.**

External tools already solve execution surfaces better:

- Linear for product and engineering execution;
- GitHub Issues and Projects for repository-linked execution;
- Notion for flexible knowledge and planning views;
- spreadsheets or CSV for lightweight import/export;
- Markdown for human review and repository-friendly snapshots.

LOGOS should integrate with these tools rather than compete with them.

---

## 4. Architectural Decision

### 4.1 Decision

The Executive Axis will be represented as a **portable JSON execution model**.

This model will be:

- generated from the Normative Axis;
- serializable;
- tool-agnostic;
- adapter-friendly;
- human-reviewable through derived outputs;
- suitable for agent execution;
- not dependent on a proprietary task UI.

### 4.2 Canonical Statement

> **The Executive Axis is not a task management interface. It is a portable execution model derived from the Normative Axis and exportable to external execution tools.**

### 4.3 Practical Implication

LOGOS owns:

```txt
clarification
structuring
derivation
traceability
execution modeling
adapter export
agent pack generation
semantic reconciliation
```

External tools own:

```txt
daily status
comments
assignments
collaboration
notifications
calendar integration
operational task tracking
```

---

## 5. High-Level Architecture

```txt
Normative Axis
Markdown + YAML + Git
        ↓
LOGOS Executive Compiler
        ↓
Executive JSON
        ↓
Export Adapters
        ↓
Linear / Notion / GitHub / Markdown / CSV / HTML / Agent Packs
```

The Executive Axis is therefore a **compiler output**, not a manually curated workspace.

---

## 6. Layered Model

### 6.1 Normative Layer

The source of structural truth.

Typical files:

```txt
docs.yml
phases/
  01-foundation.yml
  02-validation.yml
  03-product.yml
  04-engineering.yml
  05-go-to-market.yml
  06-operations.yml
docs/
schemas/
templates/
```

Purpose:

- define project purpose;
- define problem, audience, principles, boundaries;
- define validation logic;
- define product structure;
- define engineering direction;
- define go-to-market model;
- define operational model.

### 6.2 Executive Exchange Layer

The canonical portable execution representation.

Primary file:

```txt
executive/executive-plan.json
```

Companion schema:

```txt
executive/executive-plan.schema.json
```

Purpose:

- represent roadmaps, milestones, workstreams, initiatives, execution items, decisions, risks, artifacts, and export metadata;
- preserve links to source normative documents;
- provide a stable interchange format for adapters.

### 6.3 Adapter Layer

Tool-specific transformation rules.

Example:

```txt
executive/mappings/
├── linear.mapping.json
├── notion.mapping.json
├── github-issues.mapping.json
├── github-projects.mapping.json
├── markdown.mapping.json
└── agent-pack.mapping.json
```

Purpose:

- map LOGOS concepts to external tool concepts;
- flatten rich semantic structures when necessary;
- preserve metadata for traceability;
- generate import-ready files, payloads, or API requests.

### 6.4 Operational Layer

The external execution environment.

Examples:

```txt
Linear
Notion
GitHub Issues
GitHub Projects
```

Purpose:

- track live execution;
- manage comments, status, assignees, labels, priorities, notifications;
- support collaboration;
- host the changing reality of day-to-day work.

### 6.5 Derived Artifact Layer

Human-readable and agent-readable outputs.

Examples:

```txt
executive/exports/
├── linear/
├── notion/
├── github/
├── markdown/
├── html/
└── agent-packs/
```

Purpose:

- review;
- communication;
- import;
- implementation;
- audit snapshots;
- agent execution.

---

## 7. Core Principle: Execution Graph, Not Task List

The Executive JSON must represent an **execution graph**, not a flat task list.

A task list loses too much structure.

LOGOS needs to preserve:

- why an item exists;
- which normative documents produced it;
- which milestone it supports;
- which initiative it belongs to;
- which workstream owns it;
- what depends on it;
- which acceptance criteria define completion;
- which artifacts it should produce;
- whether it is suitable for a human, an agent, or both;
- which external tools can receive it.

Therefore, the core structure is:

```txt
Roadmap
  → Milestones
    → Initiatives
      → Execution Items
        → Acceptance Criteria
        → Dependencies
        → Artifacts
        → Export Targets
```

Workstreams cut across this structure:

```txt
Workstream
  → related initiatives
  → related items
  → related normative areas
```

---

## 8. Core Entities

### 8.1 Project

Identifies the project being compiled.

### 8.2 Source

Captures the normative inputs used to generate the plan.

### 8.3 Roadmap

A high-level temporal structure composed of milestones.

### 8.4 Milestone

A meaningful checkpoint with exit criteria.

### 8.5 Workstream

A persistent area of effort, such as documentation, schema, engineering, validation, GTM, or operations.

### 8.6 Initiative

A coherent block of work that advances a milestone.

### 8.7 Execution Item

The primary exportable unit.

An execution item may be a task, decision, question, risk, blocker, review, experiment, spike, agent prompt, doc update, or artifact request.

### 8.8 Decision

A structured decision that may affect execution, normative documents, or future generated plans.

### 8.9 Risk

A known uncertainty or threat that may affect execution.

### 8.10 Artifact

A generated or expected output, such as a file, report, prompt, patch, HTML artifact, import file, or decision record.

### 8.11 Export Profile

A tool-specific configuration defining how entities should be exported.

---

## 9. Execution Item Types

The Executive Axis must not reduce every unit to `task`.

Supported item types:

```json
[
  "task",
  "decision",
  "question",
  "blocker",
  "risk",
  "experiment",
  "review",
  "agent_prompt",
  "doc_update",
  "spike",
  "artifact",
  "bug",
  "follow_up"
]
```

### Why this matters

External tools may flatten these into issues, cards, rows, or tasks, but LOGOS should preserve the original semantic type.

This enables:

- better exports;
- better reviews;
- better agent prompts;
- better traceability;
- better reconciliation later.

---

## 10. Canonical Executive JSON Example

```json
{
  "id": "logos-executive-plan",
  "version": "1.0.0",
  "project": {
    "id": "logos-engine",
    "name": "LOGOS Engine",
    "description": "A system for transforming unclear ideas into structured, executable project clarity."
  },
  "generatedAt": "2026-05-11T00:00:00-03:00",
  "source": {
    "normativeDocuments": [
      "docs.yml",
      "phases/01-foundation.yml",
      "phases/02-validation.yml",
      "phases/03-product.yml",
      "phases/04-engineering.yml",
      "phases/05-go-to-market.yml",
      "phases/06-operations.yml"
    ],
    "sourceCommit": null,
    "generationPromptId": null
  },
  "execution": {
    "roadmaps": [
      {
        "id": "roadmap-v1",
        "title": "LOGOS Engine Implementation Roadmap",
        "description": "Execution roadmap derived from the normative documentation structure.",
        "horizon": "project",
        "status": "draft",
        "milestoneIds": ["m-001"]
      }
    ],
    "milestones": [
      {
        "id": "m-001",
        "title": "Normative Axis Operational",
        "objective": "Make the normative documentation structure machine-readable and usable by agents.",
        "status": "planned",
        "exitCriteria": [
          "All phase files validate.",
          "All document schemas support canonical and derived outputs.",
          "No parser warnings remain."
        ],
        "initiativeIds": ["init-001"]
      }
    ],
    "workstreams": [
      {
        "id": "ws-documentation-system",
        "title": "Documentation System",
        "description": "Maintains the canonical documentation model.",
        "type": "documentation",
        "relatedNormativeAreas": [
          "foundation",
          "validation",
          "product",
          "engineering",
          "go-to-market",
          "operations"
        ]
      }
    ],
    "initiatives": [
      {
        "id": "init-001",
        "title": "Implement Documentation Schema v1",
        "workstreamId": "ws-documentation-system",
        "milestoneId": "m-001",
        "status": "planned",
        "purpose": "Create the first stable machine-readable schema for LOGOS documents.",
        "deliverables": [
          "schema/document.schema.json",
          "schema/phase.schema.json",
          "schema/output.schema.json"
        ],
        "itemIds": ["item-001"]
      }
    ],
    "items": [
      {
        "id": "item-001",
        "type": "task",
        "title": "Create base document schema",
        "description": "Create a schema that supports canonical outputs, derived artifacts, exports, and agent packs.",
        "status": "planned",
        "priority": "high",
        "initiativeId": "init-001",
        "workstreamId": "ws-documentation-system",
        "dependsOn": [],
        "acceptanceCriteria": [
          "Schema validates existing phase files.",
          "Schema supports markdown, html, json, yaml, and prompt outputs.",
          "Schema avoids compact mappings that trigger YAML parser warnings."
        ],
        "sourceNormativeDocuments": [
          "docs.yml",
          "phases/01-foundation.yml"
        ],
        "suggestedExecutor": {
          "type": "agent",
          "agentProfile": "opencode"
        },
        "suggestedExports": {
          "linear": {
            "issueType": "Task",
            "labels": ["documentation", "schema"]
          },
          "github": {
            "type": "issue",
            "labels": ["documentation", "schema"]
          },
          "notion": {
            "database": "Tasks",
            "properties": {
              "Area": "Documentation System",
              "Priority": "High"
            }
          }
        }
      }
    ],
    "decisions": [],
    "risks": [],
    "artifacts": []
  },
  "exports": {
    "linear": {
      "enabled": true,
      "mappingProfile": "linear.default"
    },
    "notion": {
      "enabled": true,
      "mappingProfile": "notion.database"
    },
    "github": {
      "enabled": true,
      "mappingProfile": "github.issues"
    },
    "markdown": {
      "enabled": true,
      "mappingProfile": "markdown.task-report"
    },
    "html": {
      "enabled": true,
      "mappingProfile": "html.executive-review"
    },
    "agentPack": {
      "enabled": true,
      "mappingProfile": "agent-pack.opencode"
    }
  }
}
```

---

## 11. Conceptual JSON Schema

This schema is intentionally not exhaustive. It defines the core contract that adapters can rely on.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://logos.engine/schemas/executive-plan.schema.json",
  "title": "LOGOS Executive Plan",
  "type": "object",
  "required": ["id", "version", "project", "generatedAt", "source", "execution"],
  "properties": {
    "id": {
      "type": "string"
    },
    "version": {
      "type": "string"
    },
    "project": {
      "$ref": "#/$defs/project"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "source": {
      "$ref": "#/$defs/source"
    },
    "execution": {
      "$ref": "#/$defs/execution"
    },
    "exports": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/$defs/exportConfig"
      }
    }
  },
  "$defs": {
    "project": {
      "type": "object",
      "required": ["id", "name"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "description": { "type": "string" }
      }
    },
    "source": {
      "type": "object",
      "required": ["normativeDocuments"],
      "properties": {
        "normativeDocuments": {
          "type": "array",
          "items": { "type": "string" }
        },
        "sourceCommit": {
          "type": ["string", "null"]
        },
        "generationPromptId": {
          "type": ["string", "null"]
        }
      }
    },
    "execution": {
      "type": "object",
      "required": ["roadmaps", "milestones", "workstreams", "initiatives", "items"],
      "properties": {
        "roadmaps": {
          "type": "array",
          "items": { "$ref": "#/$defs/roadmap" }
        },
        "milestones": {
          "type": "array",
          "items": { "$ref": "#/$defs/milestone" }
        },
        "workstreams": {
          "type": "array",
          "items": { "$ref": "#/$defs/workstream" }
        },
        "initiatives": {
          "type": "array",
          "items": { "$ref": "#/$defs/initiative" }
        },
        "items": {
          "type": "array",
          "items": { "$ref": "#/$defs/executionItem" }
        },
        "decisions": {
          "type": "array",
          "items": { "$ref": "#/$defs/decision" }
        },
        "risks": {
          "type": "array",
          "items": { "$ref": "#/$defs/risk" }
        },
        "artifacts": {
          "type": "array",
          "items": { "$ref": "#/$defs/artifact" }
        }
      }
    },
    "roadmap": {
      "type": "object",
      "required": ["id", "title", "status", "milestoneIds"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "horizon": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "milestoneIds": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "milestone": {
      "type": "object",
      "required": ["id", "title", "objective", "status", "exitCriteria"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "objective": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "exitCriteria": {
          "type": "array",
          "items": { "type": "string" }
        },
        "initiativeIds": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "workstream": {
      "type": "object",
      "required": ["id", "title"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "type": { "type": "string" },
        "relatedNormativeAreas": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "initiative": {
      "type": "object",
      "required": ["id", "title", "status"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "workstreamId": { "type": "string" },
        "milestoneId": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "purpose": { "type": "string" },
        "deliverables": {
          "type": "array",
          "items": { "type": "string" }
        },
        "itemIds": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "executionItem": {
      "type": "object",
      "required": ["id", "type", "title", "status", "priority"],
      "properties": {
        "id": { "type": "string" },
        "type": {
          "type": "string",
          "enum": [
            "task",
            "decision",
            "question",
            "blocker",
            "risk",
            "experiment",
            "review",
            "agent_prompt",
            "doc_update",
            "spike",
            "artifact",
            "bug",
            "follow_up"
          ]
        },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "priority": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"]
        },
        "initiativeId": { "type": "string" },
        "workstreamId": { "type": "string" },
        "dependsOn": {
          "type": "array",
          "items": { "type": "string" }
        },
        "acceptanceCriteria": {
          "type": "array",
          "items": { "type": "string" }
        },
        "sourceNormativeDocuments": {
          "type": "array",
          "items": { "type": "string" }
        },
        "suggestedExecutor": {
          "type": "object",
          "properties": {
            "type": { "type": "string" },
            "agentProfile": { "type": "string" }
          }
        },
        "suggestedExports": {
          "type": "object",
          "additionalProperties": true
        }
      }
    },
    "decision": {
      "type": "object",
      "required": ["id", "title", "status", "decision"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "context": { "type": "string" },
        "decision": { "type": "string" },
        "consequences": {
          "type": "array",
          "items": { "type": "string" }
        },
        "affectedNormativeDocuments": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "risk": {
      "type": "object",
      "required": ["id", "title", "likelihood", "impact"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "likelihood": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "impact": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "mitigation": { "type": "string" }
      }
    },
    "artifact": {
      "type": "object",
      "required": ["id", "type", "title"],
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "title": { "type": "string" },
        "path": { "type": "string" },
        "generatedFrom": {
          "type": "array",
          "items": { "type": "string" }
        },
        "relatedItemIds": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "exportConfig": {
      "type": "object",
      "required": ["enabled", "mappingProfile"],
      "properties": {
        "enabled": { "type": "boolean" },
        "mappingProfile": { "type": "string" }
      }
    },
    "status": {
      "type": "string",
      "enum": [
        "draft",
        "planned",
        "ready",
        "in_progress",
        "blocked",
        "reviewing",
        "done",
        "cancelled",
        "superseded"
      ]
    }
  }
}
```

---

## 12. Adapter System

Adapters transform the Executive JSON into tool-specific formats.

Each adapter should define:

```txt
1. supported LOGOS entity types
2. target tool object types
3. field mappings
4. label/tag mappings
5. body/content templates
6. unsupported features
7. export format
8. import/snapshot strategy, if available
```

---

## 13. Linear Adapter

### 13.1 Purpose

Export execution items into Linear issues, projects, labels, and milestones where supported.

### 13.2 Concept Mapping

| LOGOS | Linear |
|---|---|
| Roadmap | Project / Initiative grouping |
| Milestone | Milestone or project phase |
| Initiative | Project |
| Workstream | Label / Team / Project area |
| Execution Item: task | Issue |
| Execution Item: bug | Issue |
| Execution Item: risk | Issue with risk label |
| Execution Item: decision | Issue or linked document |
| Execution Item: review | Issue with checklist |
| Priority | Linear priority |
| Status | Linear state |

### 13.3 Mapping Example

```json
{
  "adapter": "linear",
  "version": "1.0.0",
  "maps": {
    "roadmap": "project_group",
    "milestone": "milestone",
    "initiative": "project",
    "item.task": "issue",
    "item.bug": "issue",
    "item.risk": "issue",
    "item.decision": "issue",
    "item.review": "issue"
  },
  "fields": {
    "title": "title",
    "description": "description",
    "priority": "priority",
    "status": "state",
    "labels": "labels"
  },
  "priorityMap": {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4
  }
}
```

### 13.4 Export Shape Example

```json
{
  "issues": [
    {
      "title": "Create base document schema",
      "description": "Create a schema that supports canonical outputs, derived artifacts, exports, and agent packs.\n\n## Acceptance Criteria\n- Schema validates existing phase files.\n- Schema supports markdown, html, json, yaml, and prompt outputs.\n- Schema avoids compact mappings that trigger YAML parser warnings.\n\n## LOGOS Metadata\n- logosItemId: item-001\n- initiativeId: init-001\n- workstreamId: ws-documentation-system",
      "priority": 3,
      "labels": ["documentation", "schema"]
    }
  ]
}
```

---

## 14. GitHub Issues Adapter

### 14.1 Purpose

Export execution items into repository-linked GitHub Issues.

### 14.2 Concept Mapping

| LOGOS | GitHub |
|---|---|
| Execution Item | Issue |
| Initiative | Milestone or label |
| Workstream | Label |
| Acceptance Criteria | Markdown checklist |
| Dependencies | Linked issue references or body metadata |
| Decision | Issue / Discussion / Markdown decision record |
| Agent Prompt | Markdown file or issue body |

### 14.3 Mapping Example

```json
{
  "adapter": "github-issues",
  "version": "1.0.0",
  "maps": {
    "item.task": "issue",
    "item.review": "issue",
    "item.risk": "issue",
    "item.decision": "issue",
    "item.agent_prompt": "markdown_file"
  },
  "labels": {
    "task": ["task"],
    "review": ["review"],
    "risk": ["risk"],
    "decision": ["decision"],
    "documentation": ["documentation"]
  },
  "bodyTemplate": "github-issue.default.md"
}
```

### 14.4 Generated Issue Body Example

```md
# Create base document schema

## Purpose

Create a schema that supports canonical outputs, derived artifacts, exports, and agent packs.

## Source Normative Documents

- `docs.yml`
- `phases/01-foundation.yml`

## Acceptance Criteria

- [ ] Schema validates existing phase files.
- [ ] Schema supports markdown, html, json, yaml, and prompt outputs.
- [ ] Schema avoids compact mappings that trigger YAML parser warnings.

## Related Initiative

`init-001` — Implement Documentation Schema v1

## LOGOS Metadata

```json
{
  "logosItemId": "item-001",
  "workstreamId": "ws-documentation-system",
  "initiativeId": "init-001"
}
```

---

## 15. Notion Adapter

### 15.1 Purpose

Export the Executive JSON into Notion databases or pages.

### 15.2 Concept Mapping

| LOGOS | Notion |
|---|---|
| Roadmap | Page / Database view |
| Milestone | Database row / Select property |
| Initiative | Database row |
| Execution Item | Task row |
| Decision | Decision database row |
| Risk | Risk database row |
| Artifact | Page attachment/link |
| Workstream | Select / Relation |

### 15.3 Notion Database Structure

Recommended databases:

```txt
Tasks
Initiatives
Milestones
Decisions
Risks
Artifacts
```

Minimal single-database option:

```txt
Execution Items
```

### 15.4 Mapping Example

```json
{
  "adapter": "notion",
  "version": "1.0.0",
  "mode": "database",
  "databases": {
    "items": "Execution Items",
    "initiatives": "Initiatives",
    "milestones": "Milestones",
    "decisions": "Decisions",
    "risks": "Risks"
  },
  "fields": {
    "title": "Name",
    "type": "Type",
    "status": "Status",
    "priority": "Priority",
    "workstreamId": "Workstream",
    "initiativeId": "Initiative",
    "acceptanceCriteria": "Acceptance Criteria",
    "sourceNormativeDocuments": "Source Docs"
  }
}
```

---

## 16. Markdown Adapter

### 16.1 Purpose

Generate readable snapshots and review documents.

Markdown should not be the live execution backend.

It should be used for:

- implementation plans;
- weekly reviews;
- decision summaries;
- agent prompts;
- Git-friendly snapshots;
- human review.

### 16.2 Output Examples

```txt
executive/exports/markdown/
├── implementation-plan.md
├── weekly-review.md
├── decisions.md
├── risks.md
└── agent-prompts.md
```

---

## 17. HTML Adapter

### 17.1 Purpose

Generate navigable visual artifacts for understanding the plan.

HTML is a derived artifact, not source of truth.

Suitable outputs:

```txt
executive/exports/html/
├── executive-overview.html
├── roadmap-map.html
├── milestone-board.html
├── risk-dashboard.html
└── reconciliation-report.html
```

### 17.2 HTML Rules

- Must declare source JSON file.
- Must declare generation timestamp.
- Must not be edited manually as canonical state.
- Must be regenerable.
- Must preserve traceability to normative documents.

---

## 18. Agent Pack Adapter

### 18.1 Purpose

Generate implementation prompts for coding agents or review agents.

Target tools may include:

- OpenCode;
- Codex;
- Claude Code;
- GitHub Copilot agents;
- custom agent runners.

### 18.2 Agent Pack Structure

```txt
executive/exports/agent-packs/
├── opencode/
│   ├── TASK-0001.md
│   └── TASK-0002.md
├── codex/
│   ├── REVIEW-0001.md
│   └── IMPLEMENT-0001.md
└── review/
    ├── DIFF-REVIEW-0001.md
    └── ACCEPTANCE-CHECK-0001.md
```

### 18.3 Prompt Template

```md
# Agent Task: {{title}}

## Objective

{{description}}

## Source Normative Documents

{{sourceNormativeDocuments}}

## Required Changes

{{instructions}}

## Acceptance Criteria

{{acceptanceCriteria}}

## Constraints

- Do not change unrelated files.
- Preserve existing schema conventions.
- Avoid compact YAML mappings if YAML is generated.
- Update documentation if the schema changes.

## Expected Output

{{expectedArtifacts}}
```

---

## 19. Import and Reconciliation

The first version of the Executive Axis should focus on export.

Future versions may support imports or snapshots from execution tools.

### 19.1 Phase 1 — Export Only

```txt
Normative docs → Executive JSON → External tool exports
```

Goal:

- produce usable execution structure;
- avoid sync complexity;
- keep LOGOS focused on generation and clarity.

### 19.2 Phase 2 — Import Snapshots

```txt
External tool → snapshot.json → LOGOS review
```

Goal:

- inspect actual execution state;
- identify drift;
- detect orphan tasks;
- compare external execution against normative intent.

### 19.3 Phase 3 — Reconciliation

```txt
Normative Axis
Executive JSON
External Snapshot
        ↓
Reconciliation Report
```

The reconciliation report should answer:

- what advanced;
- what stalled;
- what was cancelled;
- what changed outside LOGOS;
- which tasks no longer match the normative axis;
- which decisions should update canonical documents;
- which risks became real;
- which generated items were ignored;
- which new items appeared externally.

---

## 20. Suggested Repository Structure

```txt
logos/
├── normative/
│   ├── docs.yml
│   ├── phases/
│   ├── schemas/
│   └── templates/
│
├── executive/
│   ├── executive-plan.schema.json
│   ├── executive-plan.json
│   ├── mappings/
│   │   ├── linear.mapping.json
│   │   ├── notion.mapping.json
│   │   ├── github-issues.mapping.json
│   │   ├── github-projects.mapping.json
│   │   ├── markdown.mapping.json
│   │   ├── html.mapping.json
│   │   └── agent-pack.mapping.json
│   ├── exports/
│   │   ├── linear/
│   │   ├── notion/
│   │   ├── github/
│   │   ├── markdown/
│   │   ├── html/
│   │   └── agent-packs/
│   └── imports/
│       ├── linear/
│       ├── notion/
│       └── github/
```

Alternative if the project wants to keep repository roots flatter:

```txt
logos/
├── docs.yml
├── phases/
├── schemas/
├── docs/
├── executive/
│   ├── executive-plan.json
│   ├── executive-plan.schema.json
│   ├── mappings/
│   └── exports/
```

---

## 21. Generation Flow

### 21.1 Input

The generator consumes:

```txt
- docs.yml
- phase files
- document schemas
- canonical Markdown docs, if already filled
- project profile
- selected export targets
- generation constraints
```

### 21.2 Compilation

The generator derives:

```txt
- roadmaps
- milestones
- workstreams
- initiatives
- execution items
- decisions
- risks
- artifacts
- acceptance criteria
- agent prompts
- export metadata
```

### 21.3 Validation

The generated JSON must be validated against:

```txt
executive-plan.schema.json
```

Validation checks:

- required fields exist;
- IDs are unique;
- references point to existing entities;
- item dependencies exist;
- each item has a status;
- each export target has a mapping profile;
- source normative documents are declared;
- execution items have actionable titles and acceptance criteria where appropriate.

### 21.4 Export

Adapters generate target outputs.

```txt
executive-plan.json
  ↓
linear export
notion export
github issue files
markdown review docs
html overview
agent packs
```

---

## 22. Validation Rules

The Executive JSON should enforce at least these rules:

### 22.1 Identity Rules

- Every entity must have a stable `id`.
- IDs must be unique within their entity collection.
- Cross-references must resolve.

### 22.2 Traceability Rules

- Every execution item should reference at least one source normative document when possible.
- Every initiative should link to a milestone or explain why it is standalone.
- Every generated artifact should declare its source entities.

### 22.3 Actionability Rules

A task-like item should have:

- clear title;
- description;
- status;
- priority;
- acceptance criteria;
- source normative documents;
- suggested export target or executor.

### 22.4 Adapter Rules

- Unsupported fields must not be silently lost.
- If a target tool cannot represent a concept, the adapter must preserve it in metadata or body text.
- Adapter output must include LOGOS IDs to support future reconciliation.

### 22.5 Source-of-Truth Rules

- Executive JSON is the exchange model.
- External tools are the live operational surface after export.
- HTML and Markdown exports are derived artifacts.
- Generated artifacts must not be treated as canonical source unless explicitly promoted.

---

## 23. Why JSON Instead of YAML or Markdown?

### 23.1 JSON Advantages

JSON is better suited for the Executive Axis because it is:

- machine-native;
- easy to validate with JSON Schema;
- easy to transform;
- easy to serialize;
- broadly compatible with APIs;
- suitable for adapter pipelines;
- less ambiguous than YAML;
- easier to consume in JavaScript/TypeScript runtimes;
- appropriate as an exchange format.

### 23.2 Why Not YAML?

YAML is excellent for human-authored configuration but weaker for volatile generated execution models.

Risks:

- indentation fragility;
- parser differences;
- compact mapping pitfalls;
- excessive manual editing temptation;
- ambiguity in types;
- less direct compatibility with external APIs.

### 23.3 Why Not Markdown?

Markdown is excellent for human-readable documents and generated reports.

It is weak as an execution interchange format because:

- structure is implicit;
- parsing is brittle;
- relationships are hard to enforce;
- schemas are indirect;
- adapters need predictable structured data.

### 23.4 Final Format Rule

```txt
Markdown/YAML = normative clarity and human documents
JSON = portable executive model
Adapters = external execution integration
HTML/Markdown = derived review artifacts
Agent packs = execution prompts
```

---

## 24. Why Not Build a UI?

A custom UI would create unnecessary scope.

The project would need to solve:

- task list management;
- status workflows;
- comments;
- notifications;
- assignments;
- filters;
- boards;
- calendars;
- permissions;
- collaboration;
- integrations;
- sync;
- conflict resolution.

This would duplicate tools that already exist.

LOGOS should instead focus on its unique value:

```txt
turning normative clarity into portable execution structure
```

The UI, if any, should be limited to generated review artifacts, not a live task manager.

---

## 25. Trade-offs

### 25.1 Benefits

- avoids building a task management app;
- keeps LOGOS focused on clarity and compilation;
- supports multiple execution tools;
- allows users to choose their preferred workflow;
- makes execution portable;
- keeps generated plans auditable;
- enables agent execution;
- enables future reconciliation;
- reduces operational complexity;
- supports Git-friendly snapshots without forcing Git as the live task layer.

### 25.2 Costs

- adapters require maintenance;
- each external tool has limitations;
- some LOGOS semantics will be flattened;
- import/reconciliation can become complex;
- external tools may diverge from generated plans;
- perfect bidirectional sync should not be assumed;
- users may need to choose an execution destination.

### 25.3 Accepted Trade-off

It is better to lose some semantic fidelity during export than to build and maintain a full task management system.

---

## 26. Non-Goals

The Executive Axis will not initially provide:

- proprietary task board;
- full UI for editing execution state;
- real-time collaboration;
- notifications;
- calendar scheduling;
- bidirectional sync;
- automatic status reconciliation;
- external API writes without explicit adapter design;
- full replacement for Linear, Notion, GitHub Projects, or similar tools.

---

## 27. MVP Scope

### 27.1 MVP Must Include

- `executive-plan.schema.json`;
- `executive-plan.json` generation;
- core entity model;
- validation rules;
- Markdown export adapter;
- GitHub Issues export adapter or file generator;
- agent-pack export adapter;
- HTML overview export adapter;
- clear metadata for traceability.

### 27.2 MVP Should Include

- Linear mapping profile;
- Notion mapping profile;
- dependency validation;
- generated implementation plan;
- generated risk list;
- generated decision list.

### 27.3 MVP Can Defer

- API-based writes to Linear/Notion/GitHub;
- import adapters;
- reconciliation reports;
- status sync;
- custom UI;
- database-backed execution runtime.

---

## 28. Future Evolution

### 28.1 Import Adapters

Support snapshots from external tools.

```txt
Linear export → linear.snapshot.json
GitHub Issues → github.snapshot.json
Notion database → notion.snapshot.json
```

### 28.2 Reconciliation Engine

Compare:

```txt
Normative Axis
Executive JSON
External Snapshot
```

Produce:

```txt
reconciliation-report.html
reconciliation-report.md
normative-update-suggestions.json
```

### 28.3 Semantic Drift Detection

Detect when external execution no longer reflects the normative project structure.

Examples:

- orphan tasks;
- stale initiatives;
- completed work with no normative update;
- decisions made in execution but not reflected in docs;
- risks that became blockers;
- repeated task churn around unclear specs.

### 28.4 Agent-Orchestrated Execution

Generate, dispatch, and review agent packs.

Possible flow:

```txt
Executive Item
  ↓
Agent Pack
  ↓
Agent Execution
  ↓
Diff / Output
  ↓
Review Item
  ↓
Decision
  ↓
Normative Update
```

---

## 29. Example End-to-End Flow

### 29.1 User Intent

```txt
Generate an execution plan for implementing the LOGOS documentation schema and export it to GitHub Issues and agent prompts.
```

### 29.2 LOGOS Reads

```txt
docs.yml
phases/*.yml
schema definitions
canonical docs
```

### 29.3 LOGOS Generates

```txt
executive/executive-plan.json
```

### 29.4 LOGOS Validates

```txt
executive/executive-plan.schema.json
```

### 29.5 LOGOS Exports

```txt
executive/exports/github/issues/*.md
executive/exports/agent-packs/opencode/*.md
executive/exports/html/executive-overview.html
executive/exports/markdown/implementation-plan.md
```

### 29.6 Human or Agent Imports

The user imports the generated issues into GitHub or sends the agent packs to the relevant coding agent.

### 29.7 Execution Happens Externally

GitHub, Linear, or Notion tracks the live execution.

### 29.8 Future Reconciliation

LOGOS may later compare external execution state against the original Executive JSON and the current Normative Axis.

---

## 30. Canonical Summary

The Executive Axis must be designed around portability, not ownership.

The correct architecture is:

```txt
YAML/Markdown = normative truth
JSON = portable execution model
Adapters = transformation layer
External tools = operational surface
HTML/Markdown = review artifacts
Agent packs = executable prompts
```

The core decision:

> **Do not build a task manager. Build an execution compiler.**

The Executive Axis exists to convert project clarity into structured, transferable execution.

It should be easy to export, easy to inspect, easy to validate, and easy to adapt — but it should not require users to manage their daily work inside LOGOS.

That is what keeps LOGOS focused, extensible, and strategically clean.
