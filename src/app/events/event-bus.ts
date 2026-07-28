type EventHandler<T> = (payload: T) => void;

export class EventBus<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<EventHandler<never>>>();

  on<TKey extends keyof TEvents>(
    event: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): () => void {
    let eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set();
      this.handlers.set(event, eventHandlers);
    }
    eventHandlers.add(handler as EventHandler<never>);
    return () => this.off(event, handler);
  }

  off<TKey extends keyof TEvents>(
    event: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>);
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      try {
        (handler as EventHandler<TEvents[TKey]>)(payload);
      } catch {
        // Event consumers are isolated from one another.
      }
    }
  }
}
