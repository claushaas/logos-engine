# Design System

## Design System Thesis

The LOGOS Engine design system exists to keep the TUI coherent, state-aware, accessible, and trustworthy as the product grows from one local workflow into a larger documentation engine. Its purpose is not to create a distinctive visual brand first; its purpose is to protect clarity, consistency, recoverability, and semantic meaning across screens, commands, states, generated reports, and future derived views.

Consistency protects:

- User trust in local state, generated files, and provider disclosure.
- Learnability across conversation, commands, review, diagnostics, generation, and recovery.
- Accessibility through predictable focus, labels, contrast targets, and non-color meaning.
- Maintainability by reducing one-off visual decisions, token drift, and component variants.
- Product boundaries by preventing the UI from drifting into dashboards, task boards, decorative portals, or autonomous-agent surfaces.

The design system must preserve a restrained, keyboard-first, text-centered product character. It should support a calm technical workbench: dense enough for terminal and IDE users, clear enough for first-time repository setup, and explicit enough to distinguish proposed, confirmed, assumed, unknown, canonical, derived, partial, failed, blocked, and stale states.

The design system must avoid becoming:

- A brand-first style guide with weak state rules.
- A dashboard component kit unrelated to the TUI workflow.
- A decorative token set that hides uncertainty and risk.
- A component library that creates variants before journeys require them.
- A rigid implementation architecture document.
- A visual system that relies on color, motion, or icons alone to communicate critical meaning.

This document is a product-level design system specification. Engineering implementation, exact package choices, and code-level token definitions belong in Engineering Design System and Frontend Architecture.

## Design Principles

### Principle 1: Semantic Before Decorative

**Decision rule:** A token, component, state, icon, color, or motion pattern must express product meaning before it expresses style.

**Design implications:**

- Prefer semantic tokens such as `color.text.danger` or `state.decision.proposed` over tokens named only by visual value.
- Component variants must map to real states or product needs.
- Decorative treatment must not outrank state clarity.

**Trade-offs:** The system may feel quieter and less branded at first.

**Violations:**

- Adding a new color because it looks nice but has no semantic role.
- Using visual emphasis that makes a derived artifact look canonical.
- Creating a "premium" style that changes interaction meaning.

### Principle 2: State Is a First-Class Design Input

**Decision rule:** Every component must define how it handles default, focus, loading, error, warning, success, disabled, pending, selected, low-confidence, permission-restricted, canonical, derived, proposed, confirmed, assumed, unknown, stale, partial, and failed states where relevant.

**Design implications:**

- State labels are text-first and may be reinforced by color or icon.
- Critical state cannot be color-only.
- Success, partial success, and failure must look and read differently.

**Trade-offs:** Components require more specification before implementation.

**Violations:**

- Showing generation as successful when outputs are partial.
- Styling proposed decisions like confirmed decisions.
- Hiding unknown or assumed states because they look messy.

### Principle 3: Calm Density

**Decision rule:** The design system should support compact, information-rich terminal work without creating equal-weight walls of text.

**Design implications:**

- Use spacing, grouping, labels, and hierarchy to make dense reports scannable.
- Compact modes may collapse detail but must not hide critical consequence information.
- Long tables should degrade into labeled lists on compact terminals.

**Trade-offs:** The visual system cannot rely on generous whitespace alone.

**Violations:**

- Dashboard-like card grids for first-run status.
- Long flat diagnostic lists with no severity grouping.
- Compact mode that hides active root or provider disclosure.

### Principle 4: Accessibility Is Structural

**Decision rule:** Accessibility requirements must be built into tokens, components, and states, not patched into individual screens later.

**Design implications:**

- Focus, contrast targets, labels, keyboard access, reduced motion, and non-color state meaning are component requirements.
- Exact accessibility compliance must be tested before claimed.
- Terminal limitations must be documented rather than ignored.

**Trade-offs:** Some visual treatments and shortcuts require alternatives.

**Violations:**

- Color-only severity.
- Hover-only warnings.
- Motion-only loading state.
- Icon-only confirmation action.

### Principle 5: Governed Evolution

**Decision rule:** New tokens, components, variants, and exceptions require rationale tied to a screen, journey, state, or accessibility need.

**Design implications:**

- Component drift is a product risk.
- Exceptions must have scope and review.
- Deprecated variants must be named and removed deliberately.

**Trade-offs:** Lightweight governance slows ad hoc visual changes.

**Violations:**

- Creating a new alert variant for one screen without a semantic difference.
- Using a custom layout because the existing component "feels boring".
- Adding a token that duplicates an existing role with a different name.

## Visual Language

The visual language should be restrained, precise, repository-native, and quietly rigorous. It should feel close to terminal, IDE, and documentation workflows without becoming raw or hostile. The sensory character is:

