// Purpose: Register the `generate` CLI command.
// What it should do: Generate documents from canonical answers.
// Why it exists: Uses deterministic LLM calls and renderers to produce drafts with traceability.

import type { Command } from "commander";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate documents from canonical answers.")
    .action(async () => {
      // TODO: call the corresponding application use case.
      console.log("TODO: logos generate");
    });
}
