import {
  canRelease,
  matchesMessage,
  parseControlMessage,
  toMatch,
} from '../../helpers/controlMessage';
import {detectEdge, EdgeGate} from './EdgeGate';
import {useControlBindingsStore} from '../../store/controlBindingsStore';
import {useControlSurfaceStore} from '../../store/controlSurfaceStore';
import type {ControlActionRegistry} from './registry';
import type {
  DiscoveredDevice,
  InputTransport,
  TransportStatus,
  Unsubscribe,
} from '../../transport/types';
import type {
  Behaviour,
  ControlBinding,
  ControlDevice,
  ControlMessage,
  Edge,
  PeekHandle,
} from '../../types/control';

const DEFAULT_LEARN_TIMEOUT_MS = 10_000;
const DEFAULT_RELEASE_WINDOW_MS = 2_000;
const ALL_BEHAVIOURS: Behaviour[] = ['press', 'release', 'peek'];
const PRESS_ONLY: Behaviour[] = ['press'];

export interface ControlSurfaceServiceOptions {
  debounceMs?: number;
  learnTimeoutMs?: number;
  releaseWindowMs?: number;
  now?: () => number;
}

export class ControlSurfaceService {
  private readonly transport: InputTransport;
  private readonly registry: ControlActionRegistry;
  private readonly gate: EdgeGate;
  private readonly now: () => number;
  private readonly learnTimeoutMs: number;
  private readonly releaseWindowMs: number;
  private learnTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  private unsubscribeBytes: Unsubscribe | null = null;
  private unsubscribeStatus: Unsubscribe | null = null;

  private heldBindingId: string | null = null;
  private peekHandle: PeekHandle | null = null;
  private inFlight: Promise<void> = Promise.resolve();

  constructor(
    transport: InputTransport,
    registry: ControlActionRegistry,
    options: ControlSurfaceServiceOptions = {},
  ) {
    this.transport = transport;
    this.registry = registry;
    this.now = options.now ?? (() => Date.now());
    this.gate = new EdgeGate({debounceMs: options.debounceMs, now: this.now});
    this.learnTimeoutMs = options.learnTimeoutMs ?? DEFAULT_LEARN_TIMEOUT_MS;
    this.releaseWindowMs = options.releaseWindowMs ?? DEFAULT_RELEASE_WINDOW_MS;

    this.unsubscribeBytes = transport.subscribe(bytes => this.onBytes(bytes));
    this.unsubscribeStatus = transport.onStatusChange(status =>
      this.onStatus(status),
    );
  }

  listDevices(): Promise<DiscoveredDevice[]> {
    return this.transport.listDevices();
  }

  async attach(device: ControlDevice): Promise<void> {
    useControlBindingsStore.getState().setDevice(device);
    await this.transport.connect(device.id, device.name);
    this.syncAttached();
  }

  async restore(): Promise<void> {
    const device = useControlBindingsStore.getState().device;
    if (!device) return;
    try {
      await this.transport.connect(device.id, device.name);
    } catch {
      return;
    }
    this.syncAttached();
  }

  async detach(): Promise<void> {
    this.enqueue(() => this.clearHeld());
    await this.whenIdle();
    await this.transport.disconnect();
    useControlBindingsStore.getState().setDevice(null);
    this.syncAttached();
  }

  whenIdle(): Promise<void> {
    return this.inFlight;
  }

  async destroy(): Promise<void> {
    this.clearLearnTimers();
    this.enqueue(() => this.clearHeld());
    await this.whenIdle();
    this.unsubscribeBytes?.();
    this.unsubscribeStatus?.();
    this.unsubscribeBytes = null;
    this.unsubscribeStatus = null;
    await this.transport.destroy();
  }

  startLearn(actionId: string): void {
    this.clearLearnTimers();
    this.gate.reset();
    this.enqueue(() => this.clearHeld());
    useControlSurfaceStore.getState().startLearn(actionId);
    this.learnTimer = setTimeout(() => {
      this.learnTimer = null;
      useControlSurfaceStore.getState().setLearnTimeout();
    }, this.learnTimeoutMs);
  }

  cancelLearn(): void {
    this.clearLearnTimers();
    this.gate.reset();
    useControlSurfaceStore.getState().endLearn();
  }

  acceptConflict(): void {
    const {learn} = useControlSurfaceStore.getState();
    if (learn.phase !== 'conflict') return;
    useControlSurfaceStore.getState().setLearnConfirming(learn.behaviours);
  }

  confirmLearn(behaviour: Behaviour): void {
    const {learn} = useControlSurfaceStore.getState();
    if (learn.phase !== 'confirming') return;
    if (!learn.actionId || !learn.captured) return;
    if (!learn.behaviours.includes(behaviour)) return;

    useControlBindingsStore.getState().addBinding({
      match: toMatch(learn.captured),
      actionId: learn.actionId,
      behaviour,
    });

    this.clearLearnTimers();
    this.gate.reset();
    useControlSurfaceStore.getState().endLearn();
  }