- **Calm:** avoids urgency, ornament, and celebratory excess.
- **Structured:** uses clear grouping, labels, and hierarchy.
- **Inspectable:** makes paths, states, sources, and consequences visible.
- **Technical but humane:** respects terminal users without assuming they want cryptic output.
- **Caveat-preserving:** lets unknowns, assumptions, and partial states remain visible.

Directional references are philosophical, not literal implementation requirements:

- Terminal and IDE interfaces for keyboard-first density.
- Git diff and command output for inspectable change reporting.
- Technical documentation for clear hierarchy and labels.
- Diagnostics reports for severity grouping and next actions.

Rejected styles:

| Rejected Style | Why Rejected |
| --- | --- |
| Marketing SaaS dashboard | Suggests hosted state, metrics, and team management rather than local project clarity. |
| Chat-app styling as primary identity | Makes conversation feel like source of truth. |
| Decorative gradient-heavy interface | Competes with state clarity and accessibility. |
| Overly playful assistant UI | Undermines seriousness of decisions, validation, and file writes. |
| Monochrome severity system | Fails to distinguish risk and state unless strong labels compensate. |
| Dense raw logs | Exposes implementation detail without product meaning. |
| Presentation-polished artifact UI | Risks making derived outputs appear canonical. |

## Design Tokens

Token values in this document are product-level roles and provisional mappings. Exact implementation values belong downstream.

### Token Categories

| Category | Purpose | Status |
| --- | --- | --- |
| Color tokens | Surfaces, text, borders, actions, states, diagnostics, confidence, focus. | required |
| Typography tokens | Text roles for headings, body, labels, code, paths, numeric counts, captions. | required |
| Spacing tokens | Dense but readable rhythm, grouping, compact/standard/wide layouts. | required |
| Radius tokens | TUI containers, badges, prompts, alerts, overlays. | required |
| Border tokens | Separators, focus rings, state emphasis, containment. | required |
| Elevation tokens | Minimal overlays and modal-like confirmation surfaces. | limited |
| Opacity tokens | Disabled and de-emphasized states without harming readability. | limited |
| Motion tokens | Pending, transition, and attention feedback. | limited / reduced-motion aware |
| Z-index or layer tokens | Modal-like prompts, overlays, shell, reports. | future frontend detail |
| Breakpoint tokens | Terminal viewport classes. | provisional |
| Density tokens | Compact, standard, and expanded density modes. | provisional |
| Component tokens | Component-specific semantic slots. | required for implemented components |

### Naming Rules

Use this pattern:

```text
<category>.<role>.<state-or-emphasis>
```

Examples:

- `color.text.primary`
- `color.text.muted`
- `color.state.proposed`
- `color.state.confirmed`
- `space.stack.sm`
- `type.label.default`
- `border.focus.default`
- `motion.duration.fast`

Primitive tokens may encode value families, but semantic tokens must be used by components.

### Core Semantic Tokens

| Name | Type | Role | Value | Semantic Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `color.surface.base` | color | surface | implementation-defined | Default TUI background or base surface. | required |
| `color.surface.raised` | color | surface | implementation-defined | Confirmation, recovery, or overlay surface. | required |
| `color.text.primary` | color | text | implementation-defined | Main readable text. | required |
| `color.text.secondary` | color | text | implementation-defined | Supporting text and metadata. | required |
| `color.text.muted` | color | text | implementation-defined | Low-priority context, never critical meaning alone. | required |
| `color.border.default` | color | border | implementation-defined | Standard separation. | required |
| `color.border.focus` | color | focus | implementation-defined | Keyboard focus and active target. | required |
| `color.action.primary` | color | action | implementation-defined | Primary safe action. | required |
| `color.action.danger` | color | action | implementation-defined | Destructive or high-risk action. | required |
| `color.state.proposed` | color | state | implementation-defined | Proposed, needs review. | required |
| `color.state.confirmed` | color | state | implementation-defined | User-confirmed. | required |
| `color.state.assumed` | color | state | implementation-defined | Accepted-for-now assumption. | required |
| `color.state.unknown` | color | state | implementation-defined | Open or unknown information. | required |
| `color.state.canonical` | color | state | implementation-defined | Canonical Markdown output. | required |
| `color.state.derived` | color | state | implementation-defined | Derived HTML artifact or agent pack. | required |
| `color.feedback.info` | color | feedback | implementation-defined | Informational message. | required |
| `color.feedback.warning` | color | feedback | implementation-defined | Warning or important caveat. | required |
| `color.feedback.error` | color | feedback | implementation-defined | Error or failed operation. | required |
| `color.feedback.success` | color | feedback | implementation-defined | Completed operation, not validation proof. | required |
| `color.feedback.partial` | color | feedback | implementation-defined | Partial completion. | required |
| `color.feedback.lowConfidence` | color | feedback | implementation-defined | AI interpretation requires review. | required |
| `type.heading.section` | typography | heading | implementation-defined | Major view heading. | required |
| `type.body.default` | typography | body | implementation-defined | Main prose. | required |
| `type.label.default` | typography | label | implementation-defined | Component labels and metadata. | required |
| `type.code.path` | typography | code/path | implementation-defined | Paths, commands, tokens, ids. | required |
| `space.inline.xs` | spacing | inline gap | implementation-defined | Tight label-value separation. | required |
| `space.stack.sm` | spacing | vertical rhythm | implementation-defined | Compact group separation. | required |
| `space.stack.md` | spacing | vertical rhythm | implementation-defined | Standard section separation. | required |
| `space.panel.padding` | spacing | component | implementation-defined | Panel internal padding. | required |
| `radius.none` | radius | shape | 0 | Terminal-native straight edges or dense lists. | required |
| `radius.sm` | radius | shape | implementation-defined, max 4px equivalent | Badges, compact labels. | provisional |
| `radius.md` | radius | shape | implementation-defined, max 8px equivalent | Panels and modal-like prompts. | provisional |
| `border.width.default` | border | structure | implementation-defined | Standard boundary. | required |
| `border.width.focus` | border | focus | implementation-defined | Focus emphasis. | required |
| `motion.duration.fast` | motion | feedback | implementation-defined | Short feedback transition. | limited |
| `motion.duration.slow` | motion | feedback | implementation-defined | Long-running state hint. | limited |
| `density.compact` | density | mode | terminal-dependent | Small terminal or dense reports. | provisional |
| `density.standard` | density | mode | terminal-dependent | Default TUI density. | provisional |
| `density.expanded` | density | mode | terminal-dependent | Wide terminal or lower-density review. | provisional |

