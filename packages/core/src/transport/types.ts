/**
 * Transport Interface Contract
 *
 * Defines the contract for communication between the app and the piano.
 * The transport is model-agnostic — it sends and receives raw bytes
 * without understanding their meaning.
 *
 * Constitution Principle V: Layered Architecture with Engine Abstraction.
 * Transport handles communication; Engine handles protocol.
 */

// ─── Types ────────────────────────────────────────────────────

export interface DiscoveredDevice {
  /** Platform-assigned BLE peripheral ID */
  id: string;
  /** Advertised device name (e.g. "FP-30X MIDI") */
  name: string;
  /** Signal strength (RSSI) */
  rssi?: number;
}

export type TransportStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected';

/** Callback for incoming data from the piano */
export type NotificationListener = (rawMidiBytes: number[]) => void;

/** Cleanup function returned by subscribe */
export type Unsubscribe = () => void;

// ─── Transport Interface ──────────────────────────────────────

export interface Transport {
  /** Current connection status */
  readonly status: TransportStatus;

  /**
   * Human-readable name of the currently connected device, when the transport
   * knows it. Returns null when not connected, or when the transport doesn't
   * track a name. Optional — older transports may omit this.
   */
  readonly deviceName?: string | null;

  /**
   * Scan for devices advertising the BLE MIDI service.
   * Calls onDiscovered for each found device.
   * Scanning stops after timeoutMs or when stopScan() is called.
   *
   * @param onDiscovered Callback for each discovered device
   * @param timeoutMs Maximum scan duration (default: 10000)
   */
  scan(
    onDiscovered: (device: DiscoveredDevice) => void,
    timeoutMs?: number,
  ): Promise<void>;

  /** Stop an active scan */
  stopScan(): Promise<void>;

  /**
   * Optional synchronous device enumeration. Used by transports (e.g. Web MIDI)
   * where devices are already paired by the OS and `scan()` is a no-op.
   *
   * Transports that perform genuine async discovery (BLE) should leave this
   * undefined and rely on `scan()` instead.
   */
  listDevices?(): Promise<DiscoveredDevice[]>;

  /**
   * Connect to a specific device by ID.
   * Discovers services and verifies the MIDI characteristic exists.
   * Sets up disconnect monitoring for auto-reconnect.
   */
  connect(deviceId: string): Promise<void>;

  /** Disconnect from the current device and clean up */
  disconnect(): Promise<void>;

  /**
   * Send raw bytes to the piano.
   * The transport wraps the bytes in BLE MIDI framing before writing.
   *
   * @param rawMidiBytes Raw MIDI/SysEx bytes (F0...F7 for SysEx, or status+data for channel messages)
   */
  send(rawMidiBytes: number[]): Promise<void>;

  /**
   * Subscribe to incoming notifications from the piano.
   * The transport strips BLE MIDI framing and delivers raw MIDI bytes.
   *
   * Returns an unsubscribe function. Call it on disconnect or cleanup.
   *
   * Multiple listeners are supported — each receives every notification.
   */
  subscribe(listener: NotificationListener): Unsubscribe;

  /**
   * Clean up all resources (subscriptions, BLE manager).
   * Call on app unmount.
   */
  destroy(): Promise<void>;
}
