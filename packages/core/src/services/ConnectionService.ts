/**
 * Connection Service.
 *
 * T033: Orchestrates BLE scan → connect → identify → select engine →
 * subscribe to notifications → send RQ1 initial state → populate stores.
 * Auto-reconnect on disconnect (max 5 retries, 2s delay).
 *
 * Constitution II: Bidirectional Control Surface.
 * Constitution V: Services orchestrate engine + transport.
 */

import type {Transport, Unsubscribe} from '../transport/types';
import type {PianoEngine} from '../engine/IPianoEngine';
import type {PianoEvent} from '../types/types';
import {resolveEngine, getDefaultEngine} from '../engine/registry';
import {parseIdentityReply} from '../engine/fp30x/parser';
import {buildIdentityRequest} from '../engine/fp30x/sysex';
import type {PianoService} from './PianoService';
import {useConnectionStore} from '../store/connectionStore';

const MAX_RECONNECT_RETRIES = 5;
const RECONNECT_DELAY_MS = 2000;
const IDENTITY_TIMEOUT_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 3000;
const MAX_MISSED_BEATS = 2;

export class ConnectionService {
  private transport: Transport;
  private engine: PianoEngine | null = null;
  private notificationUnsub: Unsubscribe | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onNotification: ((event: PianoEvent) => void) | null = null;
  private pianoServiceRef: PianoService | null = null;
  private monitorIntervalId: ReturnType<typeof setInterval> | null = null;
  private pendingStateReads = 0;
  private stateReadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatReplyTimer: ReturnType<typeof setTimeout> | null = null;
  private missedBeats = 0;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Set PianoService reference (needed for default preset auto-apply). */
  setPianoService(service: PianoService): void {
    this.pianoServiceRef = service;
  }

  /** Set the callback for parsed notification events. */
  setNotificationHandler(handler: (event: PianoEvent) => void): void {
    this.onNotification = handler;
  }

  /** Get the currently selected engine (null until connected + identified). */
  getEngine(): PianoEngine | null {
    return this.engine;
  }

  /**
   * Scan for BLE MIDI devices.
   * Accumulates every discovered device into `connectionStore.discoveredDevices`.
   * When the scan finishes naturally, status settles to 'discovered' if anything
   * was found, otherwise 'idle'.
   */
  async scan(timeoutMs: number = 5000): Promise<void> {
    // setScanning also clears the previous list.
    useConnectionStore.getState().setScanning();

    try {
      await this.transport.scan(device => {
        useConnectionStore.getState().addDiscoveredDevice({
          id: device.id,
          name: device.name,
        });
      }, timeoutMs);
    } catch (error) {
      if (useConnectionStore.getState().status === 'scanning') {
        useConnectionStore.getState().setIdle();
      }
      throw error;
    }

    // Natural end-of-scan: pick the right resting state.
    if (useConnectionStore.getState().status === 'scanning') {
      const list = useConnectionStore.getState().discoveredDevices;
      if (list.length > 0) {
        // Back-compat: keep deviceId/deviceName tracking the first/representative device.
        useConnectionStore.getState().setDiscovered(list[0].id, list[0].name);
      } else {
        useConnectionStore.getState().setIdle();
      }
    }
  }

  /**
   * Populate `connectionStore.discoveredDevices` without entering 'scanning'.
   * Uses `transport.listDevices()` when available (e.g. Web MIDI on desktop).
   * Falls back to a normal `scan()` if not.
   */
  async refreshDiscoveredDevices(timeoutMs: number = 5000): Promise<void> {
    if (typeof this.transport.listDevices === 'function') {
      useConnectionStore.getState().clearDiscoveredDevices();
      const devices = await this.transport.listDevices();
      for (const d of devices) {
        useConnectionStore.getState().addDiscoveredDevice(d);
      }
      return;
    }
    await this.scan(timeoutMs);
  }

  /**
   * Connect to a specific device.
   * After connection: select engine, subscribe to notifications, read initial state.
   */
  async connect(deviceId: string): Promise<void> {
    const store = useConnectionStore.getState();

    // Carry the device identity into the store so the UI can render the name
    // during 'connecting' and 'connected'. The list is populated by the latest
    // scan / refreshDiscoveredDevices call.
    if (deviceId) {
      const found = store.discoveredDevices.find(d => d.id === deviceId);
      if (found) {
        store.setDiscovered(found.id, found.name);
      }
    }

    store.setConnecting();
    this.reconnectAttempts = 0;

    try {
      await this.transport.connect(deviceId);

      // After the transport completes connect(), it may know a better device
      // name than the store does (e.g. WebMIDITransport with an empty deviceId
      // arg, or BLE where the OS revealed the friendly name only after pairing).
      this.syncDeviceNameFromTransport();

      // Resolve engine via Identity Request → Identity Reply → resolveEngine()
      this.engine = await this.identifyAndResolveEngine();

      // T006 (A2): Hand engine to PianoService so it can build DT1 messages
      if (this.pianoServiceRef) {
        this.pianoServiceRef.setEngine(this.engine);
      }

      // Cold-boot DT1 unlock: the FP-30X silently ignores DT1 parameter writes
      // after a fresh power-on until this sequence is sent. See docs/cold-boot-dt1-unlock.md.
      // Engines that don't need any unlock return an empty array.
      await this.sendSessionUnlock();

      // Subscribe to BLE notifications
      this.notificationUnsub = this.transport.subscribe(rawMidiBytes => {
        this.handleRawNotification(rawMidiBytes);
      });

      store.setConnected();

      // Read initial state via RQ1
      await this.refreshPerformanceState();

      // T065 (was: auto-apply default preset) removed by 007-profiles-preset-pivot.
      // The "auto-apply on first connect" responsibility now belongs to
      // ProfileService.loadProfile / pendingProfileState replay (data-model R5),
      // which fires when an offline profile load is queued.
      // Mark first-connection-this-session so any external listener that still
      // gates on this flag clears as before.
      useConnectionStore.getState().markFirstConnectionHandled();

      // Heartbeat — must start AFTER readInitialState()
      // has drained so it doesn't race against the bulk RQ1 reads.
      this.startHeartbeat();

      // Setup disconnect monitoring for auto-reconnect
      this.setupAutoReconnect(deviceId);
    } catch (error) {
      store.setDisconnected();
      throw error;
    }
  }