### Token Rules

- Components consume semantic tokens, not raw primitives, when state or meaning is involved.
- Status colors require text labels.
- Root, provider, confirmation, and overwrite states must not rely on color alone.
- `logos/` path display uses path/code typography.
- Disabled opacity must not make text unreadable.
- Tokens may adapt across theme or platform only if semantic meaning remains stable.
- Any new state token must include accessibility and content rules.

## Typography

Typography is role-based. Exact fonts are not chosen here.

### Type Roles

| Role | Purpose | Usage Rules |
| --- | --- | --- |
| Section heading | Orient major views. | Short, direct, not marketing-like. |
| Subsection heading | Group report sections and component areas. | Use for hierarchy, not decoration. |
| Body text | Explain state, questions, and recovery. | Clear prose with moderate line length. |
| Label text | Identify metadata and status. | Stable labels, no clever phrasing. |
| Caption text | Secondary hints and caveats. | Must remain readable; do not hide critical info. |
| Code/path text | Commands, paths, ids, tokens. | Use monospace or terminal-equivalent styling. |
| Numeric text | Counts and summaries. | Pair with labels; no unlabeled metrics. |
| Error text | Failure and recovery. | Specific, non-blaming, action-oriented. |
| Confirmation text | Consequence and choice. | Direct and unambiguous. |

### Typography Rules

- Do not scale typography with viewport width.
- Letter spacing should remain neutral unless an implementation platform requires adjustment.
- Long paths and commands should be visually distinct from prose.
- Headings inside dense TUI panels should remain compact.
- Error, warning, and confirmation text must be readable at the same priority as surrounding action text.
- Avoid hero-scale type inside the product TUI.
- Avoid decorative type treatments.

### Provisional Type Scale

For a TUI, size may be constrained by terminal font settings. The design system should define hierarchy through role, weight, spacing, labels, and grouping rather than assuming full pixel control.

For generated HTML artifacts, downstream implementation may define a fuller type scale, but it must preserve:

- readable line lengths;
- clear heading hierarchy;
- path/code distinction;
- caveat and uncertainty visibility;
- canonical versus derived labeling.

## Color System

The color system must be semantic, restrained, and accessible. Exact palette values belong downstream, but semantic roles are required now.

### Semantic Roles

| Role | Purpose | Non-Color Reinforcement |
| --- | --- | --- |
| Surface | Base, raised, selected, blocked, recovery surfaces. | Region labels and borders. |
| Text | Primary, secondary, muted, inverse where needed. | Hierarchy and labels. |
| Border | Structure, focus, warning, error, selected. | Line placement and text labels. |
| Action | Primary, secondary, destructive, disabled. | Verb labels and confirmation copy. |
| Info | Neutral system message. | "Info" or contextual label. |
| Warning | Important caveat or risk. | "Warning" label and next action. |
| Error | Failed operation or blocking issue. | "Error" label and recovery action. |
| Success | Completed operation. | "Completed" label and result detail. |
| Partial | Mixed result. | "Partial" label and categories. |
| Proposed | Needs review. | "Proposed" label. |
| Confirmed | User accepted. | "Confirmed by you" label. |
| Assumed | Accepted for now. | "Assumption" label. |
| Unknown | Open or not yet known. | "Unknown" or "Open question" label. |
| Canonical | Source review output. | "Canonical Markdown" label. |
| Derived | Generated from canonical source. | "Derived output" label. |
| Low confidence | AI uncertainty. | "Low confidence" label and review action. |
| Permission restricted | Action blocked by consent/path/provider. | Explanation and recovery action. |

