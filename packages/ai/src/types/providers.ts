import { JsonValue } from './common';

export enum ProviderType {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local',
}

export enum ModelCapability {
  CHAT = 'chat',
  EMBEDDINGS = 'embeddings',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  MODERATION = 'moderation',
  QUESTION_GENERATION = 'question_generation',
  CODE = 'code',
  VISION = 'vision',
}

export interface ModelConfig {
  name: string;
  provider: ProviderType;
  capabilities: ModelCapability[];
  maxTokens: number;
  contextWindow: number;
  costPer1KTokens: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  content: string;
  usage: TokenUsage;
  finishReason: string;
  latency: number;
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  model: string;
  embeddings: number[][];
  usage: TokenUsage;
  latency: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
  options?: Record<string, JsonValue>;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
}

export abstract class BaseProviderConfig {
  constructor(public config: ProviderConfig) {}
}

export interface ProviderHealth {
  healthy: boolean;
  latency: number;
  model: string;
  error?: string;
}