  /**
   * Disconnect from the current device.
   */
  async disconnect(): Promise<void> {
    this.cancelReconnect();
    this.stopHeartbeat();
    this.clearMonitorInterval();
    this.cleanupNotifications();
    this.engine = null;

    try {
      await this.transport.disconnect();
    } catch {
      // Already disconnected
    }

    useConnectionStore.getState().setDisconnected();
  }

  /**
   * Auto-scan and connect to previously paired device.
   */
  async autoConnect(): Promise<void> {
    const {deviceId} = useConnectionStore.getState();
    if (!deviceId) return;

    try {
      await this.connect(deviceId);
    } catch {
      // Auto-connect failed silently — user can manually retry
    }
  }

  /** Clean up all resources. */
  async destroy(): Promise<void> {
    this.cancelReconnect();
    this.stopHeartbeat();
    this.clearMonitorInterval();
    this.cleanupNotifications();
    this.engine = null;
    await this.transport.destroy();
  }

  // ─── Private ────────────────────────────────────────────────

  /**
   * Copy the transport's known device name into the store. Used after a
   * successful connect so the UI can always render a real name — even on the
   * legacy `connect('')` path where the chooser/single-output flow picks a
   * device the store didn't know about.
   *
   * Falls back to whatever was already in the store if the transport doesn't
   * expose a name or returns null.
   */
  private syncDeviceNameFromTransport(): void {
    const transportName = this.transport.deviceName ?? null;
    if (!transportName) return;

    const store = useConnectionStore.getState();
    if (store.deviceName === transportName && store.deviceId) return;

    // Reuse setDiscovered to write both fields atomically. If we don't know an
    // id (legacy chooser path on Web MIDI), keep whatever the store had — or
    // fall back to the name as a stable handle.
    store.setDiscovered(store.deviceId ?? transportName, transportName);
  }

  /**
   * Send Identity Request, wait for Identity Reply, resolve the correct engine.
   * Falls back to default engine if no reply within timeout or no engine matches.
   */
  private async identifyAndResolveEngine(): Promise<PianoEngine> {
    return new Promise<PianoEngine>(resolve => {
      const timeout = setTimeout(() => {
        unsub();
        resolve(getDefaultEngine());
      }, IDENTITY_TIMEOUT_MS);

      const unsub = this.transport.subscribe(rawMidiBytes => {
        const identity = parseIdentityReply(rawMidiBytes);
        if (!identity) return; // Not an identity reply — ignore

        clearTimeout(timeout);
        unsub();

        const engine = resolveEngine(identity);
        resolve(engine ?? getDefaultEngine());
      });

      // Send the identity request
      this.transport.send(buildIdentityRequest()).catch(() => {
        // Send failed — fall back to default engine
        clearTimeout(timeout);
        unsub();
        resolve(getDefaultEngine());
      });
    });
  }

  private handleRawNotification(rawMidiBytes: number[]): void {
    if (!this.engine) return;

    // Heartbeat reply: refresh seen-clock, clear pending timeout, restore
    // 'connected' if we were stale. Do NOT forward — it's plumbing. Runs
    // even if no notification handler has been set (heartbeat must work
    // independently of consumer handlers).
    if (this.engine.isAliveReply(rawMidiBytes)) {
      this.onHeartbeatReply();
      return;
    }

    if (!this.onNotification) return;

    // Any other inbound notification also counts as liveness evidence.
    useConnectionStore.getState().markSeen();
    if (useConnectionStore.getState().status === 'stale') {
      useConnectionStore.getState().setConnected();
    }

    // T010 (A3): Route RQ1 responses through parseStateResponse for bulk decomposition
    if (this.pendingStateReads > 0) {
      const events = this.engine.parseStateResponse(rawMidiBytes);
      if (events.length > 0) {
        for (const event of events) {
          this.onNotification(event);
        }
        this.pendingStateReads--;
        return;
      }
      // If parseStateResponse returns empty, fall through to normal parsing
    }

    const event = this.engine.parseNotification(rawMidiBytes);
    if (event) {
      this.onNotification(event);
    }
  }