### Contrast and Accessibility

- Target WCAG 2.2 AA contrast for generated HTML artifacts and any browser-based surfaces.
- For terminal TUI surfaces, target high-contrast text combinations and document limitations of user terminal themes.
- Critical text must remain readable in light and dark terminal themes where feasible.
- Color must never be the only indicator for severity, status, confidence, source type, or action risk.

### Prohibited Color Usage

- Red for any normal incomplete state that is not an error.
- Green for generated output if it could imply validation or project success.
- Muted text for critical warnings.
- Same color treatment for proposed and confirmed decisions.
- Same color treatment for canonical and derived outputs.
- Bright accent colors for routine marketing-like emphasis.

## Spacing System

Spacing should create scannable structure in terminal and generated views without wasting vertical space.

### Spatial Scale

Use a small semantic scale:

| Token | Purpose |
| --- | --- |
| `space.0` | No gap for tight terminal lists. |
| `space.1` | Inline label/value separation. |
| `space.2` | Compact component internal spacing. |
| `space.3` | Standard group separation. |
| `space.4` | Major section separation. |
| `space.6` | Modal-like or recovery emphasis. |

Exact values are platform-defined. The semantic relation must remain stable.

### Spacing Rules

- Group related metadata tightly.
- Separate unrelated objects clearly.
- Give warnings, confirmations, and recovery panels enough separation to be noticed.
- Keep dense reports readable by grouping before adding vertical whitespace.
- Do not create nested card-like structures.
- Do not reduce spacing so much that proposed/confirmed or success/partial/failure states blur together.

### Density Modes

| Mode | Purpose | Rules |
| --- | --- | --- |
| Compact | Narrow terminals, dense reports. | Collapse secondary detail; preserve critical state. |
| Standard | Default TUI use. | Balanced grouping and action visibility. |
| Expanded | Wide terminals or focused review. | More side context, not decorative whitespace. |

## Layout Grid

The primary grid is terminal-responsive, not a fixed browser grid.

### TUI Layout Grid

| Class | Rule |
| --- | --- |
| Compact terminal | One-column stack. Header, primary work, feedback, actions. |
| Standard terminal | Primary work with compact context summaries. |
| Wide terminal | Optional side context for affected documents, diagnostics, proposals, or output categories. |

### Alignment Rules

- Align labels and values consistently in summaries.
- Use left-aligned text for readability.
- Keep command input anchored and predictable.
- Keep confirmation actions near the consequence text.
- Keep file paths and command names visually distinct.

### Grid Exceptions

Exceptions are allowed when:

- A path or command would become unreadable.
- A confirmation prompt must interrupt the normal layout.
- A recovery state must prioritize action over normal context.
- A generated HTML artifact needs document-style reading layout.

Exceptions must not hide critical information.

## Shape and Radius

Shape should communicate grouping, actionability, focus, selection, and risk. It should not create decorative depth.

### Radius Scale

| Token | Purpose |
| --- | --- |
| `radius.none` | Terminal-native blocks, tables, lists, command output. |
| `radius.sm` | Status badges and compact labels where supported. |
| `radius.md` | Confirmation, recovery, or overlay-like panels where supported. |

Cards and panels should stay at 8px equivalent or less in generated browser surfaces unless a future implementation proves a stronger need.

### Borders and Dividers

- Use borders to separate groups, panels, prompts, and focus areas.
- Use dividers for report groups and file lists.
- Use focus rings or focus borders for keyboard navigation.
- Do not stack borders, shadows, and heavy backgrounds on the same component unless a blocking state requires emphasis.

### Elevation and Shadows

Elevation is limited:

- Confirmation prompts may use raised treatment.
- Recovery panels may use raised treatment.
- Overlays may use raised treatment.

Do not use decorative shadows in the TUI mental model. Generated HTML artifacts may use minimal elevation only to support navigation and grouping.

## Iconography

Icons are optional support, not the primary meaning system.

### Icon Roles

