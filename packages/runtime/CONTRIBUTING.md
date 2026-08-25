# Contributing to casuya-runtime

## Before Writing Code

Every developer must answer the **FINAL IMPLEMENTATION LAW** questions:

1. **Why does this repository exist?** — Safely execute lesson packages
2. **Which problem is it solving?** — Interactive content + security isolation
3. **Does this code belong here?** — Never build auth, payments, or sync here
4. **Which repository owns this responsibility?** — casuya-runtime owns execution
5. **Will it work on low-end Android devices?** — Must test on 512MB RAM
6. **Does it reduce server costs?** — Process on device, sync later
7. **Does it maintain backward compatibility?** — Never break existing lessons
8. **Is it secure?** — Lesson packages are untrusted
9. **Is it modular?** — Every module must be replaceable
10. **Is it testable?** — Unit + Integration + Performance + Security + Offline tests required

## Repository Boundaries

casuya-runtime may communicate with:
- `casuya-bridge` — via Bridge API for storage/sync
- `casuya-platform` — via Platform API for auth/user context

casuya-runtime must NEVER:
- Render UI outside the lesson container
- Access platform internals
- Generate lesson packages
- Handle authentication or payments

## Development Workflow

1. Branch from `develop`
2. Implement with tests
3. Run `npm run test:all`
4. Run `npm run lint`
5. Create PR to `develop`

## Branch Strategy

- `main` — Production releases
- `develop` — Integration branch
- `feature/*` — New features
- `fix/*` — Bug fixes
- `perf/*` — Performance improvements
- `security/*` — Security patches
