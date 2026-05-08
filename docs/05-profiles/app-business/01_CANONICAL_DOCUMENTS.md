<!-- markdownlint-disable MD025 -->

# App Business Canonical Documents

## Purpose

This document defines the canonical documentation set for the `app-business` profile.

A profile must not only define which documents should be generated. It must also define the ideal internal structure, required sections, input decisions, expected outputs, and completion criteria for each document.

The machine-readable source of truth for these definitions should be:

```text
profiles/app-business/documents.yml
```

This Markdown document explains the document contract for humans. The engine should load and validate `documents.yml`, not parse this Markdown file as its primary profile definition.

The goal is not to generate short summaries.

The goal is to generate complete, useful, implementation-ready documentation that helps the user clarify, evaluate, design, build, launch, and operate an app-based business.

Assertive writing does not mean shallow writing.

LOGOS Engine should produce documents that are:

- direct;
- complete;
- structured;
- auditable;
- decision-aware;
- implementation-oriented;
- explicit about assumptions and gaps.

## Canonical Document Contract

Every canonical document in a profile should define:

1. **Purpose** — why the document exists.
2. **Primary Questions** — which questions the document must answer.
3. **Required Inputs** — which decisions, assumptions, or user answers are needed.
4. **Recommended Structure** — the ideal sections of the document.
5. **Generated Outputs** — what concrete artifacts the document should produce.
6. **Completion Criteria** — what must be true for the document to be considered usable.
7. **Dependencies** — which other documents or decisions affect it.
8. **Open Questions** — what still needs clarification.
9. **Risks** — what can go wrong if this document is weak or incomplete.

## Recommended YAML Shape

Each document should be represented as structured YAML.

Example:

```yml
documents:
  - id: intake.idea_brief
    phaseId: 00-intake
    path: docs/00-intake/IDEA_BRIEF.md
    title: Idea Brief
    template: templates/00-intake/IDEA_BRIEF.md
    purpose: Capture the initial idea with enough clarity to support structured exploration.
    primaryQuestions:
      - What is the idea?
      - Who is it for?
      - What problem does it solve?
      - Why does it matter?
    requiredInputs:
      decisions:
        - foundation.initial_idea
        - foundation.target_user
        - foundation.problem_statement
      assumptions: []
      answers:
        - foundation.idea
    sections:
      - id: purpose
        title: Purpose
        required: true
      - id: initial_idea
        title: Initial Idea
        required: true
      - id: target_user
        title: Target User
        required: true
      - id: problem_statement
        title: Problem Statement
        required: true
      - id: assumptions
        title: Assumptions
        required: true
      - id: open_questions
        title: Open Questions
        required: true
    generatedOutputs:
      - initial idea summary
      - target user statement
      - problem statement
      - early risks and open questions
    completionCriteria:
      - Initial idea is explicitly stated.
      - Target user is explicitly stated.
      - Problem statement is explicitly stated.
      - Desired outcome is explicitly stated.
    dependencies:
      documents: []
      decisions: []
    validationRules:
      - foundation.target_user_required
      - foundation.problem_required
    promptContext:
      includeConfirmedDecisions: true
      includeAssumptions: true
      includeOpenQuestions: true
```

The YAML does not need to store long prose when concise structured fields are enough. Long explanatory prose may remain in Markdown documentation or templates.

## Standard Document Sections

Unless a specific document overrides this pattern, every generated document should include:

```md
# Document Title

## Purpose

## Executive Summary

## Confirmed Decisions

## Assumptions

## Open Questions

## Risks

## Dependencies

## Main Content

## Completion Criteria

## Next Actions
```

The `Main Content` section should be expanded according to the document type.

---

# 00 Intake

## IDEA_BRIEF.md

### Purpose

Capture the initial idea with enough clarity to support structured exploration.

### Primary Questions

- What is the idea?
- Who is it for?
- What problem does it solve?
- Why does it matter?
- What outcome should exist when the project succeeds?

### Required Inputs

- initial app idea;
- target user;
- problem statement;
- desired outcome;
- current known constraints.

### Recommended Structure

