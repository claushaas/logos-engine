# Engineering

This section defines how the product will be implemented, structured, integrated, tested, deployed, observed, secured, and maintained.

## Reading Order

1. [Engineering Brief](01-engineering-brief.yml)
2. [System Architecture](02-system-architecture.yml)
3. [Technical Stack](03-technical-stack.yml)
4. [Domain Model](04-domain-model.yml)
5. [Data Model](05-data-model.yml)
6. [API Contracts](06-api-contracts.yml)
7. [Integration Architecture](07-integration-architecture.yml)
8. [Security and Privacy](08-security-and-privacy.yml)
9. [Sync and State](09-sync-and-state.yml)
10. [Testing Strategy](10-testing-strategy.yml)
11. [Observability](11-observability.yml)
12. [Deployment and Environments](12-deployment-and-environments.yml)
13. [Engineering Standards](13-engineering-standards.yml)
14. [Technical Risks](14-technical-risks.yml)

# Engineering

Engineering defines how the product will be implemented, structured, integrated, tested, deployed, observed, secured, and maintained technically.

It translates Product specifications into a reliable system architecture, explicit technical contracts, data models, implementation standards, deployment strategy, and risk controls.

This phase must not redefine product scope, market strategy, launch execution, customer support, or day-to-day business operations. Its job is to make the system buildable, testable, deployable, observable, and maintainable.

## Central Question

How will this product be implemented with enough architecture, data, APIs, infrastructure, security, tests, observability, and standards to be reliable?

## Reading Order

1. [Engineering Brief](01-engineering-brief.yml)
2. [System Architecture](02-system-architecture.yml)
3. [Technical Stack](03-technical-stack.yml)
4. [Domain Model](04-domain-model.yml)
5. [Data Model](05-data-model.yml)
6. [API Contracts](06-api-contracts.yml)
7. [Integration Architecture](07-integration-architecture.yml)
8. [Security and Privacy](08-security-and-privacy.yml)
9. [Sync and State](09-sync-and-state.yml)
10. [Testing Strategy](10-testing-strategy.yml)
11. [Observability](11-observability.yml)
12. [Deployment and Environments](12-deployment-and-environments.yml)
13. [Engineering Standards](13-engineering-standards.yml)
14. [Technical Risks](14-technical-risks.yml)

## Documents

| Document | Role | Central Question |
|---|---|---|
| [Engineering Brief](01-engineering-brief.yml) | Synthesizes what Engineering must deliver from Product inputs. | What technical outcome must Engineering produce for this project? |
| [System Architecture](02-system-architecture.yml) | Defines the macro structure, layers, boundaries, runtime model, and dependency rules. | How is the system structured, and how do its parts relate? |
| [Technical Stack](03-technical-stack.yml) | Specifies implementation technologies, tools, runtimes, platforms, and version constraints. | Which technologies will be used to build, run, test, and deploy the system? |
| [Domain Model](04-domain-model.yml) | Defines core domain concepts, entities, value objects, events, commands, invariants, and rules. | What domain concepts and rules must the software preserve? |
| [Data Model](05-data-model.yml) | Defines persistence strategy, entities, relationships, constraints, migrations, retention, and sensitivity. | How will data be stored, related, versioned, migrated, and protected? |
| [API Contracts](06-api-contracts.yml) | Defines contracts between clients, backend, services, agents, and adapters. | How do system parts communicate without ambiguity? |
| [Integration Architecture](07-integration-architecture.yml) | Defines how external services, vendors, webhooks, retries, and rate limits are handled. | How does the system depend on and isolate external integrations? |
| [Security and Privacy](08-security-and-privacy.yml) | Defines authentication, authorization, data protection, secrets, privacy, and abuse prevention. | How does the system protect users, data, access, and trust? |
| [Sync and State](09-sync-and-state.yml) | Defines local state, remote state, cache, offline behavior, synchronization, conflicts, and recovery. | How does state move, persist, synchronize, recover, and stay consistent? |
| [Testing Strategy](10-testing-strategy.yml) | Defines the technical verification strategy and release gates. | How will we know the system works and continues to work? |
| [Observability](11-observability.yml) | Defines logs, metrics, tracing, error reporting, health checks, alerts, and sensitive data rules. | How will the system be understood and diagnosed in development and production? |
| [Deployment and Environments](12-deployment-and-environments.yml) | Defines environments, builds, releases, migrations, rollback, secrets, and feature flags. | How will the system move safely from development to production? |
| [Engineering Standards](13-engineering-standards.yml) | Defines repository, code, typing, error handling, logging, dependency, Git, PR, and documentation standards. | How should technical work be performed consistently as the system grows? |
| [Technical Risks](14-technical-risks.yml) | Centralizes architectural, data, security, performance, integration, vendor, and maintenance risks. | What could make the system difficult, expensive, unstable, unsafe, or hard to maintain? |

## Phase Output

By the end of Engineering, the project should have:

- an engineering brief;
- system architecture;
- technical stack definition;
- domain model;
- data model;
- API contracts;
- integration architecture;
- security and privacy strategy;
- sync and state strategy;
- testing strategy;
- observability strategy;
- deployment and environment strategy;
- engineering standards;
- technical risk register.

## Out of Scope

Engineering should not contain:

- product thesis;
- final product scope decisions;
- UX strategy;
- visual design direction;
- market positioning;
- launch plan;
- sales strategy;
- customer support process;
- business operating cadence;
- financial operations process.

Those belong to Foundation, Product, Go-to-market, or Operations.

## Boundary with Product

Product defines what should exist and how it should be experienced.

Engineering defines how that product will be implemented reliably.

Examples:

| Product | Engineering |
|---|---|
| Product modules and capabilities | Software architecture, layers, and dependencies |
| Functional requirements | Domain model, APIs, persistence, and services |
| UX and interaction expectations | State model, synchronization, runtime behavior, and error handling |
| Non-functional expectations | Technical strategies for performance, security, reliability, and observability |
| Acceptance criteria | Test strategy, release gates, and verification mechanisms |

## Boundary with Operations

Engineering builds the technical mechanisms that allow the system to run safely.

Operations defines how the product, customers, support, incidents, reporting, compliance, finances, and continuous improvement are managed after launch.

Examples:

| Engineering | Operations |
|---|---|
| Observability instrumentation | Incident response process |
| Deployment and rollback strategy | Release coordination and operational cadence |
| Security and privacy controls | Compliance review and governance process |
| Technical risk register | Operational risk register |
| Testing and release gates | Support, customer success, and business continuity routines |

## Completion Standard

Engineering is complete when the system can be implemented, tested, deployed, observed, secured, and maintained without relying on implicit technical assumptions.

If builders must guess architecture, data shape, API behavior, state rules, security controls, test gates, deployment flow, or coding standards, Engineering is still too vague.