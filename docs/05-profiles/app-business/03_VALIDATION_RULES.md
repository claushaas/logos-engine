# App Business Validation Rules

## Foundation Rules

### Rule: Target User Required

The project cannot complete foundation without a primary user.

### Rule: Problem Required

The project cannot complete foundation without a defined problem.

### Rule: Alternative Required

If no current alternative is known, market validation is weak.

## Market Rules

### Rule: Competitors Required

At least direct or indirect alternatives must be identified.

### Rule: ICP Required

Marketing and product strategy cannot be considered ready without an ICP.

## Economics Rules

### Rule: Pricing Required

Break-even cannot be calculated without pricing.

### Rule: Variable Costs Required

Margin cannot be estimated without variable cost assumptions.

### Rule: CAC Assumption Required

Growth strategy is incomplete without acquisition cost assumptions.

### Rule: AI Cost Risk

If the app uses AI-heavy workflows and has low pricing or freemium model, flag gross margin risk.

## Product Rules

### Rule: MVP Scope Required

Implementation cannot begin without MVP boundaries.

### Rule: Core Loop Required

Retention cannot be reasoned about without a core loop.

### Rule: Activation Moment Required

Onboarding cannot be completed without activation definition.

## Architecture Rules

### Rule: Offline-First Dependency

If offline-first is selected, require:

- local storage;
- sync strategy;
- conflict resolution;
- offline testing.

### Rule: Multi-Device Sync Dependency

If multi-device sync is required, backend architecture must be defined.

### Rule: Authentication Dependency

If user data is persisted remotely, authentication must be defined.

## Go-To-Market Rules

### Rule: Distribution Channel Required

Launch planning cannot be completed without at least one primary channel.

### Rule: Paid Acquisition Risk

If paid ads are primary and CAC is unknown, flag economic risk.

## Operations Rules

### Rule: Support Model Required

Public launch should not occur without support model.

### Rule: Metrics Required

Launch should not occur without activation, retention, revenue, and reliability metrics.
