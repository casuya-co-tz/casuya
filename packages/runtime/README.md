# casuya-runtime

**Identity**: The Lesson Player — Think "Educational Browser"

## Mission

Safely execute lesson packages in a sandboxed environment, providing interactive educational experiences including games, animations, simulations, and interactive laboratories — all while maintaining session restoration and security isolation.

## Problems Solved

- **Games & Animations**: Render interactive HTML5 content safely
- **Simulations & Labs**: Execute complex educational simulations
- **Session Restoration**: Resume lessons exactly where students left off
- **Security Isolation**: Prevent malicious lesson packages from causing harm
- **Low-End Devices**: Runs on devices with 512MB RAM and weak CPUs
- **Offline Execution**: Lessons work without internet connectivity

## Architecture

```
casuya-runtime
│
├── package-loader      # Load, parse, validate lesson packages
├── renderer            # HTML/CSS/Canvas/Media rendering
├── sandbox             # JavaScript engine, permissions, security
├── api                 # Quiz, Game, Storage, Media, Analytics, Timer, Event APIs
├── state-manager       # Runtime state, snapshots, persistence
├── session-manager     # Session lifecycle and restoration
├── cache               # LRU cache for packages and assets
├── security            # CSP, sanitization, signature verification
├── events              # Internal event bus
├── extensions          # Plugin system for extensibility
├── monitoring          # Performance, errors, metrics
└── utilities           # Shared helpers
```

## Quick Start

```js
import { Runtime } from 'casuya-runtime';

const runtime = new Runtime({
  container: document.getElementById('lesson-container'),
  permissions: ['storage', 'media', 'quiz']
});

await runtime.load(packageManifest);
await runtime.start();
```

## Communication Flow

```
casuya-core → Lesson Package → casuya-runtime → Student Interactions → casuya-bridge → Synchronization → casuya-platform
```

## Rules

| Rule | Description |
|------|-------------|
| Offline First | Assume internet will fail — learning must continue |
| Low-End First | 512MB RAM, weak CPU, old browsers — must work |
| Performance | Every operation optimized for speed and memory |
| Security | Lesson packages are untrusted — validate everything |
| Modular | Every module replaceable, boundaries are sacred |
| Testable | Unit, integration, performance, security, offline tests |

## Development

```bash
# Install
npm install

# Test
npm run test:all

# Build
npm run build:prod

# Lint
npm run lint
```

## License

MIT © Casuya Project
