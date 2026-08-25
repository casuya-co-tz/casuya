import { Language } from './common';

export interface ModerationRequest {
  content: string;
  contentType: ModerationContentType;
  language: Language;
  studentAge?: number;
  context?: string;
}

export enum ModerationContentType {
  TEXT = 'text',
  IMAGE = 'image',
  CHAT = 'chat',
  ASSIGNMENT = 'assignment',
  FORUM_POST = 'forum_post',
  USER_PROFILE = 'user_profile',
}

export interface ModerationResult {
  approved: boolean;
  flags: ModerationFlag[];
  score: ModerationScore;
  action: ModerationAction;
  reviewedBy: 'ai' | 'human';
  timestamp: Date;
}

export interface ModerationFlag {
  type: FlagType;
  severity: FlagSeverity;
  category: string;
  details: string;
  location?: TextLocation;
}

export enum FlagType {
  TOXICITY = 'toxicity',
  HATE_SPEECH = 'hate_speech',
  HARASSMENT = 'harassment',
  INAPPROPRIATE = 'inappropriate',
  VIOLENCE = 'violence',
  SELF_HARM = 'self_harm',
  SEXUAL = 'sexual',
  SPAM = 'spam',
  COPYRIGHT = 'copyright',
  PERSONAL_INFO = 'personal_info',
}

export enum FlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ModerationScore {
  toxicity: number;
  hateSpeech: number;
  harassment: number;
  inappropriate: number;
  violence: number;
  selfHarm: number;
  sexual: number;
  spam: number;
  overall: number;
}

export enum ModerationAction {
  ALLOW = 'allow',
  FLAG = 'flag',
  BLOCK = 'block',
  REVIEW = 'review',
}

export interface TextLocation {
  start: number;
  end: number;
  snippet: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  flags: FlagType[];
  action: ModerationAction;
  threshold: number;
  enabled: boolean;
}

export interface AgeAppropriatenessResult {
  appropriate: boolean;
  minimumAge: number;
  contentRating: 'G' | 'PG' | 'PG13' | 'R';
  concerns: string[];
}
