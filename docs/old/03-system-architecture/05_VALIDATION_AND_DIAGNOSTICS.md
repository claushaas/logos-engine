# Validation and Diagnostics

## Purpose

Validation determines whether the project has enough structured clarity to proceed.

Diagnostics explain what is missing, risky, or inconsistent.

## Validation Types

### Required Decision Validation

Checks whether required decisions exist.

Example:

```text
MVP Scope cannot be finalized without target user and core problem.
```

### Dependency Validation

Checks whether downstream decisions are missing.

Example:

```text
Offline-first requires sync strategy.
```

### Consistency Validation

Checks contradictions.

Example:

```text
User selected both "no backend" and "multi-device sync".
```

### Risk Validation

Identifies risk patterns.

Example:

```text
Freemium + AI-heavy workflow + low pricing may create margin risk.
```

## Severity Levels

### Info

Helpful note.

### Warning

Important gap, but progress can continue.

### Error

Critical gap that blocks a phase.

### Critical

Major structural contradiction or high-risk missing decision.

## Diagnostic Output

The diagnostic command should show:

- project progress;
- missing decisions;
- open assumptions;
- risks;
- affected documents;
- recommended next questions.

## Example Output

```text
Diagnostics: App Business Profile

Critical:
- Pricing model is undefined. Financial model cannot be completed.

Warnings:
- ICP is broad.
- Retention mechanism is not defined.
- Launch channel depends heavily on paid ads but CAC is unknown.

Recommended next step:
- Answer Economics Round 1: Pricing and Cost Structure.
```
