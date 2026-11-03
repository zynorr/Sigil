export interface SessionRecord {
  readonly address: string;
  readonly network: "mainnet" | "testnet";
  readonly expiresAt: number;
}

export class MemorySessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(token: string, record: SessionRecord): void {
    this.sessions.set(token, record);
  }

  get(token: string, now: number): SessionRecord | null {
    const record = this.sessions.get(token);
    if (!record) return null;
    if (record.expiresAt <= now) {
      this.sessions.delete(token);
      return null;
    }
    return record;
  }

  revoke(token: string): void {
    this.sessions.delete(token);
  }
}
