// Purpose: Register the `init` CLI command.
// What it should do: Initialize a LOGOS project in the current directory.
// Why it exists: Creates logos.yml, docs.yml, phases, and initial runtime folders.

import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a LOGOS project in the current directory.")
    .action(async () => {
      // TODO: call the corresponding application use case.
      console.log("TODO: logos init");
    });
}
