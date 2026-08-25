# casuya-ai

> Personal AI Teacher — Intelligent educational assistance for the Casuya ecosystem.

## Overview

**casuya-ai** is the AI layer of Casuya Phase 2, providing intelligent educational assistance including tutoring, recommendations, question generation, summarization, translation, and content moderation.

### Identity

Personal AI Teacher — provides intelligent educational assistance across all Casuya learning experiences.

## Architecture

```
casuya-ai/
├── src/
│   ├── types/              # TypeScript type definitions
│   ├── providers/          # AI provider abstraction (OpenAI, Gemini, Anthropic, Local)
│   ├── tutoring/           # Tutoring engine
│   ├── recommendations/    # Content recommendation engine
│   ├── personalization/    # Student personalization and adaptive learning
│   ├── learning-paths/     # Learning path generation
│   ├── question-generation/# Automated question generation
│   ├── summarization/      # Educational content summarization
│   ├── translation/        # Educational content translation
│   ├── moderation/         # Content moderation and safety
│   ├── prompts/            # Prompt template management
│   ├── caching/            # Multi-tier caching
│   ├── analytics/          # Event analytics
│   ├── adapters/           # Provider, runtime, and bridge adapters
│   └── utilities/          # Shared utilities
```

## Quick Start

```bash
npm install casuya-ai
```

```typescript
import { CasuyaAI } from 'casuya-ai';

const ai = new CasuyaAI();

// Get a tutoring explanation
const response = await ai.tutor({
  studentId: 'student-1',
  subject: 'mathematics',
  topic: 'Algebra',
  mode: 'explain',
  message: 'What is a variable?',
});

console.log(response.message);
```

## Modules

| Module | Description |
|--------|-------------|
| **TutoringEngine** | AI-powered tutoring with multiple pedagogical modes |
| **RecommendationEngine** | Content-based, collaborative, and knowledge-gap recommendations |
| **PersonalizationEngine** | Student profiling and adaptive parameter calculation |
| **LearningPathGenerator** | Dynamic learning path generation with prerequisite checks |
| **QuestionGenerator** | Automated question generation with question bank |
| **Summarizer** | Extractive, abstractive, and hybrid summarization |
| **Translator** | Educational content translation with language detection |
| **ContentModerator** | Pattern-based and AI-powered content moderation |
| **PromptManager** | Prompt template management and rendering |
| **CacheManager** | TTL-based caching with LRU eviction |
| **AnalyticsCollector** | Event tracking and analytics aggregation |

## Provider Support

| Provider | Type | Capabilities |
|----------|------|--------------|
| OpenAI | `openai` | Chat, Embeddings, Moderation, Vision |
| Gemini | `gemini` | Chat, Embeddings, Vision |
| Anthropic | `anthropic` | Chat, Long context |
| Local (Ollama) | `local` | Chat, Embeddings |

## Configuration

```typescript
const ai = new CasuyaAI({
  providers: new Map([
    ['primary', { type: 'openai', apiKey: process.env.OPENAI_API_KEY }],
    ['fallback', { type: 'local', model: 'llama3.2' }],
  ]),
  defaultProvider: 'primary',
});
```

## Developer Must Build

- [x] Tutoring engine
- [x] Recommendation engine
- [x] Prompt management
- [x] Question generation
- [x] Summarization
- [x] Translation
- [x] Moderation
- [x] Learning pathways
- [x] Personalization engine
- [x] Provider adapters
- [x] Caching
- [x] Analytics

## Developer Must Never Build

- Authentication (→ casuya-platform)
- Synchronization (→ casuya-bridge)
- Lesson execution (→ casuya-runtime)
- Lesson packaging (→ casuya-core)
- Payments (→ casuya-platform)
- School administration (→ casuya-platform)

## Testing

```bash
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage   # With coverage report
```

## License

MIT
