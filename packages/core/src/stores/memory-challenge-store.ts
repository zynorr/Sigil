export interface ChallengeRecord {
  readonly nonce: string;
  readonly contextId: string;
  readonly expiresAt: number;
  readonly requestId: string;
}

export interface ChallengeStore {
  issue(record: ChallengeRecord): void;
  consume(input: {
    nonce: string;
    contextId: string;
    now: number;
    requestId: string | undefined;
  }): boolean;
}

/** Single-process POC store. Synchronous consume is atomic within one JS isolate only. */
export class MemoryChallengeStore implements ChallengeStore {
  static readonly MAX_PENDING_CHALLENGES = 10_000;
  private readonly challenges = new Map<string, ChallengeRecord>();

  issue(record: ChallengeRecord): void {
    if (this.challenges.has(record.nonce)) throw new Error("nonce collision");
    if (this.challenges.size >= MemoryChallengeStore.MAX_PENDING_CHALLENGES)
      throw new Error("challenge store capacity reached");
    this.challenges.set(record.nonce, record);
  }

  consume(input: {
    nonce: string;
    contextId: string;
    now: number;
    requestId: string | undefined;
  }): boolean {
    const record = this.challenges.get(input.nonce);
    if (
      !record ||
      record.contextId !== input.contextId ||
      record.requestId !== input.requestId ||
      record.expiresAt <= input.now
    )
      return false;
    this.challenges.delete(input.nonce);
    return true;
  }

  /** Used only for deterministic tests and opportunistic expiry cleanup. */
  prune(now: number): void {
    for (const [nonce, record] of this.challenges)
      if (record.expiresAt <= now) this.challenges.delete(nonce);
  }
}
