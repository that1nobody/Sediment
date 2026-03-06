# Contributing

## Branching workflow

Please do not develop directly on `main`.

Use short-lived feature branches for all work:

1. `git checkout main`
2. `git pull`
3. `git checkout -b feat/<short-description>`
4. Make changes and run tests
5. Commit with a clear message
6. Open a pull request into `main`

## Suggested branch prefixes

- `feat/` for new features
- `fix/` for bug fixes
- `docs/` for documentation updates
- `chore/` for maintenance changes

## Testing

Before opening a PR, run:

- `npm test`
- `npm run test:coverage` (when touching worldgen/simulation logic)