| Role | Use | Label Requirement |
| --- | --- | --- |
| Decorative | Adds visual rhythm without meaning. | Hidden from assistive tech where applicable. |
| Assistive | Reinforces label or action. | Text label still present. |
| Semantic status | Reinforces warning, error, success, partial, derived, canonical. | Text label required. |
| Action | Supports command or button. | Accessible name required; visible label preferred. |
| Navigation | Helps locate status, diagnostics, outputs. | Label required in MVP. |

### Icon Rules

- Do not use icons as the only severity or state indicator.
- Use a consistent stroke-based icon style if icons are supported.
- Keep icon sizes aligned with text labels.
- Avoid custom icons unless an existing icon cannot express the role.
- Custom icons require name, role, accessibility behavior, and review.

### Provisional Library

No icon library is selected in this product document. If a frontend implementation uses a common icon library, it must map icons to semantic roles rather than visual preference.

## Motion

Motion is limited and functional. The product is TUI-first, so many states may use textual pending indicators rather than animation.

### Motion Principles

- Motion may communicate pending state, continuity, or focus change.
- Motion must not hide delays or uncertainty.
- Motion must not be the only indication of loading, success, failure, or focus.
- Reduced-motion preferences should be respected in browser surfaces.
- TUI animation should be minimal and should not interfere with screen readers or terminal usability.

### Motion Tokens

| Token | Purpose | Provisional Range |
| --- | --- | --- |
| `motion.duration.instant` | State appears immediately. | 0ms |
| `motion.duration.fast` | Small feedback transition. | 100-180ms |
| `motion.duration.medium` | Panel or state transition. | 180-300ms |
| `motion.duration.slow` | Avoid by default; only for non-critical continuity. | 300-500ms |

Exact values belong downstream.

### Prohibited Motion

- Loading animation without text.
- Celebratory animation for generated output.
- Motion that delays error or recovery visibility.
- Motion required to understand state changes.
- Infinite animation that distracts during writing or review.

## Component Principles

### What Makes a Good Component

A LOGOS component is good when it:

- maps to a real screen, journey, object, or state;
- makes state visible in text;
- supports keyboard-first use;
- has defined variants and forbidden uses;
- preserves canonical versus derived distinctions;
- handles empty, loading, error, success, partial, disabled, and permission states where relevant;
- uses semantic tokens;
- has content rules;
- has accessibility expectations;
- can be reused without changing meaning.

### Variant Rules

Create a variant only when:

- state changes behavior or meaning;
- accessibility behavior changes;
- interaction risk changes;
- content structure changes;
- component use case differs across screens in a stable way.

Do not create a variant for one-off visual preference.

### Extension Versus New Component

Extend an existing component when:

- the object type is the same;
- states are compatible;
- content anatomy is compatible;
- behavior is compatible.

Create a new component when:

- the semantic role differs;
- interaction model differs;
- accessibility behavior differs;
- using the old component would confuse source-of-truth or state meaning.

### Component Drift Signals

- Same status represented with different labels or colors.
- One-off spacing or border treatments.
- Duplicate alert variants with similar meaning.
- Derived outputs styled like canonical documents.
- Proposal and confirmation surfaces sharing identical treatment.
- New token created instead of using existing semantic role.

## Component Inventory

