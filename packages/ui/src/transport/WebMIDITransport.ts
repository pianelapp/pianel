import type {
  Transport,
  TransportStatus,
  NotificationListener,
  Unsubscribe,
  DiscoveredDevice,
} from '@pianel/core/transport/types';

type MIDIDeviceInfo = { id: string; name: string };

export class WebMIDITransport implements Transport {
  private _status: TransportStatus = 'idle';
  private _input: MIDIInput | null = null;
  private _output: MIDIOutput | null = null;
  private _listeners: NotificationListener[] = [];
  private _midiMessageHandler: ((event: Event) => void) | null = null;
  private _deviceName: string | null = null;
  private _midiAccess: MIDIAccess | null = null;
  private _statechangeHandler: ((event: Event) => void) | null = null;

  /** Optional chooser: called when >1 MIDI output is available. Resolves with chosen id or null (→ pick first). */
  static chooser: ((devices: MIDIDeviceInfo[]) => Promise<string | null>) | null = null;

  get status(): TransportStatus {
    return this._status;
  }

  get deviceName(): string | null {
    return this._deviceName;
  }

  async scan(
    _onDiscovered: (device: DiscoveredDevice) => void,
    _timeoutMs?: number,
  ): Promise<void> {
    // No-op: Web MIDI devices are already in the OS MIDI system.
    // Callers should prefer listDevices() below.
  }

  async stopScan(): Promise<void> {
    // No-op.
  }

  /**
   * Synchronous enumeration of available MIDI output ports. Web MIDI exposes
   * already-paired devices through the OS, so we don't need a scan window.
   */
  async listDevices(): Promise<DiscoveredDevice[]> {
    if (typeof navigator.requestMIDIAccess !== 'function') return [];
    try {
      const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      const out: DiscoveredDevice[] = [];
      midiAccess.outputs.forEach(output => {
        out.push({ id: output.id, name: output.name ?? output.id });
      });
      return out;
    } catch {
      return [];
    }
  }

  async connect(deviceId: string): Promise<void> {
    this._status = 'connecting';

    try {
      if (typeof navigator.requestMIDIAccess !== 'function') {
        throw new Error('Web MIDI API not available in this context');
      }

      const midiAccess = await navigator.requestMIDIAccess({ sysex: true });

      // Collect all output ports as candidate devices.
      const outputs: MIDIOutput[] = [];
      midiAccess.outputs.forEach(output => outputs.push(output));

      if (outputs.length === 0) {
        throw new Error(
          'No MIDI devices found. Connect your piano via USB cable, or pair it via Bluetooth in macOS System Settings → Bluetooth, then try again.',
        );
      }

      let selectedOutput: MIDIOutput;

      if (deviceId && deviceId.length > 0) {
        // Caller specified a device — use exactly that one.
        const direct = outputs.find(o => o.id === deviceId) ?? null;
        if (!direct) {
          throw new Error(
            `MIDI device with id "${deviceId}" is no longer available. Try refreshing the device list.`,
          );
        }
        selectedOutput = direct;
      } else if (outputs.length === 1) {
        selectedOutput = outputs[0];
      } else {
        // Build device list for chooser (legacy fallback when no deviceId).
        const devices: MIDIDeviceInfo[] = outputs.map(o => ({
          id: o.id,
          name: o.name ?? o.id,
        }));

        let chosenId: string | null = null;
        if (WebMIDITransport.chooser) {
          chosenId = await WebMIDITransport.chooser(devices);
        }

        const found = chosenId ? outputs.find(o => o.id === chosenId) : null;
        selectedOutput = found ?? outputs[0];
      }

      // Find matching input port by name.
      let matchedInput: MIDIInput | null = null;
      midiAccess.inputs.forEach(input => {
        if (input.name === selectedOutput.name) {
          matchedInput = input;
        }
      });

      if (!matchedInput) {
        // Fallback: pick first available input.
        midiAccess.inputs.forEach(input => {
          if (!matchedInput) matchedInput = input;
        });
      }

      if (!matchedInput) {
        throw new Error('No matching MIDI input port found for the selected output.');
      }

      // Open both ports.
      await selectedOutput.open();
      await (matchedInput as MIDIInput).open();

      this._output = selectedOutput;
      this._input = matchedInput as MIDIInput;
      this._deviceName = selectedOutput.name ?? null;

      // Register midimessage listener.
      this._midiMessageHandler = (event: Event) => {
        const midiEvent = event as MIDIMessageEvent;
        if (!midiEvent.data) return;
        const bytes = Array.from(midiEvent.data);
        for (const listener of this._listeners) {
          listener(bytes);
        }
      };

      (this._input as any).addEventListener('midimessage', this._midiMessageHandler);

      // Observe port lifecycle so we notice if the piano is powered off / its
      // USB cable is yanked / its BLE link drops at the OS level. Without this,
      // detection falls entirely to the alive-check heartbeat (~11-16 s worst
      // case). The macOS Web MIDI implementation fires statechange within a
      // second of the port disappearing.
      this._midiAccess = midiAccess;
      const selectedOutputId = selectedOutput.id;
      const matchedInputId = (matchedInput as MIDIInput).id;
      this._statechangeHandler = (event: Event) => {
        const port = (event as MIDIConnectionEvent).port;
        if (!port) return;
        if (port.id !== selectedOutputId && port.id !== matchedInputId) return;
        if (port.state === 'disconnected' && this._status === 'connected') {
          // Don't tear down here — let ConnectionService.disconnect() do that
          // when its auto-reconnect monitor flips. We just signal "the link
          // is gone" via _status; the monitor polls it every second.
          this._status = 'disconnected';
        }
      };
      midiAccess.addEventListener('statechange', this._statechangeHandler);

      this._status = 'connected';
    } catch (err) {
      this._status = 'disconnected';
      console.error('[MIDI] connect failed:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this._input && this._midiMessageHandler) {
      (this._input as any).removeEventListener('midimessage', this._midiMessageHandler);
      this._midiMessageHandler = null;
    }

    if (this._midiAccess && this._statechangeHandler) {
      this._midiAccess.removeEventListener('statechange', this._statechangeHandler);
      this._statechangeHandler = null;
    }
    this._midiAccess = null;

    this._input = null;
    this._output = null;
    this._deviceName = null;
    this._status = 'disconnected';
  }

  async send(rawMidiBytes: number[]): Promise<void> {
    if (!this._output) {
      throw new Error('Not connected');
    }
    this._output.send(rawMidiBytes);
  }

  subscribe(listener: NotificationListener): Unsubscribe {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this._listeners = [];
  }
}