```md
# Idea Brief

## Purpose
## Initial Idea
## Target User
## Problem Statement
## Desired Outcome
## Current Alternatives
## Early Differentiation
## Initial Scope Boundaries
## Known Constraints
## Confirmed Decisions
## Assumptions
## Open Questions
## Risks
## Next Actions
```

### Completion Criteria

The document is usable when the idea, target user, problem, and desired outcome are explicitly stated.

## ASSUMPTIONS.md

### Purpose

Track all planning assumptions that are not yet validated.

### Recommended Structure

```md
# Assumptions

## Purpose
## Active Assumptions
## Business Assumptions
## Market Assumptions
## Product Assumptions
## Technical Assumptions
## Financial Assumptions
## Marketing Assumptions
## Validation Plan
## Deprecated Assumptions
```

### Completion Criteria

The document is usable when every non-confirmed claim that materially affects the project is recorded as an assumption.

## OPEN_QUESTIONS.md

### Purpose

Track unresolved questions that affect product, business, design, architecture, launch, or operations.

### Recommended Structure

```md
# Open Questions

## Purpose
## Critical Questions
## Important Questions
## Optional Questions
## Questions by Domain
### Market
### Business
### Economics
### Product
### Design
### Architecture
### Implementation
### Marketing
### Operations
## Resolved Questions
```

### Completion Criteria

The document is usable when unresolved questions are grouped by severity and domain.

---

# 01 Market

## MARKET_ANALYSIS.md

### Purpose

Evaluate whether the target market is understandable, reachable, and potentially viable.

### Primary Questions

- What market does this belong to?
- Who already serves this market?
- What alternatives exist?
- What trends matter?
- Where is the opportunity?

### Recommended Structure

```md
# Market Analysis

## Purpose
## Executive Summary
## Market Category
## Target Segment
## Market Context
## User Pain and Demand Signals
## Current Alternatives
## Market Size Reasoning
### TAM
### SAM
### SOM
## Market Trends
## Market Timing
## Barriers to Entry
## Opportunity Gaps
## Risks
## Assumptions
## Open Questions
## Validation Plan
## Next Actions
```

### Completion Criteria

The document is usable when the market category, target segment, alternatives, opportunity gap, and validation plan are explicit.

## COMPETITOR_MATRIX.md

### Purpose

Compare direct and indirect competitors to understand positioning, differentiation, and risk.

### Recommended Structure

```md
# Competitor Matrix

## Purpose
## Executive Summary
## Competitor Categories
### Direct Competitors
### Indirect Competitors
### Substitute Behaviors
## Comparison Table
## Feature Comparison
## Pricing Comparison
## Positioning Comparison
## UX Comparison
## Distribution Comparison
## Strengths and Weaknesses
## Differentiation Opportunities
## Risks
## Open Questions
## Next Actions
```

### Completion Criteria

The document is usable when at least direct alternatives, indirect alternatives, and substitute behaviors are identified.

## ICP.md

### Purpose

Define the ideal customer profile with enough precision to inform product, messaging, distribution, pricing, and onboarding.

### Recommended Structure

```md
# Ideal Customer Profile

## Purpose
## Executive Summary
## Primary User
## Buyer
## Decision Maker
## Segment Definition
## Jobs To Be Done
## Pain Points
## Existing Behaviors
## Willingness to Pay
## Acquisition Context
## Retention Drivers
## Exclusion Criteria
## Assumptions
## Open Questions
## Validation Plan
```

### Completion Criteria

The document is usable when the primary user, buyer, pain, current behavior, and acquisition context are explicit.

---

# 02 Business

## BUSINESS_MODEL.md

### Purpose

Define how the app creates, delivers, and captures value.

### Recommended Structure

```md
# Business Model

## Purpose
## Executive Summary
## Value Proposition
## Customer Segments
## Revenue Model
## Pricing Logic
## Cost Structure
## Distribution Model
## Retention Model
## Key Activities
## Key Resources
## Key Partners
## Strategic Advantages
## Business Risks
## Assumptions
## Open Questions
## Next Actions
```

### Completion Criteria

The document is usable when value creation, value delivery, and value capture are explicitly connected.

## POSITIONING.md

