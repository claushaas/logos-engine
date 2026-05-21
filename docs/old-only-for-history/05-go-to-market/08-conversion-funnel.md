# Conversion Funnel

## Funnel Objective

The conversion funnel should track whether qualified builders move from awareness to completed clarification and useful feedback.

The early funnel is a learning system, not a revenue optimization system.

## Funnel Model

The initial funnel model is:

Awareness -> Acquisition -> Qualification -> Signup or Lead Capture -> Onboarding -> Activation -> Engagement -> Conversion -> Retention -> Referral -> Expansion.

Several stages may be manual or qualitative until the product has validated repeatable usage.

## Stage Definitions

Each funnel stage should be defined by observable behavior, not intent alone. For early GTM, a user who praises the concept but does not run the product has not activated.

## Awareness

Awareness occurs when a qualified builder sees LOGOS Engine through GitHub, content, community posts, social media, demo assets, or direct outreach.

Awareness metrics should be interpreted carefully because broad attention may not reflect qualified demand.

## Acquisition

Acquisition occurs when a builder visits the repository, reads the README, watches a demo, clones the repo, installs the package, or otherwise takes a concrete step toward trying the product.

## Qualification

Qualification occurs when the builder matches the early ICP: repository-based workflow, active project to clarify, comfort with local tooling, and willingness to review generated docs.

Qualification may be measured through self-report, feedback forms, discovery conversations, or issue context.

## Signup or Lead Capture

There may be no required signup in the MVP. Lead capture should be optional and transparent.

Useful capture mechanisms include GitHub issues, discussions, newsletter signup, feedback form, or direct contact, but none should block local product use.

## Onboarding

Onboarding begins when the user installs or runs LOGOS Engine in a repository and configures the required AI provider.

Successful onboarding requires the user to understand where docs will be generated, why `logos/` is the default root, and how profile-driven clarification works.

## Activation

Activation occurs when the user completes a clarification cycle, reviews proposed decisions, and generates a useful documentation set.

The best activation evidence is a user saying what became clearer after reviewing the output.

## Engagement

Engagement occurs when the user revisits the generated docs, continues the workflow, updates decisions, generates additional artifacts, or uses the output to guide implementation or agent work.

## Conversion

Early conversion is not payment. It is conversion from interest to meaningful product use.

Future paid conversion should not be designed until value, retention, and willingness to pay are better understood.

## Retention

Retention occurs when the user returns to LOGOS Engine for the same project or uses it for another project.

Retention evidence is currently unavailable and must be generated through follow-up.

## Referral

Referral occurs when users recommend the tool, star the repository, share an example, invite another builder, or contribute feedback or improvements.

Referral should be measured as a signal, not proof of market fit.

## Expansion

Expansion may include profile customization, team review, consultant workflows, hosted collaboration, training, support, or commercial use.

Expansion is a future hypothesis.

## Funnel Events

Suggested events to track manually or through explicit, privacy-safe mechanisms:

- Repository visit.
- README engagement.
- Install attempt.
- First TUI run.
- Provider configured.
- Workspace initialized.
- Clarification cycle completed.
- Markdown generated.
- HTML artifacts generated.
- Agent pack generated.
- Feedback submitted.
- Repeat use reported.

## Funnel Metrics

Useful metrics include:

- Qualified visitor count.
- Install attempts.
- Setup completion rate.
- Activation rate.
- Feedback rate.
- Time to first generated docs.
- Repeat usage reports.
- Issue types by frequency.
- Referral or contribution signals.

## Cohorts

Cohorts should be grouped by acquisition source, segment, product version, and launch wave.

Small cohorts are acceptable because early GTM is qualitative.

## Attribution

Attribution should remain simple. Source can be captured through voluntary feedback, referral links where appropriate, GitHub discussions, or manual tagging.

Avoid hidden tracking that conflicts with local-first trust.

## Drop-off Risks

Likely drop-off points:

- Message is unclear.
- README feels too abstract.
- Installation fails.
- Provider configuration is confusing.
- User does not know what project to try.
- Generated docs feel generic.
- User does not see how to use the output.

## Funnel Experiments

Initial experiments:

- Compare short tagline variants.
- Test README-first versus demo-first onboarding.
- Test sample repository walkthrough.
- Test direct outreach with different pain statements.
- Test whether agent packs increase perceived utility.

## Instrumentation Ownership

Instrumentation ownership should sit with the product and engineering owner until a dedicated GTM process exists.

Any instrumentation added to the product must be explicit, optional, and documented.

## Funnel Risks

The main risk is optimizing for shallow attention instead of actual clarification outcomes.

The funnel should reward completed usage and evidence quality over traffic volume.

## Downstream Handoff

This funnel supports growth metrics, launch review, pricing caution, and product onboarding improvements.
