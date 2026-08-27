import {canRelease, messageKey} from '../../helpers/controlMessage';
import type {ControlMessage, Edge} from '../../types/control';

export const EDGE_THRESHOLD = 64;
export const DEFAULT_DEBOUNCE_MS = 150;
export const MAX_TRACKED_CONTROLS = 512;

export function detectEdge(
  previousValue: number | null,
  message: ControlMessage,
): Edge | null {
  if (!canRelease(message)) return 'press';

  const wasHigh = previousValue !== null && previousValue >= EDGE_THRESHOLD;
  const isHigh = message.value >= EDGE_THRESHOLD;

  if (isHigh && !wasHigh) return 'press';
  if (!isHigh && wasHigh) return 'release';
  return null;
}

export interface EdgeGateOptions {
  debounceMs?: number;
  now?: () => number;
}

export class EdgeGate {
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly lastValue = new Map<string, number>();
  private readonly lastFire = new Map<string, number>();

  constructor(options: EdgeGateOptions = {}) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.now = options.now ?? (() => Date.now());
  }

  admit(message: ControlMessage): Edge | null {
    const key = messageKey(message);
    const edge = detectEdge(this.lastValue.get(key) ?? null, message);
    if (!edge) return null;

    const gateKey = `${key}:${edge}`;
    const at = this.now();
    const previous = this.lastFire.get(gateKey);
    if (previous !== undefined && at - previous < this.debounceMs) return null;

    if (canRelease(message)) this.lastValue.set(key, message.value);
    this.rememberFire(gateKey, at);
    return edge;
  }

  private rememberFire(gateKey: string, at: number): void {
    this.lastFire.set(gateKey, at);
    if (this.lastFire.size <= MAX_TRACKED_CONTROLS) return;
    const oldest = this.lastFire.keys().next().value;
    if (oldest !== undefined) this.lastFire.delete(oldest);
  }

  reset(): void {
    this.lastValue.clear();
    this.lastFire.clear();
  }
}
