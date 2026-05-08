# Interaction Flows

## Flow 1 — New Project

```text
User runs logos init
→ selects profile
→ confirms project name
→ creates workspace
→ starts foundation questions
→ generates initial docs
```

## Flow 2 — Continue Intake

```text
User runs logos continue
→ system loads state
→ shows progress
→ selects next question group
→ user answers
→ decisions update
→ docs refresh option appears
```

## Flow 3 — Diagnostic Review

```text
User runs logos diagnose
→ system analyzes gaps
→ groups findings by severity
→ suggests next action
```

## Flow 4 — Document Generation

```text
User runs logos generate
→ system renders docs
→ reports created/updated/skipped files
```

## Flow 5 — Decision Change

```text
User changes decision
→ system records revision
→ identifies impacted docs
→ suggests validation rerun
```

## Flow 6 — Unknown Answer

When the user answers "I don't know":

```text
answer stored
→ related decision marked unknown
→ open question created
→ phase progress remains incomplete
```

## Flow 7 — Assumption Answer

When the user says "assume X":

```text
answer stored
→ decision marked assumed
→ assumption logged
→ validation may allow progress with warning
```