  private enqueue(work: () => Promise<void>): void {
    this.inFlight = this.inFlight.then(work).catch(() => undefined);
  }

  private syncAttached(): void {
    useControlSurfaceStore
      .getState()
      .setAttached(
        this.transport.status === 'connected',
        this.transport.deviceName ?? null,
      );
  }

  private onStatus(status: TransportStatus): void {
    this.syncAttached();
    if (status === 'connected') return;
    this.gate.reset();
    this.enqueue(() => this.clearHeld());
  }

  private onBytes(bytes: number[]): void {
    const message = parseControlMessage(bytes);
    if (!message) return;

    useControlSurfaceStore.getState().noteMessage(message, this.now());

    const phase = useControlSurfaceStore.getState().learn.phase;
    if (phase === 'armed' || phase === 'detecting') {
      this.onLearnMessage(message);
      return;
    }

    const edge = this.gate.admit(message);
    if (!edge) return;

    this.enqueue(() => this.dispatch(message, edge));
  }

  private async dispatch(message: ControlMessage, edge: Edge): Promise<void> {
    const binding = useControlBindingsStore.getState().findByMessage(message);
    if (!binding) return;
    if (edge === 'press') await this.onPress(binding);
    else await this.onRelease(binding);
  }

  private async onPress(binding: ControlBinding): Promise<void> {
    if (this.heldBindingId !== null) return;

    const action = this.registry.get(binding.actionId);
    if (!action) return;

    if (binding.behaviour === 'press') {
      await this.safely(() => action.run());
      return;
    }

    if (!canRelease(binding.match)) {
      await this.safely(() => action.run());
      return;
    }

    this.heldBindingId = binding.id;
    useControlSurfaceStore.getState().setHeld({
      actionId: binding.actionId,
      behaviour: binding.behaviour,
    });

    if (binding.behaviour !== 'peek') return;

    if (!action.beginPeek) {
      this.forgetHeld();
      return;
    }

    let handle: PeekHandle | null = null;
    try {
      handle = await action.beginPeek();
    } catch {
      handle = null;
    }

    if (this.heldBindingId !== binding.id) {
      if (handle) await this.safely(() => handle!.end());
      return;
    }

    if (handle === null) {
      this.forgetHeld();
      return;
    }

    this.peekHandle = handle;
  }

  private async onRelease(binding: ControlBinding): Promise<void> {
    if (this.heldBindingId !== binding.id) return;

    const action = this.registry.get(binding.actionId);
    const handle = this.peekHandle;
    this.forgetHeld();

    if (binding.behaviour === 'release') {
      if (action) await this.safely(() => action.run());
      return;
    }

    if (handle) await this.safely(() => handle.end());
  }

  private forgetHeld(): void {
    this.heldBindingId = null;
    this.peekHandle = null;
    useControlSurfaceStore.getState().setHeld(null);
  }

  private async clearHeld(): Promise<void> {
    const handle = this.peekHandle;
    this.forgetHeld();
    if (handle) await this.safely(() => handle.end());
  }

  private onLearnMessage(message: ControlMessage): void {
    const store = useControlSurfaceStore.getState();
    const {learn} = store;

    if (learn.phase === 'armed') {
      this.clearLearnTimers();
      store.setLearnDetecting(message);
      if (!canRelease(message)) {
        this.finishDetection(PRESS_ONLY);
        return;
      }
      this.releaseTimer = setTimeout(() => {
        this.releaseTimer = null;
        this.finishDetection(PRESS_ONLY);
      }, this.releaseWindowMs);
      return;
    }

    const captured = learn.captured;
    if (!captured) return;
    if (!matchesMessage(captured, message)) return;
    if (detectEdge(captured.value, message) !== 'release') return;
    this.finishDetection(ALL_BEHAVIOURS);
  }

  private finishDetection(capable: Behaviour[]): void {
    this.clearLearnTimers();
    const store = useControlSurfaceStore.getState();
    const {actionId, captured} = store.learn;
    if (!actionId || !captured) {
      store.endLearn();
      return;
    }

    const action = this.registry.get(actionId);
    const offered = action
      ? capable.filter(behaviour => action.behaviours.includes(behaviour))
      : [];

    if (offered.length === 0) {
      store.endLearn();
      return;
    }

    const existing = useControlBindingsStore.getState().findByMessage(captured);
    if (existing) {
      store.setLearnConflict(existing.actionId, offered);
      return;
    }

    store.setLearnConfirming(offered);
  }

  private clearLearnTimers(): void {
    if (this.learnTimer) {
      clearTimeout(this.learnTimer);
      this.learnTimer = null;
    }
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  private async safely(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch {
      return;
    }
  }
}
