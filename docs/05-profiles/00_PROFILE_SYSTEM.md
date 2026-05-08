# Profile System

## Purpose

Profiles define outcome-specific logic.

The engine remains generic. Profiles specialize it.

## A Profile Defines

- outcome type;
- phases;
- canonical documents;
- decision schema;
- questions;
- conditional logic;
- validation rules;
- risk patterns;
- dependency mappings;
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

## Profile Structure

```text
profiles/app-business/
  profile.yml
  phases.yml
  documents.yml
  decisions.yml
  questions.yml
  validations.yml
  risks.yml
  prompts.yml
  templates/
```

YAML is preferred for profile contract files because profiles are authored and reviewed by humans.

The implementation may load YAML into typed runtime objects and validate them with schemas.

Markdown files in `docs/05-profiles/` explain the profile contract for humans. They should not be the engine's primary machine-readable source of truth.

## Document Contract Files

Canonical document definitions should live in `documents.yml`.

That file should define:

- document id;
- phase id;
- output path;
- title;
- purpose;
- required inputs;
- primary questions;
- section structure;
- generated outputs;
- completion criteria;
- dependencies;
- related validation rules;
- prompt context requirements.

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
