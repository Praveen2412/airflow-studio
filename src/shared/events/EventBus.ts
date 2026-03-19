type EventCallback = (...args: any[]) => void;

export class EventBus {
  private static instance: EventBus;
  private events: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args));
    }
  }

  clear(): void {
    this.events.clear();
  }
}

// Event names
export const Events = {
  DAG_TRIGGERED: 'dag:triggered',
  DAG_PAUSED: 'dag:paused',
  DAG_UNPAUSED: 'dag:unpaused',
  DAG_RUN_CANCELLED: 'dag:run:cancelled',
  DAG_STATE_CHANGED: 'dag:state:changed',
  SERVER_CONNECTED: 'server:connected',
  SERVER_DISCONNECTED: 'server:disconnected',
} as const;
