import { Severity } from '../types';

export interface LoggerConfig {
  level: Severity;
  prefix?: string;
  output?: 'console' | 'file' | 'both';
  filePath?: string;
}

const LOG_LEVELS: Record<Severity, number> = {
  [Severity.DEBUG]: 0,
  [Severity.INFO]: 1,
  [Severity.WARN]: 2,
  [Severity.ERROR]: 3,
  [Severity.FATAL]: 4,
};

export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: config?.level ?? Severity.INFO,
      prefix: config?.prefix ?? '[CasuyaAI]',
      output: config?.output ?? 'console',
    };
  }

  private shouldLog(level: Severity): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: Severity, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${this.config.prefix} [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(Severity.DEBUG)) {
      console.debug(this.formatMessage(Severity.DEBUG, message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(Severity.INFO)) {
      console.info(this.formatMessage(Severity.INFO, message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(Severity.WARN)) {
      console.warn(this.formatMessage(Severity.WARN, message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(Severity.ERROR)) {
      console.error(this.formatMessage(Severity.ERROR, message, meta));
    }
  }

  fatal(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(Severity.FATAL)) {
      console.error(this.formatMessage(Severity.FATAL, message, meta));
    }
  }

  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix}:${prefix}`,
    });
  }
}

export const defaultLogger = new Logger();
