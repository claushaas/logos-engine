# Product Requirements

## Functional Requirements

### Project Initialization

The system must:

- detect the current directory;
- initialize LOGOS metadata;
- let the user select a profile;
- create canonical folders;
- create initial documents;
- create project state files.

### Guided Intake

The system must:

- ask questions in small groups;
- avoid overwhelming the user;
- allow unknown answers;
- record answers;
- derive decisions when possible;
- mark incomplete areas.

### Decision Registry

The system must store:

- decision id;
- title;
- value;
- status;
- source answer ids;
- confidence;
- affected documents;
- dependencies;
- created date;
- updated date.

### Documentation Rendering

The system must:

- render Markdown documents;
- preserve user-editable sections when appropriate;
- mark generated sections clearly;
- avoid overwriting manual content without warning.

### Validation

The system must:

- validate required decisions;
- detect missing inputs;
- detect contradictions where possible;
- classify gaps by severity.

### Diagnostics

The system must output:

- gaps;
- risks;
- assumptions;
- next recommended questions;
- affected documents.

## Non-Functional Requirements

### Local-First

The system should work without a network connection.

### Git-Friendly

All output should be text-based and diff-friendly.

### Extensible

Profiles should be configurable and independently versioned.

### Auditable

The user should be able to inspect how a document was produced.

### Safe

The system should not send project content to an LLM provider unless explicitly configured.

## V1 Acceptance Criteria

V1 is complete when a user can:

1. initialize an app-business project;
2. answer guided questions;
3. generate a full documentation skeleton;
4. fill core documents incrementally;
5. run diagnostics;
6. inspect gaps;
7. commit everything to Git.
