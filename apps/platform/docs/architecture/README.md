# Architecture Documentation

Design decisions and architectural notes for the Casuya platform.

## Key Files

- `apps/platform/README.md` — Full architecture overview and architectural contract
- `packages/blackboard/PLAN.md` — Blackboard integration plan

## Architecture Rules

```
api → services → models
services → integrations
tasks → services → integrations
```

**Forbidden:**
```
api → integrations
models → integrations
models → services
integrations → api
integrations → services
```

See `apps/platform/README.md` for the full architectural contract.