### Purpose

Define how the product should be understood by the market.

### Recommended Structure

```md
# Positioning

## Purpose
## Executive Summary
## Category
## Target Audience
## Core Promise
## Primary Differentiation
## Alternatives Replaced
## Messaging Pillars
## Tone of Voice
## Proof Points
## Anti-Positioning
## Landing Page Message
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when the category, audience, promise, and differentiation are clear enough to inform marketing and product decisions.

---

# 03 Economics

## PRICING.md

### Purpose

Define the pricing model and rationale.

### Recommended Structure

```md
# Pricing

## Purpose
## Executive Summary
## Pricing Model
## Pricing Tiers
## Free vs Paid Boundaries
## Trial Strategy
## Discount Strategy
## Payment Cadence
## Value Metric
## Willingness to Pay Assumptions
## Competitor Pricing Reference
## Risks
## Open Questions
## Validation Plan
```

### Completion Criteria

The document is usable when pricing model, price points, free/paid boundaries, and validation assumptions are explicit.

## FINANCIAL_MODEL.md

### Purpose

Capture financial assumptions and estimate viability.

### Recommended Structure

```md
# Financial Model

## Purpose
## Executive Summary
## Revenue Assumptions
## Fixed Costs
## Variable Costs
## Gross Margin
## CAC Assumptions
## LTV Assumptions
## Churn Assumptions
## Scenario Model
### Pessimistic
### Base Case
### Optimistic
## Runway Considerations
## Sensitivity Analysis
## Financial Risks
## Open Questions
## Next Actions
```

### Completion Criteria

The document is usable when cost, revenue, CAC, churn, and margin assumptions are explicit enough to produce scenarios.

## BREAK_EVEN.md

### Purpose

Calculate the minimum scale required for the business to cover its costs.

### Recommended Structure

```md
# Break-Even Analysis

## Purpose
## Executive Summary
## Formula
## Fixed Costs
## Variable Cost per User
## ARPU
## Contribution Margin per User
## Break-Even Users
## Scenario Table
## Sensitivity Analysis
## Risks
## Open Questions
## Next Actions
```

### Completion Criteria

The document is usable when fixed costs, ARPU, variable cost per user, and break-even user count are present.

---

# 04 Product

## PRODUCT_THESIS.md

### Purpose

Define why the product should exist and what must be true for it to matter.

### Recommended Structure

```md
# Product Thesis

## Purpose
## Executive Summary
## Problem
## Target User
## Current Alternatives
## Core Insight
## Product Hypothesis
## Value Proposition
## Core Loop
## Activation Moment
## Retention Hypothesis
## Differentiation
## Success Criteria
## Risks
## Assumptions
## Open Questions
```

### Completion Criteria

The document is usable when problem, user, product hypothesis, core loop, and success criteria are explicit.

## MVP_SCOPE.md

### Purpose

Define the smallest coherent version capable of validating the central product and business hypothesis.

### Recommended Structure

```md
# MVP Scope

## Purpose
## Executive Summary
## MVP Hypothesis
## Included Features
## Excluded Features
## Core User Flow
## Activation Requirement
## Retention Requirement
## Technical Scope
## Design Scope
## Analytics Scope
## Launch Scope
## Acceptance Criteria
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when included features, excluded features, core flow, and acceptance criteria are explicit.

## ROADMAP.md

### Purpose

Define staged product evolution.

### Recommended Structure

```md
# Product Roadmap

## Purpose
## Executive Summary
## Roadmap Principles
## Phase 0 — Validation
## Phase 1 — MVP
## Phase 2 — Beta
## Phase 3 — Public Launch
## Phase 4 — Retention and Growth
## Phase 5 — Scale
## Feature Backlog
## Deferred Ideas
## Decision Gates
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when phases, decision gates, and deferred ideas are explicit.

---

# 05 Design

## UX_FLOWS.md

### Purpose

Define the core user journeys and interaction logic.

### Recommended Structure

```md
# UX Flows

## Purpose
## Executive Summary
## Primary User Journey
## Onboarding Flow
## Core Loop Flow
## Empty States
## Error States
## Edge Cases
## Returning User Flow
## Upgrade or Payment Flow
## Support Flow
## Accessibility Considerations
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when onboarding, core loop, empty states, and critical edge cases are defined.