| ID | Component | Category | Purpose | Used In | Variants | States | Do Not Use When | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DS-001 | Orientation Header | navigation / system | Show repository, root, profile, provider, state category. | All major views | normal, compact, warning | default, warning, error | Never omit on write/config screens. | Product/UI | core |
| DS-002 | Command Input | input | Accept slash commands and conversational text. | TUI Shell | idle, focused, pending, error | focus, disabled, pending, error | Not for irreversible confirmation alone. | Product/UI | core |
| DS-003 | Conversation Turn | display | Show user, AI, and system messages. | Intake | user, AI, system, low-confidence | default, pending, low-confidence, error | Not for confirmed state without conversion. | Product/UI | core |
| DS-004 | Question Cluster | input/display | Present small context-aware questions. | Intake, diagnostics follow-up | normal, blocking, optional | default, answered, skipped, unknown | Not for long deterministic questionnaires. | Product/UI | core |
| DS-005 | Proposal Card | review | Show proposed decisions, assumptions, follow-ups. | Proposal Review | decision, assumption, question, risk | proposed, low-confidence, conflicted, confirmed, rejected, deferred | Not for stable confirmed summaries without relabeling. | Product/UI | core |
| DS-006 | Decision Status Badge | state | Mark decision status. | Review, status, documents | proposed, confirmed, rejected, deferred, deprecated | default, selected, stale | Not as color-only indicator. | Product/UI | core |
| DS-007 | Assumption Badge | state | Mark unvalidated assumption status. | Review, validation, generation | proposed, accepted, needs-validation | default, warning, stale | Not as evidence indicator. | Product/UI | core |
| DS-008 | Diagnostic Finding Row | feedback/display | Summarize finding severity, affected object, next action. | Diagnostics, status | critical, error, warning, info | default, active, resolved, stale | Not as flat unprioritized list item. | Product/UI | core |
| DS-009 | Generation Summary | feedback/display | Summarize generated output categories. | Generation Report | success, partial, failed | pending, success, partial, failed | Not as simple success message when partial. | Product/UI | core |
| DS-010 | File Result Row | display | Show file path, output type, and result. | Generation Report, Output Browser | canonical, HTML artifact, agent pack | created, updated, skipped, blocked, failed, stale | Not without canonical/derived label. | Product/UI | core |
| DS-011 | Confirmation Prompt | overlay/system | Explain action, target, consequence, alternative. | Generation, config, decision confirmation | normal, strong, destructive | focused, pending, confirmed, canceled, error | Not for harmless read-only actions. | Product/UI | core |
| DS-012 | Inline Alert | feedback | Surface info, caveat, warning, error. | All relevant views | info, caveat, warning, error, low-confidence | default, dismissed, persistent | Not for blocking state without action. | Product/UI | core |
| DS-013 | Empty State Block | feedback/display | Explain absence and next action. | Empty views | new, zero-result, permission, filtered, intentional | default, action-available | Not for loading or error. | Product/UI | core |
| DS-014 | Loading Indicator | feedback | Show pending operation. | AI, generation, diagnostics | inline, report-level, long-running | pending, cancelable, timeout | Not without text label. | Product/UI | core |
| DS-015 | Recovery Panel | feedback/system | Show failure, preserved state, and recovery. | Error and Recovery View | retry, configure, change-root, status | error, partial, recovered | Not as raw log dump. | Product/UI | core |
| DS-016 | Command Help List | navigation/help | Show available commands and descriptions. | Help View | full, contextual, invalid-command | default, filtered | Not for out-of-scope commands. | Product/UI | core |
| DS-017 | Output Category Group | display/navigation | Group canonical docs, HTML artifacts, agent packs. | Output Browser, Generation Report | canonical, HTML, agent | empty, generated, stale, failed | Not without derived/canonical distinction. | Product/UI | supporting |
| DS-018 | Path Display | display | Show repository, root, and file paths. | Header, root config, reports | repository, root, file | valid, invalid, long, stale | Not with unsafe truncation only. | Product/UI | core |
| DS-019 | Provider Status Indicator | state | Show provider mode and disclosure status. | Header, provider config, intake | not-configured, local, remote, invalid | default, warning, error | Not without text label. | Product/UI | core |
| DS-020 | Severity Group | display | Group diagnostics and validation issues. | Diagnostics, Validation | critical, error, warning, info | expanded, collapsed | Not for unrelated content. | Product/UI | core |

Experimental or deferred components include Search Result List, Advanced Contract Inspector, Graph/Dependency Map, Collaboration Presence, and Marketplace Profile Card. They must not be treated as stable core components until scope and journeys require them.

## Component States

| State | Applies To | Trigger | Visual Treatment | Content Treatment | Interaction Behavior | Accessibility Behavior | Recovery or Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | all | normal rendering | standard tokens | normal label/content | normal | normal semantics | none |
| Hover | pointer surfaces | pointer over target | subtle emphasis | no content change | pointer-only support | not sole affordance | none |
| Focus | interactive components | keyboard focus | focus border/ring token | no hidden content | keyboard action available | visible focus required | activate or move |
| Active/pressed | actions | activation | temporary pressed treatment | label unchanged | executes or awaits confirm | announced where platform supports | feedback follows |
| Disabled | actions/inputs | unavailable action | de-emphasized but readable | reason available where needed | not interactive | not focusable unless explanation needed | explain or recover |
| Loading/pending | actions/reports | operation pending | pending token and text | "pending" or operation label | conflicting actions disabled | text status required | wait/cancel/retry |
| Error | feedback/components | failed operation | error token and border | specific failure and recovery | recovery action available | error text reachable | retry/config/status |
| Warning | alerts/status | risk or caveat | warning token | warning label and explanation | may require confirm | text label required | confirm/change/defer |
| Success | feedback/report | completed action | success token | completed result | next action visible | text status required | continue/review |
| Partial | reports | mixed result | partial token | succeeded and failed categories | review actions | text categories required | review/rerun |
| Selected | lists/tabs/groups | user selection | selected token | selected label | acts on selected item | selected state conveyed | change selection |
| Empty | views/groups | no content | empty block token | absence explanation | action if useful | text explanation | initialize/continue/generate |
| Low confidence | AI output | uncertain interpretation | low-confidence token | reason and review prompt | must allow review/correction | text label required | revise/reject/clarify |
| Permission restricted | config/write/provider | missing consent/access | restricted token | consequence and requirement | blocked until action | text label required | consent/config/change path |
| Stale | outputs/diagnostics | source state changed | stale token | source changed note | regenerate/rerun available | text label required | regenerate/rerun |
| Canonical | outputs | Markdown source output | canonical token | "Canonical Markdown" | review/open path | text label required | review/regenerate |
| Derived | outputs | HTML/agent generated | derived token | "Derived output" | review/regenerate | text label required | trace source |

