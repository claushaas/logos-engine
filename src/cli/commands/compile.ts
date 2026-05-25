// Purpose: Register the `compile` CLI command.
// What it should do: Compile the Executive Axis.
// Why it exists: Derives execution JSON and exports from validated canonical documentation.

import type { Command } from "commander";

export function registerCompileCommand(program: Command): void {
  program
    .command("compile")
    .description("Compile the Executive Axis.")
    .action(async () => {
      // TODO: call the corresponding application use case.
      console.log("TODO: logos compile");
    });
}
