import { Logger } from '../utilities/logger';

export interface AnalyticsEvent {
  type: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  studentId?: string;
  sessionId?: string;
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueStudents: number;
  topEventTypes: Array<{ type: string; count: number }>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class AnalyticsCollector {
  private events: AnalyticsEvent[];
  private logger: Logger;
  private flushInterval: ReturnType<typeof setInterval> | null;

  constructor(
    private flushHandler?: (events: AnalyticsEvent[]) => Promise<void>,
    logger?: Logger,
  ) {
    this.events = [];
    this.logger = logger ?? new Logger({ prefix: '[AnalyticsCollector]' });
    this.flushInterval = null;
    this.startAutoFlush();
  }

  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    this.events.push({
      ...event,
      timestamp: new Date(),
    });

    if (this.events.length >= 100) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const batch = [...this.events];
    this.events = [];

    if (this.flushHandler) {
      try {
        await this.flushHandler(batch);
        this.logger.info(`Flushed ${batch.length} analytics events`);
      } catch (error) {
        this.events.push(...batch);
        this.logger.error('Failed to flush analytics events', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  getSummary(): AnalyticsSummary {
    const types = new Map<string, number>();
    const students = new Set<string>();

    for (const event of this.events) {
      types.set(event.type, (types.get(event.type) ?? 0) + 1);
      if (event.studentId) students.add(event.studentId);
    }

    const sortedTypes = [...types.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    const times = this.events.map((e) => e.timestamp);

    return {
      totalEvents: this.events.length,
      uniqueStudents: students.size,
      topEventTypes: sortedTypes,
      timeRange: {
        start: times.length > 0 ? new Date(Math.min(...times.map((t) => t.getTime()))) : new Date(),
        end: times.length > 0 ? new Date(Math.max(...times.map((t) => t.getTime()))) : new Date(),
      },
    };
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 60000);

    if (this.flushInterval && typeof this.flushInterval === 'object') {
      this.flushInterval.unref();
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}
