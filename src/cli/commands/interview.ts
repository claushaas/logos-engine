// Purpose: Register the `interview` CLI command.
// What it should do: Start or resume a documentation interview.
// Why it exists: Drives the lifecycle state machine that asks questions and records answers.

import type { Command } from "commander";

export function registerInterviewCommand(program: Command): void {
  program
    .command("interview")
    .description("Start or resume a documentation interview.")
    .action(async () => {
      // TODO: call the corresponding application use case.
      console.log("TODO: logos interview");
    });
}