## DESIGN_DIRECTION.md

### Purpose

Define the visual and interaction direction for the app.

### Recommended Structure

```md
# Design Direction

## Purpose
## Executive Summary
## Design Principles
## Visual Tone
## Typography Direction
## Color Direction
## Layout Principles
## Component Principles
## Motion Principles
## Accessibility Principles
## Anti-Patterns
## References
## Open Questions
```

### Completion Criteria

The document is usable when visual tone, design principles, component direction, and anti-patterns are explicit.

## ONBOARDING.md

### Purpose

Define how a new user reaches first value.

### Recommended Structure

```md
# Onboarding

## Purpose
## Executive Summary
## First-Run Experience
## Activation Moment
## Required Inputs
## Progressive Disclosure
## Permission Requests
## Education Moments
## Drop-Off Risks
## Success Metrics
## Open Questions
```

### Completion Criteria

The document is usable when first-run experience, activation moment, and drop-off risks are defined.

---

# 06 Architecture

## ARCHITECTURE.md

### Purpose

Define the system architecture and its rationale.

### Recommended Structure

```md
# Architecture

## Purpose
## Executive Summary
## Architectural Principles
## System Context
## Runtime Architecture
## Application Layers
## Data Flow
## State Management
## Persistence
## Sync Strategy
## Authentication and Authorization
## Integrations
## Observability
## Security Considerations
## Scalability Considerations
## Architecture Decisions
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when core runtime, data flow, persistence, auth, integrations, and major trade-offs are explicit.

## TECH_STACK.md

### Purpose

Define technical choices and reasoning.

### Recommended Structure

```md
# Tech Stack

## Purpose
## Executive Summary
## Platform Targets
## Frontend Stack
## Backend Stack
## Database
## Authentication
## Hosting and Infrastructure
## Analytics
## Observability
## Testing Tools
## Development Tooling
## Alternatives Considered
## Trade-Offs
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when platform, frontend, backend, database, auth, and infra choices are explicit.

## DATA_MODEL.md

### Purpose

Define the core data structures.

### Recommended Structure

```md
# Data Model

## Purpose
## Executive Summary
## Domain Entities
## Entity Relationships
## Data Ownership
## Data Lifecycle
## Local Storage Model
## Remote Storage Model
## Sync-Relevant Data
## Sensitive Data
## Migration Considerations
## Open Questions
```

### Completion Criteria

The document is usable when primary entities, relationships, lifecycle, and storage model are explicit.

## API_SPEC.md

### Purpose

Define API contracts where needed.

### Recommended Structure

```md
# API Spec

## Purpose
## Executive Summary
## API Principles
## Authentication
## Endpoints
## Request and Response Shapes
## Error Model
## Pagination
## Rate Limits
## Versioning
## Webhooks
## Open Questions
```

### Completion Criteria

The document is usable when required APIs, auth, errors, and versioning expectations are explicit.

---

# 07 Implementation

## IMPLEMENTATION_PLAN.md

### Purpose

Define the execution sequence for building the app.

### Recommended Structure

```md
# Implementation Plan

## Purpose
## Executive Summary
## Implementation Principles
## Milestones
## Phase-by-Phase Plan
## Technical Dependencies
## Feature Dependencies
## Critical Path
## Validation Gates
## Definition of Done
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when milestones, dependencies, critical path, and validation gates are explicit.

## DEVELOPMENT_STANDARDS.md

### Purpose

Define code quality and development rules.

### Recommended Structure

```md
# Development Standards

## Purpose
## Executive Summary
## Code Style
## Project Structure
## Naming Conventions
## Testing Requirements
## Linting and Formatting
## Review Rules
## Error Handling
## Logging
## Security Rules
## Documentation Rules
## Open Questions
```

### Completion Criteria

The document is usable when development conventions and quality gates are explicit.

---

# 08 Testing

## TESTING_STRATEGY.md

### Purpose

Define how correctness, reliability, usability, and business-critical flows will be tested.

### Recommended Structure

```md
# Testing Strategy

