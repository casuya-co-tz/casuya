import { Logger } from '../utilities/logger';

export interface BridgeMessage {
  type: string;
  payload: unknown;
  source: string;
  target: string;
  id: string;
  timestamp: Date;
}

export interface BridgeConnectionConfig {
  url: string;
  apiKey?: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
}

export class BridgeAdapter {
  private logger: Logger;
  private connected: boolean;
  private messageQueue: BridgeMessage[];
  private listeners: Map<string, Array<(message: BridgeMessage) => void>>;

  constructor(
    _config: BridgeConnectionConfig,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger({ prefix: '[BridgeAdapter]' });
    this.connected = false;
    this.messageQueue = [];
    this.listeners = new Map();
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.logger.info('Bridge connection established');
    this.processQueue();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('Bridge connection closed');
  }

  async send(message: Omit<BridgeMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: BridgeMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    if (!this.connected) {
      this.messageQueue.push(fullMessage);
      return;
    }

    try {
      this.logger.debug(`Message sent: ${fullMessage.type}`);
    } catch (error) {
      this.logger.error('Failed to send bridge message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  on(eventType: string, listener: (message: BridgeMessage) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  private async processQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      await this.send(message);
    }
  }
}
