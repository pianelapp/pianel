import type {ControlAction} from '../../types/control';

export class ControlActionRegistry {
  private readonly actions = new Map<string, ControlAction>();
  private readonly listeners = new Set<() => void>();
  private cached: readonly ControlAction[] = [];

  register(action: ControlAction): () => void {
    this.actions.set(action.id, action);
    this.invalidate();
    return () => {
      if (this.actions.get(action.id) !== action) return;
      this.actions.delete(action.id);
      this.invalidate();
    };
  }

  get(actionId: string): ControlAction | null {
    return this.actions.get(actionId) ?? null;
  }

  snapshot(): readonly ControlAction[] {
    return this.cached;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.actions.clear();
    this.invalidate();
  }

  private invalidate(): void {
    this.cached = [...this.actions.values()];
    for (const listener of [...this.listeners]) listener();
  }
}

let instance: ControlActionRegistry | null = null;

export function getControlActionRegistry(): ControlActionRegistry {
  if (!instance) instance = new ControlActionRegistry();
  return instance;
}

export function resetControlActionRegistry(): void {
  instance = null;
}
