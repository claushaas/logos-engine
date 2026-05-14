# Documentation Architecture

## Purpose

LOGOS Engine produces a structured documentation workspace.

The workspace should be predictable, inspectable, and useful inside an IDE.

## Recommended Generated Structure for App Business

```text
docs/
  00-intake/
    IDEA_BRIEF.md
    ASSUMPTIONS.md
    OPEN_QUESTIONS.md
  01-market/
    MARKET_ANALYSIS.md
    COMPETITOR_MATRIX.md
    ICP.md
  02-business/
    BUSINESS_MODEL.md
    POSITIONING.md
  03-economics/
    PRICING.md
    FINANCIAL_MODEL.md
    BREAK_EVEN.md
  04-product/
    PRODUCT_THESIS.md
    MVP_SCOPE.md
    ROADMAP.md
  05-design/
    UX_FLOWS.md
    DESIGN_DIRECTION.md
    ONBOARDING.md
  06-architecture/
    ARCHITECTURE.md
    TECH_STACK.md
    DATA_MODEL.md
    API_SPEC.md
  07-implementation/
    IMPLEMENTATION_PLAN.md
    DEVELOPMENT_STANDARDS.md
  08-testing/
    TESTING_STRATEGY.md
  09-go-to-market/
    MARKETING_STRATEGY.md
    LAUNCH_PLAN.md
    CONTENT_STRATEGY.md
  10-operations/
    OPERATIONS.md
    SUPPORT_MODEL.md
    METRICS.md
  11-governance/
    DECISION_LOG.md
    RISK_REGISTER.md
```

## Document Quality Rules

Each document should:

- be self-contained;
- state purpose;
- separate facts from assumptions;
- list open questions;
- expose risks;
- identify dependencies;
- include next actions.

## Documentation as Execution Input

The goal is not documentation for its own sake.

The generated documentation should prepare the user to:

- build the artifact;
- generate implementation prompts;
- create tasks;
- review architecture;
- validate business assumptions;
- coordinate execution.
