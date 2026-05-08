## Summary

What does this PR do and why?

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Enhancement
- [ ] Refactor
- [ ] Documentation
- [ ] Test
- [ ] CI / tooling

## Scope

- [ ] Core engine (TUI, renderer, validation, storage, diagnostics)
- [ ] AI / LLM integration
- [ ] Profile or template
- [ ] Documentation
- [ ] Developer experience

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] No live AI calls in default tests

## Quality Gate

- [ ] `pnpm lint:biome` passes
- [ ] `pnpm lint:md` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds

## AI Safety Checklist (if touching AI code)

- [ ] AI calls route through provider abstraction
- [ ] Mock provider works for tests
- [ ] Raw tokens not stored in project files
- [ ] AI output properly classified (`draft`, `proposed`, etc.)
- [ ] No AI operation directly mutates project state

## Additional Notes

Anything else reviewers should know.
