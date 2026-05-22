# LOGOS Core

LOGOS Core is the Pi-independent product engine.

It owns product behavior such as configuration, profile resolution, intake state, question selection, answer evaluation contracts, generation preflight, validation, artifacts, and persistence ports.

Core must not import Pi APIs, Pi extension modules, Ink, React, TUI modules, or CLI command modules.

Pi-specific code belongs outside Core.
