// Purpose: CLI entrypoint for the LOGOS Engine.
// What it should do: Register commands such as init, status, validate, interview, generate, and compile.
// Why it exists: Even with a TUI, the MVP needs scriptable commands for automation, tests, and agent-driven usage.

import { Command } from "commander";
import { registerCommands } from "./command-registry.js";

const program = new Command();

program
  .name("logos")
  .description("LOGOS Engine: deterministic documentation workflow")
  .version("0.1.0");

registerCommands(program);

await program.parseAsync(process.argv);