  private async sendSessionUnlock(): Promise<void> {
    if (!this.engine) return;

    const messages = this.engine.buildSessionUnlock();
    for (const msg of messages) {
      try {
        await this.transport.send(msg);
      } catch {
        // Non-fatal: if the unlock write fails the user will see DT1 writes
        // ignored, which is no worse than the pre-fix behaviour.
      }
    }
  }

  /**
   * Fire the engine's full RQ1 sweep and let `parseStateResponse` →
   * `onNotification` repopulate `performanceStore`.
   *
   * Used at connect time to load the initial state, and after a preset apply
   * to confirm what actually landed on the piano (Constitution II — hardware
   * state wins). Safe to call multiple times; concurrent calls are tolerated
   * because `pendingStateReads` is reset to the latest request count.
   */
  async refreshPerformanceState(): Promise<void> {
    if (!this.engine) return;

    // Clear any pending safety timer from a prior sweep so it doesn't zero
    // out `pendingStateReads` while this sweep's responses are arriving.
    if (this.stateReadTimeoutId) {
      clearTimeout(this.stateReadTimeoutId);
      this.stateReadTimeoutId = null;
    }

    const requests = this.engine.buildInitialStateRequest();

    // T010 (A3): Track expected RQ1 responses by count
    this.pendingStateReads = requests.length;

    for (const req of requests) {
      try {
        await this.transport.send(req);
        // Small delay between RQ1 requests to allow piano to respond
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      } catch {
        // Non-fatal: piano may not respond to all RQ1s immediately
      }
    }

    // Safety: clear counter after a timeout in case responses never arrive
    this.stateReadTimeoutId = setTimeout(() => {
      this.pendingStateReads = 0;
      this.stateReadTimeoutId = null;
    }, 2000);
  }

  private setupAutoReconnect(deviceId: string): void {
    // T007 (A13): Clear any existing monitor before creating a new one
    this.clearMonitorInterval();

    // Monitor transport status changes
    this.monitorIntervalId = setInterval(() => {
      if (
        this.transport.status === 'disconnected' &&
        this.reconnectAttempts < MAX_RECONNECT_RETRIES
      ) {
        this.clearMonitorInterval();
        useConnectionStore.getState().setDisconnected();
        this.attemptReconnect(deviceId);
      }
    }, 1000);
  }

  private attemptReconnect(deviceId: string): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_RETRIES) {
      useConnectionStore.getState().reset();
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(deviceId);
      } catch {
        this.attemptReconnect(deviceId);
      }
    }, RECONNECT_DELAY_MS);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  private clearMonitorInterval(): void {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
    }
  }

  private cleanupNotifications(): void {
    if (this.notificationUnsub) {
      this.notificationUnsub();
      this.notificationUnsub = null;
    }
    if (this.stateReadTimeoutId) {
      clearTimeout(this.stateReadTimeoutId);
      this.stateReadTimeoutId = null;
    }
    this.pendingStateReads = 0;
  }

  // ─── Heartbeat ──────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.missedBeats = 0;
    this.heartbeatIntervalId = setInterval(() => {
      this.heartbeatTick();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.heartbeatReplyTimer) {
      clearTimeout(this.heartbeatReplyTimer);
      this.heartbeatReplyTimer = null;
    }
    this.missedBeats = 0;
  }

  private heartbeatTick(): void {
    if (!this.engine) return;

    // Passive suppression — recent traffic counts as liveness.
    const lastSeenAt = useConnectionStore.getState().lastSeenAt;
    if (lastSeenAt !== null && Date.now() - lastSeenAt < HEARTBEAT_INTERVAL_MS) {
      return;
    }

    const msg = this.engine.buildAliveCheck();
    if (msg.length === 0) return; // Engine doesn't support heartbeat.

    if (this.heartbeatReplyTimer) clearTimeout(this.heartbeatReplyTimer);
    this.heartbeatReplyTimer = setTimeout(
      () => this.onHeartbeatTimeout(),
      HEARTBEAT_TIMEOUT_MS,
    );

    // Don't double-count: if send() rejects, the reply timer (armed above) will still
    // fire at HEARTBEAT_TIMEOUT_MS and record the miss exactly once. A catch handler
    // that also calls onHeartbeatTimeout() can fire either before or after the timer
    // and corrupt the miss count.
    this.transport.send(msg).catch(() => undefined);
  }

  private onHeartbeatReply(): void {
    if (this.heartbeatReplyTimer) {
      clearTimeout(this.heartbeatReplyTimer);
      this.heartbeatReplyTimer = null;
    }
    this.missedBeats = 0;
    useConnectionStore.getState().markSeen();
    if (useConnectionStore.getState().status === 'stale') {
      useConnectionStore.getState().setConnected();
    }
  }

  private onHeartbeatTimeout(): void {
    this.heartbeatReplyTimer = null;
    this.missedBeats++;
    if (this.missedBeats >= MAX_MISSED_BEATS) {
      useConnectionStore.getState().setStale();
    }
  }
}
