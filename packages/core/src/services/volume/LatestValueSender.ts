export interface LatestValueSenderOptions {
  intervalMs: number;
  send: (value: number) => Promise<void>;
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => () => void;
  onDelivered: (value: number) => void;
  onFailed: (value: number, error: unknown) => void;
}

export type SendOutcome =
  | {status: 'delivered'; value: number}
  | {status: 'failed'; value: number}
  | {status: 'unchanged'; value: number};

interface PendingRequest {
  value: number;
  force: boolean;
}

export class LatestValueSender {
  private readonly options: LatestValueSenderOptions;
  private pending: PendingRequest | null = null;
  private inFlight = false;
  private cancelTimer: (() => void) | null = null;
  private lastDelivered: number | null = null;
  private lastStartAt: number | null = null;
  private outcome: SendOutcome | null = null;
  private waiters: Array<(outcome: SendOutcome | null) => void> = [];

  constructor(options: LatestValueSenderOptions) {
    this.options = options;
  }

  request(value: number, options: {force?: boolean} = {}): void {
    if (this.isIdle()) this.outcome = null;
    const force = options.force === true || this.pending?.force === true;
    this.pending = {value, force};
    this.pump();
  }

  settled(): Promise<SendOutcome | null> {
    if (this.isIdle()) return Promise.resolve(this.outcome);
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  resetDelivered(): void {
    this.lastDelivered = null;
  }

  cancel(): void {
    this.pending = null;
    this.disarmTimer();
    this.notifyIfIdle();
  }

  private isIdle(): boolean {
    return !this.inFlight && this.pending === null && this.cancelTimer === null;
  }

  private pump(): void {
    if (this.inFlight || this.cancelTimer !== null) return;

    const next = this.pending;
    if (next === null) {
      this.notifyIfIdle();
      return;
    }

    if (!next.force && next.value === this.lastDelivered) {
      this.pending = null;
      this.outcome = {status: 'unchanged', value: next.value};
      this.notifyIfIdle();
      return;
    }

    const waitMs =
      this.lastStartAt === null
        ? 0
        : this.lastStartAt + this.options.intervalMs - this.options.now();
    if (waitMs > 0) {
      this.cancelTimer = this.options.setTimer(() => {
        this.cancelTimer = null;
        this.pump();
      }, waitMs);
      return;
    }

    this.start(next.value);
  }

  private start(value: number): void {
    this.pending = null;
    this.inFlight = true;
    this.lastStartAt = this.options.now();

    let sending: Promise<void>;
    try {
      sending = Promise.resolve(this.options.send(value));
    } catch (error) {
      sending = Promise.reject(error);
    }

    sending
      .then(
        () => {
          this.lastDelivered = value;
          this.outcome = {status: 'delivered', value};
          this.safely(() => this.options.onDelivered(value));
        },
        (error: unknown) => {
          this.lastDelivered = null;
          this.outcome = {status: 'failed', value};
          this.safely(() => this.options.onFailed(value, error));
        },
      )
      .then(() => {
        this.inFlight = false;
        this.pump();
      });
  }

  private disarmTimer(): void {
    if (this.cancelTimer === null) return;
    const cancel = this.cancelTimer;
    this.cancelTimer = null;
    cancel();
  }

  private notifyIfIdle(): void {
    if (!this.isIdle() || this.waiters.length === 0) return;
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve(this.outcome);
  }

  private safely(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      console.debug('LatestValueSender callback failed', error);
    }
  }
}
