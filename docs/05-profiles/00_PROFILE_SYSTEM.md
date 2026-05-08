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
  profile.json
  phases.json
  decisions.json
  questions/
  validations/
  risks/
  templates/
```

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
