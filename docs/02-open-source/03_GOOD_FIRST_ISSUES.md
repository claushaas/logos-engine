# Good First Issues

This document lists starter issues for new contributors. Each issue is self-contained, well-scoped, and does not require deep knowledge of the full codebase.

## How to Pick One

1. Comment on the issue that you'd like to work on it.
2. Read the referenced documentation.
3. Follow the [contribution guide](../CONTRIBUTING.md).

---

## Issues

### 1. Add a Document Template — `FINANCIAL_MODEL.md`

- **Difficulty**: Easy
- **Scope**: Profile / Template
- **Description**: The current `FINANCIAL_MODEL.md` template is a stub. Expand it with proper sections: revenue streams, cost structure, unit economics, scenario modeling.
- **Files**: `profiles/app-business/templates/03-economics/FINANCIAL_MODEL.md`
- **Docs**: `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`

### 2. Add Validation Rule — Pricing vs. Business Model Consistency

- **Difficulty**: Easy
- **Scope**: Validation
- **Description**: Add a validation rule that flags when the pricing model contradicts the business model (e.g. subscription pricing but transaction-based business model).
- **Files**: `profiles/app-business/validations.yml`, `src/domain/validation/`
- **Docs**: `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`

### 3. Improve AI Intake Coverage Prompts — Market Phase

- **Difficulty**: Easy
- **Scope**: Profile / Questions
- **Description**: Review and improve the `helpText` and `examples` fields for market-phase intake coverage prompts. They should help the AI ask better conversational questions without becoming a deterministic script.
- **Files**: `profiles/app-business/questions.yml`
- **Docs**: `docs/05-profiles/00_PROFILE_SYSTEM.md`

### 4. Add Test Coverage — Profile Loader Edge Cases

- **Difficulty**: Medium
- **Scope**: Tests
- **Description**: Add tests for edge cases in the profile loader: missing files, empty YAML, deeply nested invalid references, circular dependencies.
- **Files**: `tests/` (add new test file or extend existing profile loader tests)
- **Docs**: `docs/05-profiles/00_PROFILE_SYSTEM.md`

### 5. Add Provider Preset — Groq

- **Difficulty**: Medium
- **Scope**: AI / LLM
- **Description**: Add a Groq provider preset to the provider preset registry. Groq is OpenAI-compatible with a different base URL.
- **Files**: `src/ai/` provider preset registry
- **Docs**: `docs/07-ai-and-agent-behavior/03_PROVIDER_CONFIGURATION.md`

### 6. Improve Conversational TUI Prompt Display

- **Difficulty**: Medium
- **Scope**: TUI
- **Description**: Profile `helpText` and `examples` should be available to the AI-led conversation and review UI without forcing the user into a question-id flow. Improve how conversational prompts, examples, and context are displayed.
- **Files**: `src/tui/`
- **Docs**: `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`

### 7. Add Snapshot Test — Example Workspace Document Tree

- **Difficulty**: Easy
- **Scope**: Tests
- **Description**: Add a snapshot test that verifies the example workspace document tree matches the canonical App Business tree from the roadmap.
- **Files**: `tests/` (add new test file)
- **Docs**: `docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md`

### 8. Improve Error Message — Invalid Decision Status Transition

- **Difficulty**: Easy
- **Scope**: Core engine
- **Description**: When a user or AI tries an invalid decision status transition, the error message should explain what transition was attempted, what the current status is, and what transitions are valid.
- **Files**: `src/domain/` decision module
- **Docs**: `docs/03-system-architecture/03_DECISION_REGISTRY.md`

### 9. Document a Provider Setup Walkthrough

- **Difficulty**: Easy
- **Scope**: Documentation
- **Description**: Write a short walkthrough showing how to configure a local Ollama provider from scratch (install Ollama, pull a model, configure LOGOS Engine).
- **Files**: `docs/07-ai-and-agent-behavior/03_PROVIDER_CONFIGURATION.md`
- **Docs**: Use the existing provider config doc as reference.

### 10. Add Keyword Metadata to package.json

- **Difficulty**: Easy
- **Scope**: Repository
- **Description**: Expand `package.json` keywords with terms that help discoverability: `decision-registry`, `documentation-generator`, `intent-clarification`, `local-first`, `tui`, `profile-driven`, `structured-thinking`.
- **Files**: `package.json`