## Purpose
## Executive Summary
## Testing Principles
## Unit Tests
## Integration Tests
## End-to-End Tests
## UX Testing
## Accessibility Testing
## Performance Testing
## Security Testing
## Offline and Sync Testing
## Release Validation
## Test Data
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when the test layers, critical flows, and release validation requirements are explicit.

---

# 09 Go-To-Market

## MARKETING_STRATEGY.md

### Purpose

Define how the app will reach, educate, and convert its target audience.

### Recommended Structure

```md
# Marketing Strategy

## Purpose
## Executive Summary
## Target Audience
## Positioning
## Core Message
## Acquisition Channels
## Content Strategy
## Paid Strategy
## Organic Strategy
## Partnerships
## Funnel
## Conversion Events
## Metrics
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when audience, message, channels, funnel, and conversion events are explicit.

## LAUNCH_PLAN.md

### Purpose

Define the launch sequence.

### Recommended Structure

```md
# Launch Plan

## Purpose
## Executive Summary
## Launch Goals
## Pre-Launch
## Beta Launch
## Public Launch
## Launch Assets
## Store Requirements
## Support During Launch
## Incident Plan
## Success Metrics
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when launch phases, assets, support, and success metrics are explicit.

## CONTENT_STRATEGY.md

### Purpose

Define the content system that supports discovery, trust, education, and conversion.

### Recommended Structure

```md
# Content Strategy

## Purpose
## Executive Summary
## Content Goals
## Audience Questions
## Content Pillars
## Channel Strategy
## SEO Strategy
## Social Strategy
## Email Strategy
## Launch Content
## Ongoing Content Calendar
## Metrics
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when content pillars, channels, launch content, and ongoing cadence are explicit.

---

# 10 Operations

## OPERATIONS.md

### Purpose

Define how the business and product will operate after launch.

### Recommended Structure

```md
# Operations

## Purpose
## Executive Summary
## Operating Model
## Maintenance Responsibilities
## Monitoring
## Incident Response
## Cost Monitoring
## User Feedback Loop
## Release Operations
## Data Management
## Vendor Management
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when maintenance, monitoring, feedback, incident response, and cost monitoring are explicit.

## SUPPORT_MODEL.md

### Purpose

Define how users receive help and how support insights feed product improvement.

### Recommended Structure

```md
# Support Model

## Purpose
## Executive Summary
## Support Channels
## Support Scope
## Response Expectations
## Common Issues
## Escalation Rules
## Refund and Cancellation Handling
## Support Metrics
## Feedback Routing
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when support channels, scope, escalation, and feedback routing are explicit.

## METRICS.md

### Purpose

Define the metrics used to evaluate product, business, growth, and operational health.

### Recommended Structure

```md
# Metrics

## Purpose
## Executive Summary
## North Star Metric
## Activation Metrics
## Retention Metrics
## Revenue Metrics
## Acquisition Metrics
## Product Usage Metrics
## Reliability Metrics
## Support Metrics
## Dashboard Requirements
## Review Cadence
## Risks
## Open Questions
```

### Completion Criteria

The document is usable when activation, retention, revenue, acquisition, reliability, and support metrics are defined.

---

# 11 Risk and Governance

## RISK_REGISTER.md

### Purpose

Track project risks across business, product, design, engineering, launch, and operations.

### Recommended Structure

```md
# Risk Register

## Purpose
## Executive Summary
## Critical Risks
## Business Risks
## Market Risks
## Product Risks
## Design Risks
## Technical Risks
## Financial Risks
## Marketing Risks
## Operational Risks
## Mitigation Plan
## Review Cadence
```

### Completion Criteria

The document is usable when risks are grouped by domain, severity, and mitigation path.

## DECISION_LOG.md

### Purpose

Track major decisions and their rationale.

### Recommended Structure

```md
# Decision Log

## Purpose
## Executive Summary
## Active Decisions
## Decision History
## Replaced Decisions
## Pending Decisions
## Decision Dependencies
## Review Cadence
```

### Completion Criteria

The document is usable when major confirmed, pending, and replaced decisions are traceable.