State patterns prohibited:

- Disabled without explanation when user can recover.
- Loading without text.
- Success when result is partial.
- Low confidence styled like ordinary AI text.
- Derived output styled like canonical source.
- Warning hidden in muted caption.
- Permission restricted state presented as ordinary empty state.

## Accessibility Rules

Accessibility is a target and review requirement, not a compliance claim at this stage.

### Target Standard

- Target WCAG 2.2 AA for generated HTML artifacts and browser-based surfaces when implemented.
- For TUI surfaces, target keyboard-first operation, clear text labels, non-color meaning, readable contrast under common terminal themes, and documented limitations.

### Contrast

- Primary text and critical labels should target WCAG AA equivalent contrast where implementation permits.
- Warning, error, and low-confidence content must remain readable in both light and dark modes.
- Disabled text must remain readable enough to explain why the action is unavailable.
- Color themes must be tested before compliance is claimed.

### Keyboard and Focus

- Critical actions must be keyboard-operable.
- Focus state must be visible and consistent.
- Confirmation prompts must receive or clearly expose focus.
- Command input focus must be predictable.
- Keyboard shortcuts, if added, require non-shortcut alternatives.

### Screen Reader and Text Semantics

- Components must have text labels or accessible names where implementation supports them.
- Severity, status, canonical/derived, proposed/confirmed, and provider mode must be represented as text.
- Generated reports must not rely on table layout alone when compact rendering changes structure.

### Touch and Pointer

Touch-first mobile is not MVP. If future surfaces support touch:

- Critical targets should meet common target-size guidance.
- Hover-only content must have touch and keyboard alternatives.
- Pointer gestures must not be required for confirmation or recovery.

### Reduced Motion

- Motion must be optional or reducible in browser surfaces.
- TUI loading indicators need static text alternatives.
- No critical meaning may depend on motion.

## Theming and Platform Adaptation

### Supported Modes

| Mode | Status | Adaptation |
| --- | --- | --- |
| Terminal default theme | MVP | Respect user terminal where possible; rely on semantic text labels. |
| Terminal dark/light compatibility | MVP target | Choose semantic tokens that can map to readable dark/light palettes. |
| Compact/standard/wide density | MVP target | Adapt spacing and layout, not critical information. |
| Generated HTML light theme | MVP artifact target | Provide readable default. |
| Generated HTML dark theme | preferred / deferred | Support if artifact implementation has stable tokens. |
| High contrast mode | preferred / deferred | Requires implementation and testing. |
| Brand modes | deferred | Not needed before product identity and validation mature. |
| Touch/mobile mode | deferred | Not part of MVP primary surface. |

### Invariants Across Themes

- Semantic state meaning.
- Text labels for critical status.
- Proposed versus confirmed distinction.
- Canonical versus derived distinction.
- `logos/` default root disclosure.
- Provider disclosure.
- Confirmation and recovery structure.
- Keyboard-first command path.

### Platform Adaptation Rules

- Terminal surfaces prioritize text, keyboard, and compact hierarchy.
- Generated HTML artifacts may use richer typography and spacing but must preserve caveats and source labels.
- Future web surfaces must not replace local canonical source-of-truth behavior.
- Platform-specific conventions may vary presentation, not product meaning.

## Design Anti-Patterns

| Anti-Pattern | Harm | Violates | Early Signal |
| --- | --- | --- | --- |
| Token by color value only | Makes state meaning fragile and hard to theme. | Semantic Before Decorative | Components use `blue` where `proposed` is meant. |
| Component variant for one screen only | Creates drift and maintenance burden. | Governed Evolution | One-off alert or badge appears. |
| Color-only severity | Hides meaning from users and assistive tech. | Accessibility Is Structural | Diagnostic rows differ only by color. |
| Proposed and confirmed look alike | Creates false AI authority. | State Is First-Class | Users cannot tell review state. |
| Derived and canonical look alike | Breaks source-of-truth clarity. | Semantic Before Decorative | HTML artifact treated as canonical. |
| Dashboard card proliferation | Pulls product toward SaaS dashboard mental model. | Calm Density | First screen becomes metrics/cards. |
| Decorative motion | Distracts from state and recovery. | Accessibility Is Structural | Loading or success animation dominates. |
| Success over-celebration | Overstates generation or validation. | Trust Model | Generated docs feel "done" or validated. |
| Muted critical warnings | Hides consequence for visual cleanliness. | State Is First-Class | Provider/root warning appears as caption. |
| Raw log styling as primary UI | Overexposes implementation instead of product meaning. | Calm Density | Recovery screen shows stack-like detail first. |
| Icon-only actions | Reduces discoverability and accessibility. | Accessibility Is Structural | Confirmation uses symbols without labels. |
| Nested panels/cards | Adds visual noise and false hierarchy. | Calm Density | Cards inside cards in reports. |
| Over-branded themes | Makes product identity louder than state. | Semantic Before Decorative | Brand color overrides warning/error semantics. |

