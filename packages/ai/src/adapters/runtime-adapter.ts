import { Logger } from '../utilities/logger';

export interface RuntimeContext {
  lessonId?: string;
  studentId?: string;
  sessionId?: string;
  config?: Record<string, unknown>;
}

export interface RuntimeEvent {
  type: string;
  payload: unknown;
  source: string;
  timestamp: Date;
}

export class RuntimeAdapter {
  private logger: Logger;
  private handlers: Map<string, Array<(event: RuntimeEvent) => Promise<void>>>;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger({ prefix: '[RuntimeAdapter]' });
    this.handlers = new Map();
  }

  on(eventType: string, handler: (event: RuntimeEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    this.logger.debug(`Handler registered for event: ${eventType}`);
  }

  async emit(event: RuntimeEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(
      handlers.map((handler) =>
        handler(event).catch((error) => {
          this.logger.error(`Handler failed for event ${event.type}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      ),
    );
  }

  removeAllHandlers(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}
