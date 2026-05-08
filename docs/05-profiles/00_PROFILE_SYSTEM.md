# Profile System

## Purpose

Profiles define outcome-specific logic.

The engine remains generic. Profiles specialize it.

## A Profile Defines

- outcome type;
- phases;
- canonical documents;
- question sets;
- decision ids and decision mappings;
- conditional logic;
- validation rules;
- risk patterns;
- dependency mappings;
- prompt context requirements;
- terminology.

## Example Profiles

```text
profiles/
  app-business/
  saas/
  website/
  ecommerce/
  online-course/
  book/
  agency/
  research-project/
```

## V1 Profile

The V1 profile is:

```text
app-business
```

## Profile Design Principle

A profile should not be a loose collection of prompts.

It should be a structured specification.

Profiles are the contract that lets the engine stay generic while each outcome remains specific.

The engine should load profile contracts from structured YAML and validate them with typed schemas before runtime use.

Markdown may explain the system for humans, but Markdown should not be the primary machine-readable profile source.

## V1 Profile Structure

The V1 App Business profile currently uses these contract files:

```text
docs/05-profiles/app-business/
  profile.yml
  documents.yml
  questions.yml
  validations.yml
```

In a packaged implementation, these files may live under a runtime path such as:

```text
profiles/app-business/
```

The docs path is acceptable during planning because it keeps the profile contract visible while the implementation is still being designed.

## Contract Files

### `profile.yml`

Defines high-level profile metadata:

- profile id;
- version;
- name;
- description;
- target user;
- expected outcomes;
- canonical phases;
- paths to related contract files.

### `documents.yml`

Defines canonical generated documents:

- document id;
- phase id;
- output path;
- title;
- template path;
- purpose;
- primary questions;
- required inputs;
- section structure;
- generated outputs;
- completion criteria;
- dependencies;
- related validation rules;
- prompt context requirements.

### `questions.yml`

Defines guided question sets:

- question set id;
- phase id;
- title;
- purpose;
- question ids;
- question text;
- help text;
- examples;
- answer type;
- choice or multi-choice options;
- mapped decision ids;
- unknown and assumption behavior.

Questions should guide the user without forcing an answer.

### `validations.yml`

Defines deterministic validation rules:

- rule id;
- phase id;
- title;
- severity;
- description;
- conditions;
- required decisions;
- affected documents;
- suggested next action where useful.

Validation rules must remain deterministic. AI may explain or summarize validation results, but it should not replace the rules.

## Future Contract Files

The profile system may later split more concerns into dedicated YAML files:

```text
profiles/app-business/
  decisions.yml
  risks.yml
  prompts.yml
  templates/
```

These files should be added only when they remove real complexity from the current contracts.

## YAML as Source of Truth

YAML is preferred for profile contracts because profiles are authored and reviewed by humans.

The implementation should:

- parse YAML with a real YAML parser;
- validate each file against schemas;
- reject duplicate ids;
- reject invalid references;
- reject missing required fields;
- expose clear profile validation errors;
- convert YAML into typed runtime objects.

## Reference Integrity

A profile should validate references across contract files.

Examples:

- every document `phaseId` must exist in `profile.yml`;
- every question `phaseId` must exist in `profile.yml`;
- every `mapsToDecisionIds` entry should reference a known or allowed decision id;
- every validation `affectedDocuments` entry should reference a document id from `documents.yml`;
- every document `validationRules` entry should reference a rule id from `validations.yml`;
- every template path should resolve when templates are implemented.

## Profile Versioning

Profiles should be versioned.

A project should lock the profile version used during initialization.

Example:

```json
{
  "profileId": "app-business",
  "profileVersion": "0.1.0"
}
```

## Generated Documentation

Generated Markdown documents are outputs of the profile.

For App Business, `documents.yml` defines the canonical tree under `docs/`.

The generated documents should be treated as projections of structured state, not as the source of truth.
