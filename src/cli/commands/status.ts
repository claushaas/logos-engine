// Purpose: Register the `status` CLI command.
// What it should do: Show project status.
// Why it exists: Loads the project and reports phase/document completeness.

import type { Command } from "commander";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project status.")
    .action(async () => {
      // TODO: call the corresponding application use case.
      console.log("TODO: logos status");
    });
}
