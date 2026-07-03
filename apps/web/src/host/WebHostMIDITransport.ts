/**
 * Web-host MIDI transport wrapper (Task 6.1 wiring + 6.3 permission/error UX).
 *
 * The web target uses the shared `@pianel/ui/transport/WebMIDITransport`
 * verbatim — it already drives the browser's MIDI-SysEx permission prompt by
 * calling `navigator.requestMIDIAccess({ sysex: true })` inside `connect`,
 * enumerates outputs (single-output fast path or the multi-device chooser),
 * matches the input port, and observes `statechange` for port-disappearance.
 * No transport behavior is changed here.
 *
 * This thin wrapper exists purely so the *web host* can translate connect-time
 * failures into browser-appropriate, actionable copy before they reach the
 * shared (and unmodified) `useConnection` reporter:
 *
 *   - Granted prompt  → `connect` resolves and wiring proceeds exactly as desktop.
 *   - Denied/blocked  → reject with the "re-enable MIDI in browser settings"
 *                       message (no crash; the shell shows it via the alert UI).
 *   - No device       → reject with the OS-agnostic "connect via USB / pair via
 *                       OS Bluetooth, then retry" message.
 *
 * Every other `Transport` method is forwarded unchanged.
 */
import type {
  Transport,
  TransportStatus,
  NotificationListener,
  Unsubscribe,
  DiscoveredDevice,
} from '@pianel/core/transport/types';
import { mapWebConnectError } from './connectionErrors';

export class WebHostMIDITransport implements Transport {
  constructor(private readonly inner: Transport) {}

  get status(): TransportStatus {
    return this.inner.status;
  }

  get deviceName(): string | null {
    return this.inner.deviceName ?? null;
  }

  async connect(deviceId: string): Promise<void> {
    try {
      // Delegating to the reused transport drives `requestMIDIAccess` — i.e.
      // the browser's MIDI-SysEx permission prompt on first connect. We only
      // proceed (resolve) once the underlying connect resolves, i.e. after the
      // user grants the prompt.
      await this.inner.connect(deviceId);
    } catch (err) {
      const mapped = mapWebConnectError(err);
      if (mapped) {
        // Normalize into actionable web-host copy. The reused desktop reporter
        // surfaces the Error's message verbatim, so this is what the user sees.
        // Never crashes — it rejects with a handled, actionable error.
        const normalized = new Error(mapped.message);
        (normalized as Error & { cause?: unknown }).cause = err;
        throw normalized;
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    return this.inner.disconnect();
  }

  async send(rawMidiBytes: number[]): Promise<void> {
    return this.inner.send(rawMidiBytes);
  }

  async scan(
    onDiscovered: (device: DiscoveredDevice) => void,
    timeoutMs?: number,
  ): Promise<void> {
    return this.inner.scan(onDiscovered, timeoutMs);
  }

  async stopScan(): Promise<void> {
    return this.inner.stopScan();
  }

  async listDevices(): Promise<DiscoveredDevice[]> {
    return this.inner.listDevices ? this.inner.listDevices() : [];
  }

  subscribe(listener: NotificationListener): Unsubscribe {
    return this.inner.subscribe(listener);
  }

  async destroy(): Promise<void> {
    return this.inner.destroy();
  }
}
