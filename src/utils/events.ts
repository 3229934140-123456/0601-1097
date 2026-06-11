import EventEmitter from 'eventemitter3';

export class BaseEventEmitter<TEvents extends Record<string, any>> {
  private emitter = new EventEmitter();

  on<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (payload: TEvents[TEvent]) => void
  ): () => void {
    this.emitter.on(event as string, listener);
    return () => this.emitter.off(event as string, listener);
  }

  off<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (payload: TEvents[TEvent]) => void
  ): void {
    this.emitter.off(event as string, listener);
  }

  emit<TEvent extends keyof TEvents>(
    event: TEvent,
    payload: TEvents[TEvent]
  ): void {
    this.emitter.emit(event as string, payload);
  }

  once<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (payload: TEvents[TEvent]) => void
  ): void {
    this.emitter.once(event as string, listener);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