## Governance

Design system governance should be lightweight but explicit. It exists to prevent drift without blocking necessary evolution.

### Change Types

| Change Type | Review Requirement | Required Rationale |
| --- | --- | --- |
| New semantic token | Product/UI review | State, component, accessibility, or theme need. |
| New primitive token | Engineering Design System review | Implementation mapping need. |
| New component | Product/UI review | Screen, journey, object, or state requirement. |
| New variant | Product/UI review | Behavior, state, content, or accessibility difference. |
| New exception | Explicit exception record | Scope, expiration/review trigger, downstream impact. |
| Deprecated token/component | Product and engineering review | Replacement, migration, risk. |
| Breaking visual/state change | Product, UI, engineering review | Affected screens, tests, docs, acceptance criteria. |

### Exception Format

Each approved exception must include:

- exception;
- affected token or component;
- rationale;
- scope;
- expiration or review trigger;
- risk;
- approval owner;
- downstream impact.

### Versioning

The product design system should be versioned when:

- token names change;
- component anatomy changes;
- component state meaning changes;
- accessibility rules change;
- theming rules change;
- downstream implementation contracts change.

Minor clarifications may update the document without a new formal system version until Engineering Design System exists.

### Deprecation Rules

- Deprecated tokens/components must have replacements.
- Deprecations must identify affected screens and components.
- Derived artifacts and generated outputs must be checked for stale design references.
- Deprecated names must not remain as hidden aliases without review.

### Documents to Update After Design System Changes

- UI Specification when screens or components change.
- Content Model when labels, statuses, or microcopy patterns change.
- State Model when state visibility or naming changes.
- Permission Model when confirmation or consent components change.
- Feature Specification when component behavior affects feature scope.
- Acceptance Criteria when state, accessibility, or component rules become testable.
- Engineering Design System and Frontend Architecture when implementation tokens/components change.

## Downstream Handoff

### Feature Specification

Feature Specification must inherit:

- component inventory and MVP/supporting/deferred classifications;
- state requirements for each user-facing feature;
- confirmation, recovery, status, and report component requirements;
- no-dashboard, no-task-board, and no-autonomous-agent visual boundaries;
- derived/canonical labeling requirements.

### Acceptance Criteria

Acceptance Criteria must verify:

- state labels are visible in text;
- proposed and confirmed states are visually and textually distinct;
- assumptions and unknowns are not styled as errors;
- canonical and derived outputs are distinct;
- partial generation is distinct from success;
- provider disclosure and root warnings are visible;
- critical states do not rely on color alone;
- confirmation prompts include action, target, consequence, and alternative;
- compact terminal layouts preserve critical information;
- component states include loading, error, warning, success, partial, disabled, permission-restricted, and low-confidence where relevant.

### Frontend Architecture

Frontend Architecture must define:

- token implementation strategy;
- terminal rendering constraints;
- generated HTML artifact token mapping;
- focus and keyboard behavior;
- compact table/list degradation;
- theme and density support;
- component composition boundaries;
- state-driven rendering;
- accessibility testing approach appropriate to TUI and generated HTML surfaces.

### Engineering Design System

Engineering Design System must turn this product-level specification into implementation artifacts:

- primitive tokens;
- semantic tokens;
- component tokens;
- component APIs or props;
- state variants;
- accessibility hooks;
- reduced-motion behavior;
- documentation examples;
- migration and deprecation tooling where needed.

### Engineering Brief

Engineering must preserve:

- local-first TUI behavior;
- slash-command compatibility;
- semantic state rendering;
- no raw token exposure in provider components;
- configurable `logos/` documentation root display;
- canonical versus derived distinctions;
- state-driven feedback and recovery.

### Unresolved Design System Questions

- Which exact terminal UI framework capabilities constrain focus, color, layout, and accessibility?
- What exact primitive palette should map to semantic color roles?
- Should generated HTML artifacts support dark mode in MVP?
- How much iconography should be used in the TUI versus text-only labels?
- Which components require implementation snapshots or visual regression tests?
- How should long paths be truncated, wrapped, or copied across terminal and HTML surfaces?
- Should the design system define a public brand later, or remain product-operational for MVP?
- What versioning model should begin before Engineering Design System exists?
