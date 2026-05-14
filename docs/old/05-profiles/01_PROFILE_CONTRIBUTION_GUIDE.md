# Profile Contribution Guide

LOGOS Engine uses outcome profiles to define what documents, AI intake coverage prompts, validation rules, and templates are used for a given project type.

## What Is a Profile?

A profile is a structured YAML contract that defines:

- **Phases** — ordered stages of the workflow (e.g. intake, market, economics, product).
- **Documents** — canonical output documents with internal structure, completion criteria, and dependencies.
- **Questions** — structured coverage prompts the AI can use when leading intake, with help text, examples, and answer types.
- **Validations** — deterministic rules that check for structural completeness.
- **Templates** — Markdown templates for rendering each document.
- **Risk patterns** — known high-risk combinations to flag.

## Profile File Structure

```text
profiles/<profile-id>/
  profile.yml         # Metadata, phases, version
  documents.yml        # Canonical document definitions
  questions.yml        # AI intake coverage prompts
  validations.yml      # Deterministic validation rules
  templates/           # Markdown templates per phase
    00-intake/
    01-market/
    ...
```

## Creating a New Profile

### 1. Choose a Profile ID

Use a short, descriptive kebab-case identifier: `saas`, `course`, `agency`, `ecommerce`, `research`, `open-source-project`.

### 2. Define `profile.yml`

```yaml
id: saas
name: SaaS Business
version: "1.0.0"
description: Complete documentation for a SaaS product business.
phases:
  - id: "00-intake"
    label: Intake
    order: 0
    description: Foundation and idea clarification
  - id: "01-market"
    label: Market
    order: 1
    description: Market analysis and positioning
  # ... additional phases
```

### 3. Define `documents.yml`

Each document must include:

```yaml
documents:
  - id: idea_brief
    title: Idea Brief
    phaseId: "00-intake"
    outputPath: "docs/00-intake/IDEA_BRIEF.md"
    purpose: Capture the core idea and motivation.
    primaryQuestions:
      - q_idea_summary
      - q_problem_statement
    requiredDecisions:
      - d_product_category
    recommendedStructure:
      - Idea Summary
      - Problem Statement
      - Target Users
      - Success Criteria
    generatedOutputs:
      - Narrative idea description
      - Problem framing
    completionCriteria:
      - Idea is described clearly
      - Problem is stated specifically
      - Target users are identified
    dependencies: []
```

### 4. Define `questions.yml`

Each question defines coverage the AI should satisfy during conversation:

```yaml
questions:
  - id: q_idea_summary
    phaseId: "00-intake"
    text: In 2-3 sentences, what does your product do?
    helpText: Focus on the core value proposition.
    answerType: text
    mappedDecisions:
      - d_product_summary
    unknownBehavior: mark_as_open_question
    assumptionBehavior: flag_review
```

Supported answer types: `text`, `choice`, `multi_choice`, `number`, `boolean`.

These questions are not the user-facing flow. They should help the AI ask better questions and map answers to decisions without requiring the user to select question ids.

### 5. Define `validations.yml`

```yaml
validations:
  - id: v_market_size_defined
    description: Market size must be defined before completing the market phase.
    severity: error
    phaseId: "01-market"
    check: required_decision
    decisionId: d_market_size
    affectedDocuments:
      - market_analysis
```

### 6. Create Templates

Create a Markdown template for each document under `profiles/<profile-id>/templates/<phase>/<DOCUMENT_NAME>.md`. Use YAML frontmatter and placeholder sections:

```markdown
---
title: Idea Brief
status: draft
generated: false
---

# Idea Brief

## Idea Summary

<!-- LOGOS:IDEA_SUMMARY -->

## Problem Statement

<!-- LOGOS:PROBLEM_STATEMENT -->
```

### 7. Test Your Profile

The profile loader validates:

- No duplicate IDs (documents, questions, validations).
- No duplicate output paths.
- Phase references exist.
- Template references exist (when `templates/` is present).
- Every document has completion criteria.
- Every question has an answer type.

## Profile Design Principles

1. **Phases should be sequential but allow skipping.** Users should move forward even with unknowns.
2. **Documents should be complete, not just named.** Define internal structure.
3. **Questions should guide the AI without becoming a script.** Provide examples but let the AI adapt the conversation.
4. **Validation rules should be deterministic.** No AI judgment in validation.
5. **Dependencies should be explicit.** Which decisions does each document need?

## Contributing a Profile

1. Fork the repository.
2. Create your profile directory under `profiles/`.
3. Implement the profile files as described above.
4. Add the documentation mirror under `docs/05-profiles/<profile-id>/`.
5. Add profile loader tests.
6. Open a PR using the [Profile Contribution template](https://github.com/user/logos-engine/issues/new?template=profile_contribution.md).

## Profile Review Criteria

Profiles are reviewed for:

- Completeness — do documents, questions, and validations cover the use case?
- Schema validity — does the profile load and validate?
- Practicality — would this produce useful documentation?
- Consistency — do phase IDs, document paths, and question IDs match?
- Value — does the profile fill a real gap?
