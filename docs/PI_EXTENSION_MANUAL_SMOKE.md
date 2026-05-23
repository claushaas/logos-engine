# LOGOS Pi Extension Manual Smoke

## Purpose

This document is a **manual smoke checklist** for validating the LOGOS Pi
extension in a real Pi Coding Agent session. It is not an automated test.

Automated contract, unit, integration, and E2E tests use the **fake Pi
harness** under `tests/` and do not require a real Pi runtime.

Use this checklist to confirm that:

- The extension loads correctly in a real Pi session.
- The five allowed lifecycle commands work end-to-end.
- Conversational intake advances without command-first progression.
- `/logos-generate` respects preflight safety and partial-generation
  confirmation.
- Forbidden command-first commands are not available and not needed.

## Preconditions

- [ ] A local Pi Coding Agent installation (e.g., via Homebrew or npm).
- [ ] Node.js >= 22.
- [ ] This repository cloned and dependencies installed (`pnpm install`).
- [ ] The repository built (`pnpm build`) so the extension entrypoint
      resolves at `dist/pi-extension/index.js`.
- [ ] A clean test project directory **separate from this repository**
      (e.g., `/tmp/logos-smoke-project`).

## Extension Loading

### Option A — Load from source via Pi `-e` flag

```sh
pi -e /absolute/path/to/logos-engine/src/pi-extension/index.ts
```

If Pi does not support direct `.ts` loading, build the project first
(`pnpm build`) and point to `dist/pi-extension/index.js` instead.

### Option B — Project-local `.pi/extensions/` symlink (if supported)

```sh
mkdir -p /tmp/logos-smoke-project/.pi/extensions/logos
ln -s /absolute/path/to/logos-engine/src/pi-extension/index.ts \
  /tmp/logos-smoke-project/.pi/extensions/logos/index.ts
```

Then open Pi inside `/tmp/logos-smoke-project`. The local extension
should load automatically.

> **Note:** The logos-engine repository does not currently ship a
> `.pi/extensions/logos/` local entrypoint bundle. If project-local
> `.pi/extensions/` loading is the preferred path for your Pi
> installation, create a thin re-export file at
> `.pi/extensions/logos/index.ts` containing only:
>
> ```ts
> export { default } from "../../../src/pi-extension/index.js";
> ```
>
> Do not add product logic, command registration, or Core imports to
> that file.

## Test Project Setup

1. Create an empty directory (not inside this repository):

   ```sh
   mkdir -p /tmp/logos-smoke-project
   cd /tmp/logos-smoke-project
   ```

2. No `.logos/` directory should exist yet.
3. Optionally create a minimal `.gitignore` to keep the test project
   clean.

## Smoke Sequence

Perform each step in order. Record any deviation under **Failure
Recording**.

### 1. Initialize

Command:

```text
/logos-init
```

Expected:

- LOGOS creates `.logos/config.yml` with `activeProfileId: standard`
  (or reports an actionable blocker such as a missing profile).
- If a blocker is reported, inspect and resolve before continuing.
- No crash, no silent failure.

Actual (to be filled by tester):

```text
(To be filled by tester)
```

### 2. Start Intake

Command:

```text
/logos-start
```

Expected:

- LOGOS immediately emits an assistant message containing the **first
  unresolved question** from the active profile.
- The user does **not** need to type anything before seeing a question.
- `/logos-start` is not a silent passive toggle — output is visible.

Actual:

```text
(To be filled by tester)
```

### 3. Answer Naturally

After the question appears, type a natural-language answer. For example:

> I think the project should be called "Phoenix", and the primary
> audience is internal engineering teams.

Expected:

- LOGOS evaluates the answer and renders a **follow-up**, a
  **clarification request**, or the **next question** — all without
  the user typing any additional slash command.
- If the answer is sufficient, the question advances.
- If the answer is partial, a targeted follow-up appears without
  advancing.

Actual:

```text
(To be filled by tester)
```

### 4. Check Status

Command (during active intake):

```text
/logos-status
```

Expected:

- LOGOS pauses or preserves the active question safely.
- A status report is rendered showing:
  - Intake phase / progress.
  - Questions answered vs total.
  - Any blockers (missing profile, contradictions).
- `/logos-status` does **not** consume the command text as an answer
  to the active intake question.

Actual:

```text
(To be filled by tester)
```

### 5. Request Generation

Command:

```text
/logos-generate
```

Expected:

- LOGOS runs preflight and renders **one** of:
  - **Blockers**: missing critical intake, unresolved contradictions →
    generation refused or requires explicit confirmation.
  - **Partial available**: confirmation prompt asking whether to
    generate partial drafts marked incomplete.
  - **Ready**: dry-run or write-plan result with output paths and
    provenance.
- Accepting partial generation marks docs as incomplete.
- Declining partial generation writes nothing.
- No files are written outside the project root.

Actual:

```text
(To be filled by tester)
```

### 6. Forbidden Command Checks

In the same Pi session, type each of the following and confirm Pi does
**not** recognize them as LOGOS commands:

- `/logos-next`
- `/logos-answer`
- `/logos-continue`
- `/logos-question`
- `/logos-phase`
- `/logos-doc`
- `/logos-set-answer`
- `/logos-skip`
- `/logos-followup`

Expected:

- None of these are registered LOGOS commands.
- Pi may report "unknown command" or ignore them — either behavior is
  acceptable as long as they do **not** trigger LOGOS intake behavior.
- The user must **not** need any of these to advance intake.

Actual:

```text
(To be filled by tester)
```

## Expected Results Summary

| Step | Command / Input | Expected Outcome |
|------|-----------------|------------------|
| 1 | `/logos-init` | Initializes `.logos/` or reports blocker |
| 2 | `/logos-start` | Immediately emits first question |
| 3 | Natural answer | Renders next question / follow-up / clarification |
| 4 | `/logos-status` | Safe pause + status report |
| 5 | `/logos-generate` | Preflight blockers, confirmation, or dry-run |
| 6 | Forbidden commands | Not registered, not needed |

## Failure Recording Template

Copy for each failure observed:

```text
- Date:
- Git SHA:
- Pi version:
- Node version:
- Step:
- Command/input:
- Expected:
- Actual:
- Logs/screenshots:
- Repro steps:
```

## Cleanup

After smoke testing:

```sh
rm -rf /tmp/logos-smoke-project
```

If `pnpm build` was run in the repository and you do not want `dist/`,
run `git clean -fdX` (caution: removes all ignored files).

## Not Covered By This Smoke

- Performance under large question registries.
- Concurrent Pi sessions or multiple active intakes.
- Live AI provider integration (intake uses deterministic evaluation).
- CLI/TUI legacy flows (deferred from MVP).
- Cross-platform filesystem edge cases.
- Network-dependent behavior or remote profile loading.
- Executive export artifacts (not yet in MVP intake flow).
- Persistence across Pi restarts (session-level persistence is a Pi
  concern; canonical LOGOS state is project-local).
- Security scanning of committed artifacts.
