export class CooldownLedger {
  private readonly readyAtMs = new Map<string, number>();

  isReady(id: string, nowMs: number): boolean {
    return nowMs >= (this.readyAtMs.get(id) ?? 0);
  }

  mark(id: string, nowMs: number, cooldownMs: number): void {
    const nextReadyAt = nowMs + Math.max(0, cooldownMs);
    const currentReadyAt = this.readyAtMs.get(id) ?? 0;
    this.readyAtMs.set(id, Math.max(currentReadyAt, nextReadyAt));
  }
}
