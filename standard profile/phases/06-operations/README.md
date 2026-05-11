# Operations

This section defines how the product, business, customers, revenue, support, risks, reporting, knowledge, and continuous improvement are operated after launch.

## Reading Order

1. [Operations Brief](01-operations-brief.yml)
2. [Operating Model](02-operating-model.yml)
3. [Team and Responsibilities](03-team-and-responsibilities.yml)
4. [Customer Support](04-customer-support.yml)
5. [Customer Success](05-customer-success.yml)
6. [Business Processes](06-business-processes.yml)
7. [Operational Metrics](07-operational-metrics.yml)
8. [Reporting and Cadence](08-reporting-and-cadence.yml)
9. [Incident Management](09-incident-management.yml)
10. [Risk and Compliance](10-risk-and-compliance.yml)
11. [Financial Operations](11-financial-operations.yml)
12. [Knowledge Management](12-knowledge-management.yml)
13. [Continuous Improvement](13-continuous-improvement.yml)
14. [Operational Risks](14-operational-risks.yml)

# Operations

Operations defines how the product, business, customers, revenue, support, risks, reporting, knowledge, and continuous improvement are managed after launch.

It translates Engineering and Go-to-market into an operating model: responsibilities, support, customer success, business processes, operational metrics, reporting cadence, incident response, compliance, financial operations, knowledge management, improvement loops, and operational risks.

This phase must not redefine the founding thesis, validation evidence, product specification, technical architecture, or market-entry motion. Its job is to make the project operable after it is launched.

## Central Question

How will this product and business remain reliable, useful, supported, financially controlled, governed, and capable of learning after launch?

## Reading Order

1. [Operations Brief](01-operations-brief.yml)
2. [Operating Model](02-operating-model.yml)
3. [Team and Responsibilities](03-team-and-responsibilities.yml)
4. [Customer Support](04-customer-support.yml)
5. [Customer Success](05-customer-success.yml)
6. [Business Processes](06-business-processes.yml)
7. [Operational Metrics](07-operational-metrics.yml)
8. [Reporting and Cadence](08-reporting-and-cadence.yml)
9. [Incident Management](09-incident-management.yml)
10. [Risk and Compliance](10-risk-and-compliance.yml)
11. [Financial Operations](11-financial-operations.yml)
12. [Knowledge Management](12-knowledge-management.yml)
13. [Continuous Improvement](13-continuous-improvement.yml)
14. [Operational Risks](14-operational-risks.yml)

## Documents

| Document | Role | Central Question |
|---|---|---|
| [Operations Brief](01-operations-brief.yml) | Synthesizes what Operations must protect and sustain after launch. | What must keep working continuously for the project to remain healthy? |
| [Operating Model](02-operating-model.yml) | Defines how the product and business operate day to day. | How does the project function repeatedly after launch? |
| [Team and Responsibilities](03-team-and-responsibilities.yml) | Defines operational roles, ownership, authority, and escalation. | Who is responsible for what, and how do decisions escalate? |
| [Customer Support](04-customer-support.yml) | Defines how user problems, questions, bugs, billing issues, and unsupported requests are handled. | How are user problems received, prioritized, resolved, and escalated? |
| [Customer Success](05-customer-success.yml) | Defines how users or customers continue receiving value after adoption. | How will the project retain, activate, expand, and learn from customers? |
| [Business Processes](06-business-processes.yml) | Defines recurring operational workflows. | Which business processes must happen consistently rather than as ad hoc exceptions? |
| [Operational Metrics](07-operational-metrics.yml) | Defines metrics for operational health, support, quality, reliability, cost, and efficiency. | Which signals show whether the operation is healthy or degrading? |
| [Reporting and Cadence](08-reporting-and-cadence.yml) | Defines what is reviewed daily, weekly, monthly, or quarterly. | When are metrics, risks, incidents, finances, and decisions reviewed? |
| [Incident Management](09-incident-management.yml) | Defines incident classification, response, communication, mitigation, postmortems, and corrective actions. | How will the team respond when something important breaks? |
| [Risk and Compliance](10-risk-and-compliance.yml) | Defines legal, privacy, governance, vendor, contractual, audit, and compliance practices. | How are operational obligations, risks, and governance handled? |
| [Financial Operations](11-financial-operations.yml) | Defines billing, subscriptions, failed payments, refunds, costs, margin, reporting, and accounting interface. | How is money operated, monitored, reconciled, and controlled? |
| [Knowledge Management](12-knowledge-management.yml) | Defines how operational knowledge, decisions, runbooks, support knowledge, and learnings are preserved. | How does the project avoid depending on fragile individual memory? |
| [Continuous Improvement](13-continuous-improvement.yml) | Defines how feedback, incidents, metrics, churn, support, and cost signals become deliberate improvement. | How does the operation improve without becoming reactive or chaotic? |
| [Operational Risks](14-operational-risks.yml) | Centralizes support, reliability, financial, compliance, vendor, team, process, customer success, and knowledge risks. | What could make the operation fragile, expensive, noncompliant, unsupported, or unable to learn? |

## Phase Output

By the end of Operations, the project should have:

- an operations brief;
- operating model;
- responsibility model;
- customer support process;
- customer success model;
- business process inventory;
- operational metrics;
- reporting cadence;
- incident management process;
- risk and compliance model;
- financial operations process;
- knowledge management model;
- continuous improvement loop;
- operational risk register.

## Out of Scope

Operations should not contain:

- founding thesis;
- validation strategy;
- research plan;
- product scope decisions;
- UX or UI specification;
- system architecture;
- data model;
- API contracts;
- launch positioning;
- market messaging;
- channel strategy.

Those belong to Foundation, Validation, Product, Engineering, or Go-to-market.

## Boundary with Engineering

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

## Boundary with Go-to-market

Go-to-market defines the market-entry motion.

Operations defines how the product and business continue after that motion starts producing users, customers, revenue, support needs, risks, and recurring decisions.

Examples:

| Go-to-market | Operations |
|---|---|
| Launch plan | Release coordination and post-launch monitoring |
| Conversion funnel | Customer success and retention process |
| Sales strategy | Customer handoff and account operations |
| Pricing and packaging | Billing operations and failed payment handling |
| Growth metrics | Operational metrics and reporting cadence |

## Completion Standard

Operations is complete when the project can be launched and operated without relying on improvisation for support, customer success, billing, incidents, compliance, reporting, knowledge preservation, or improvement.

If the team must guess who owns a recurring function, how to respond to problems, what metrics to review, how to handle incidents, how to manage revenue operations, or how to preserve operational knowledge, Operations is still too vague.