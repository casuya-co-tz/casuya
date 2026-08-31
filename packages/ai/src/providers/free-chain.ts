import { ProviderConfig, ProviderType } from '../types';

export interface FreeProviderSpec {
  name: string;
  config: ProviderConfig;
}

const FREE_CHAIN_DEFAULT = [
  'groq',
  'google',
  'mistral',
  'grok',
  'nvidia',
  'openrouter',
  'openrouter-gemma',
  'local',
] as const;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * Build every free/cheap provider we have keys for.
 * Order is Groq → Google → Mistral → Grok → NVIDIA → OpenRouter → local,
 * so a student question keeps trying until one model answers.
 */
export function buildFreeProviderSpecs(): { specs: FreeProviderSpec[]; chain: string[] } {
  const specs: FreeProviderSpec[] = [];

  const groqKey = firstEnv('GROQ_API_KEY');
  if (groqKey) {
    specs.push({
      name: 'groq',
      config: {
        type: ProviderType.GROQ,
        apiKey: groqKey,
        endpoint: 'https://api.groq.com/openai/v1',
        model: env('GROQ_MODEL') || 'llama-3.1-8b-instant',
        maxRetries: 1,
        timeout: 20000,
      },
    });
  }

  const googleKey = firstEnv('GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY');
  if (googleKey) {
    specs.push({
      name: 'google',
      config: {
        type: ProviderType.GEMINI,
        apiKey: googleKey,
        model: env('GEMINI_MODEL') || env('GOOGLE_AI_MODEL') || 'gemini-2.0-flash',
        maxRetries: 1,
        timeout: 25000,
      },
    });
  }

  const mistralKey = firstEnv('MISTRAL_API_KEY');
  if (mistralKey) {
    specs.push({
      name: 'mistral',
      config: {
        type: ProviderType.MISTRAL,
        apiKey: mistralKey,
        endpoint: 'https://api.mistral.ai/v1',
        model: env('MISTRAL_MODEL') || 'mistral-small-latest',
        maxRetries: 1,
        timeout: 25000,
      },
    });
  }

  const grokKey = firstEnv('GROK_API_KEY', 'XAI_API_KEY');
  if (grokKey) {
    specs.push({
      name: 'grok',
      config: {
        type: ProviderType.GROK,
        apiKey: grokKey,
        endpoint: 'https://api.x.ai/v1',
        model: env('GROK_MODEL') || env('XAI_MODEL') || 'grok-3-mini',
        maxRetries: 1,
        timeout: 25000,
      },
    });
  }

  const nvidiaKey = firstEnv('NVIDIA_API_KEY');
  if (nvidiaKey) {
    specs.push({
      name: 'nvidia',
      config: {
        type: ProviderType.NVIDIA,
        apiKey: nvidiaKey,
        endpoint: 'https://integrate.api.nvidia.com/v1',
        model: env('NVIDIA_MODEL') || 'meta/llama-3.1-8b-instruct',
        maxRetries: 1,
        timeout: 25000,
      },
    });
  }

  const openrouterKey = firstEnv('OPENROUTER_API_KEY');
  if (openrouterKey) {
    const headers = {
      'HTTP-Referer': env('SITE_URL') || 'https://casuya.co.tz',
      'X-Title': env('SITE_NAME') || 'Casuya',
    };
    specs.push({
      name: 'openrouter',
      config: {
        type: ProviderType.OPENROUTER,
        apiKey: openrouterKey,
        endpoint: 'https://openrouter.ai/api/v1',
        model: env('OPENROUTER_MODEL') || 'meta-llama/llama-3.1-8b-instruct:free',
        maxRetries: 1,
        timeout: 30000,
        options: { defaultHeaders: headers },
      },
    });
    specs.push({
      name: 'openrouter-gemma',
      config: {
        type: ProviderType.OPENROUTER,
        apiKey: openrouterKey,
        endpoint: 'https://openrouter.ai/api/v1',
        model: env('OPENROUTER_FREE_MODEL') || 'google/gemma-2-9b-it:free',
        maxRetries: 1,
        timeout: 30000,
        options: { defaultHeaders: headers },
      },
    });
  }

  specs.push({
    name: 'local',
    config: {
      type: ProviderType.LOCAL,
      endpoint: env('OLLAMA_URL') || 'http://localhost:11434',
      model: env('LOCAL_MODEL') || 'llama3.2',
      maxRetries: 0,
      timeout: 8000,
    },
  });

  const requested = (env('CASUYA_AI_PROVIDER_CHAIN') || FREE_CHAIN_DEFAULT.join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const byName = new Map(specs.map((s) => [s.name, s]));
  const chain = requested.filter((name) => byName.has(name));
  for (const spec of specs) {
    if (!chain.includes(spec.name)) chain.push(spec.name);
  }

  return { specs, chain };
}

export function specsToConfigMap(specs: FreeProviderSpec[]): Map<string, ProviderConfig> {
  const map = new Map<string, ProviderConfig>();
  for (const spec of specs) {
    map.set(spec.name, spec.config);
  }
  return map;
}
