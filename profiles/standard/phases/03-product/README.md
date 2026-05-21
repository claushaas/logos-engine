# Product

This section defines what will be built, how users experience it, what belongs in scope, how the interface behaves, what product architecture supports it, and what criteria determine whether it is ready.

## Reading Order

1. [Product Brief](01-product-brief.yml)
2. [Scope](02-scope.yml)
3. [User Journeys](03-user-journeys.yml)
4. [UX Model](04-ux-model.yml)
5. [Information Architecture](05-information-architecture.yml)
6. [Interaction Model](06-interaction-model.yml)
7. [UI Specification](07-ui-specification.yml)
8. [Design System](08-design-system.yml)
9. [Product Architecture](09-product-architecture.yml)
10. [Functional Requirements](10-functional-requirements.yml)
11. [Non-Functional Requirements](11-non-functional-requirements.yml)
12. [Product Stack](12-product-stack.yml)
13. [Acceptance Criteria](13-acceptance-criteria.yml)

# Product

Product defines what will be built, how users experience it, what belongs in scope, how the interface behaves, which product architecture supports it, and which criteria determine whether it is ready for implementation.

It translates validated foundation and evidence into a product specification that is clear enough to guide design, engineering, testing, and release decisions.

This phase must not define low-level technical implementation, infrastructure, deployment, market execution, or operational processes. Its job is to make the product explicit before it becomes code.

## Central Question

What exactly will be built, for whom, with which experience, within which scope, and according to which acceptance criteria?

## Reading Order

1. [Product Brief](01-product-brief.yml)
2. [Scope](02-scope.yml)
3. [User Journeys](03-user-journeys.yml)
4. [UX Model](04-ux-model.yml)
5. [Information Architecture](05-information-architecture.yml)
6. [Interaction Model](06-interaction-model.yml)
7. [UI Specification](07-ui-specification.yml)
8. [Design System](08-design-system.yml)
9. [Product Architecture](09-product-architecture.yml)
10. [Functional Requirements](10-functional-requirements.yml)
11. [Non-Functional Requirements](11-non-functional-requirements.yml)
12. [Product Stack](12-product-stack.yml)
13. [Acceptance Criteria](13-acceptance-criteria.yml)

## Documents

| Document | Role | Central Question |
|---|---|---|
| [Product Brief](01-product-brief.yml) | Synthesizes the product to be built from validated foundation and evidence. | What product should be built from what has been validated? |
| [Scope](02-scope.yml) | Defines what is included, excluded, deferred, and explicitly out of bounds. | What belongs in the product now, later, or never? |
| [User Journeys](03-user-journeys.yml) | Describes the human paths through the product. | How does the user move from need to value through the product? |
| [UX Model](04-ux-model.yml) | Defines the conceptual experience model. | How should the product be understood, felt, and used? |
| [Information Architecture](05-information-architecture.yml) | Organizes the product's concepts, objects, hierarchy, and navigation. | How is product information structured so users can understand and find things? |
| [Interaction Model](06-interaction-model.yml) | Defines how users and the system act, respond, correct, and recover. | How does the user act within the system, and how does the system respond? |
| [UI Specification](07-ui-specification.yml) | Defines screens, layouts, components, states, and interface behavior. | What interface must exist, and how should it behave across states? |
| [Design System](08-design-system.yml) | Defines the product's visual language and reusable design rules. | What visual and interaction patterns create consistency across the product? |
| [Product Architecture](09-product-architecture.yml) | Defines modules, capabilities, and product-level relationships. | What product modules and capabilities compose the system? |
| [Functional Requirements](10-functional-requirements.yml) | Specifies what the system must do. | What behaviors, actions, rules, and capabilities are required? |
| [Non-Functional Requirements](11-non-functional-requirements.yml) | Defines expected qualities such as performance, accessibility, privacy, and reliability. | What quality standards must the product satisfy to be acceptable? |
| [Product Stack](12-product-stack.yml) | Captures technology choices that shape product scope and experience. | Which platform and product-level technical choices affect what the product can be? |
| [Acceptance Criteria](13-acceptance-criteria.yml) | Defines when the product, feature, or flow is ready. | What must be true for the product specification to be accepted and implemented? |

## Phase Output

By the end of Product, the project should have:

- a clear product brief;
- explicit scope and non-goals;
- mapped user journeys;
- a defined UX model;
- stable information architecture;
- interaction rules;
- UI specification;
- design system direction;
- product architecture;
- functional requirements;
- non-functional requirements;
- product-level stack decisions;
- acceptance criteria.

## Out of Scope

Product should not contain:

- database schema;
- API implementation contracts;
- infrastructure design;
- deployment strategy;
- CI/CD process;
- detailed testing infrastructure;
- sales strategy;
- launch campaign;
- support playbook;
- operational cadence.

Those belong to Engineering, Go-to-market, or Operations.

## Boundary with Engineering

Product defines what should exist and how it should be experienced.

Engineering defines how that product will be implemented, integrated, tested, deployed, observed, secured, and maintained technically.

Examples:

| Product | Engineering |
|---|---|
| Product modules and capabilities | Software architecture and dependency rules |
| UX model and interaction patterns | State management and runtime behavior |
| UI specification and states | Component implementation and platform constraints |
| Functional requirements | API contracts, domain model, and data model |
| Non-functional expectations | Technical strategies to satisfy those expectations |

## Completion Standard

Product is complete when Engineering can begin implementation without guessing the product intent, user experience, scope, requirements, or acceptance criteria.

If Engineering must infer what should be built, how a flow should behave, or what qualifies as done, Product is still too vague.