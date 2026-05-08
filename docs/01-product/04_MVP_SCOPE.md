# MVP Scope

## MVP Objective

Build the smallest useful version of LOGOS Engine that validates the core premise:

> People benefit from a local-first system that asks structured questions and generates living documentation for app-business projects.

## Included in MVP

### CLI/TUI

- `logos` opens the TUI;
- `/init`
- `/continue`
- `/diagnose`
- `/generate`
- `/validate`
- `/status`
- `/config ai`

### Profile

- App Business profile only.

### Storage

- local JSON files;
- Markdown output;
- no database.

### AI

Architecturally required, operationally configurable.

The MVP should include provider abstraction, prompt contracts, structured output validation, mocked AI tests, and user confirmation flows.

The MVP should not depend on live remote AI calls to install, test, initialize a workspace, validate state, or render deterministic documentation.

### Documentation

Generate canonical documents for:

- foundation;
- market;
- economics;
- product;
- UX;
- architecture;
- implementation;
- testing;
- GTM;
- operations;
- open questions;
- risks.

## Excluded from MVP

- web UI;
- cloud workspace;
- user accounts;
- team collaboration;
- plugin system;
- marketplace;
- multi-profile authoring UI;
- advanced graph visualization;
- automatic external research.

## MVP Risk

The biggest MVP risk is overbuilding the meta-system.

The MVP should favor boring, inspectable mechanics over impressive but fragile intelligence.
