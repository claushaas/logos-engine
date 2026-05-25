// Purpose: Centralize CLI command registration.
// What it should do: Attach every available command to the Commander program.
// Why it exists: Keeps main.ts small and prevents command registration from spreading across the CLI layer.

import type { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerInterviewCommand } from "./commands/interview.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerCompileCommand } from "./commands/compile.js";

export function registerCommands(program: Command): void {
  registerInitCommand(program);
  registerStatusCommand(program);
  registerValidateCommand(program);
  registerInterviewCommand(program);
  registerGenerateCommand(program);
  registerCompileCommand(program);
}
