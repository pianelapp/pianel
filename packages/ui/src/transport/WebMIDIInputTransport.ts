import type {
  DiscoveredDevice,
  InputTransport,
  NotificationListener,
  TransportStatus,
  TransportStatusListener,
  Unsubscribe,
} from '@pianel/core/transport/types';
import {getMIDIAccess} from './midiAccess';
import {watchPorts, type PortEvent} from './watchPorts';
import {claimPort, portRole, releasePort} from './portClaims';

export class WebMIDIInputTransport implements InputTransport {
  private _status: TransportStatus = 'idle';
  private _deviceName: string | null = null;
  private _wantedId: string | null = null;
  private _wantedName: string | null = null;
  private _port: MIDIInput | null = null;
  private _messageHandler: ((event: Event) => void) | null = null;
  private _unwatch: (() => void) | null = null;
  private _listeners: NotificationListener[] = [];
  private _statusListeners: TransportStatusListener[] = [];

  get status(): TransportStatus {
    return this._status;
  }

  get deviceName(): string | null {
    return this._deviceName;
  }

  async listDevices(): Promise<DiscoveredDevice[]> {
    try {
      const access = await getMIDIAccess();
      const devices: DiscoveredDevice[] = [];
      access.inputs.forEach(input => {
        if (portRole(input.id) === 'piano') return;
        devices.push({id: input.id, name: input.name ?? input.id});
      });
      return devices;
    } catch {
      return [];
    }
  }

  async connect(deviceId: string, deviceName?: string | null): Promise<void> {
    if (portRole(deviceId) === 'piano') {
      throw new Error(
        'That MIDI input is already in use by the piano. Choose a different device.',
      );
    }

    this._wantedId = deviceId;
    this._wantedName = deviceName ?? null;
    this._deviceName = deviceName ?? null;

    if (!this._unwatch) {
      this._unwatch = await watchPorts(event => this.onPortEvent(event));
    }

    const access = await getMIDIAccess();
    let found: MIDIInput | null = null;
    access.inputs.forEach(input => {
      if (!found && this.isWanted(input)) found = input;
    });

    if (found) this.attach(found);
    else this.setStatus('connecting');
  }

  async disconnect(): Promise<void> {
    this.detach();
    this._wantedId = null;
    this._wantedName = null;
    this._deviceName = null;
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
    this.setStatus('disconnected');
  }

  subscribe(listener: NotificationListener): Unsubscribe {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  onStatusChange(listener: TransportStatusListener): Unsubscribe {
    this._statusListeners.push(listener);
    return () => {
      const idx = this._statusListeners.indexOf(listener);
      if (idx !== -1) this._statusListeners.splice(idx, 1);
    };
  }

  async destroy(): Promise<void> {
    this.detach();
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
    this._wantedId = null;
    this._wantedName = null;
    this._deviceName = null;
    this._listeners = [];
    this._statusListeners = [];
    this._status = 'idle';
  }

  private isWanted(port: {id: string; name?: string | null}): boolean {
    if (this._wantedId !== null && port.id === this._wantedId) return true;
    return this._wantedName !== null && (port.name ?? null) === this._wantedName;
  }

  private onPortEvent({port, presence}: PortEvent): void {
    if (port.type !== 'input') return;
    if (this._wantedId === null) return;
    if (!this.isWanted(port)) return;

    if (presence === 'appeared') {
      if (this._port && this._port.id === port.id) return;
      this.attach(port as MIDIInput);
      return;
    }

    if (this._port && this._port.id !== port.id) return;
    this.detach();
    this.setStatus('connecting');
  }

  private attach(port: MIDIInput): void {
    this.detach();

    this._messageHandler = (event: Event) => {
      const midiEvent = event as MIDIMessageEvent;
      if (!midiEvent.data) return;
      const bytes = Array.from(midiEvent.data);
      for (const listener of [...this._listeners]) listener(bytes);
    };

    port.addEventListener('midimessage', this._messageHandler);
    claimPort(port.id, 'control');

    this._port = port;
    this._deviceName = port.name ?? this._wantedName;
    this.setStatus('connected');
  }

  private detach(): void {
    if (this._port && this._messageHandler) {
      this._port.removeEventListener('midimessage', this._messageHandler);
    }
    if (this._port) releasePort(this._port.id);
    this._port = null;
    this._messageHandler = null;
  }

  private setStatus(status: TransportStatus): void {
    if (this._status === status) return;
    this._status = status;
    for (const listener of [...this._statusListeners]) listener(status);
  }
}
