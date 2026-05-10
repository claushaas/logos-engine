# LOGOS Engine Documentation

This directory contains the normative documentation skeleton used by LOGOS Engine to generate, review, validate, and maintain project documentation.

## Structure

- **`docs.yml`** — Root registry defining the normative axis and its six phases.
- **`phases/`** — Phase definitions and document specifications.

## The Normative Axis

The normative axis answers the complete lifecycle of a project from foundation through sustained operations:

| Phase               | Central Question                                  |
| ------------------- | ------------------------------------------------- |
| `01-foundation`     | Why does this project exist?                      |
| `02-validation`     | Does this project deserve to advance?             |
| `03-product`        | What exactly will be built?                       |
| `04-engineering`    | How will it be built reliably?                    |
| `05-go-to-market`   | How will it reach the market?                     |
| `06-operations`     | How will it remain alive and healthy?             |

## How to Read

1. Start with `docs.yml` for the global registry.
2. Read the phase `README.md` for navigation within each phase.
3. Each phase contains YAML document definitions specifying structure, sections, and guiding questions.
4. Content documents (`.md`) contain the actual project decisions — generated from the YAML specifications.
