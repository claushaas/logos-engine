# Release Process

## Versioning

Use semantic versioning.

```text
MAJOR.MINOR.PATCH
```

## Pre-Release Checklist

- tests pass;
- docs updated;
- changelog updated;
- example workspace regenerated;
- install flow tested;
- README verified.

## Release Steps

1. Update version.
2. Update changelog.
3. Run tests.
4. Build package.
5. Create Git tag.
6. Publish npm package.
7. Create GitHub release.
8. Announce release.

## Release Channels

### Stable

Recommended for general use.

### Preview

For testing new profiles and engine behavior.

## Breaking Changes

Breaking changes must include:

- migration notes;
- affected files;
- profile compatibility notes.

## Profile Versioning

Profiles should be versioned separately or locked by engine release.
