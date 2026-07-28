export interface SwitchableRuntimeSession {
  runtime: {
    start(): void;
    stop(): void;
  };
  dispose(): void;
}

export class RuntimeSessionSwitcher<
  Session extends SwitchableRuntimeSession,
> {
  constructor(public current: Session) {}

  async replace(create: () => Promise<Session>): Promise<Session> {
    const previous = this.current;
    previous.runtime.stop();
    let replacement: Session;
    try {
      replacement = await create();
    } catch (error) {
      previous.runtime.start();
      throw error;
    }
    previous.dispose();
    this.current = replacement;
    replacement.runtime.start();
    return replacement;
  }
}
