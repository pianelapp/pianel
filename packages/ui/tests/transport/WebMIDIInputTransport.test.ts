import {WebMIDIInputTransport} from '../../src/transport/WebMIDIInputTransport';
import {resetMIDIAccess} from '../../src/transport/midiAccess';
import {resetPortWatch} from '../../src/transport/watchPorts';
import {claimPort, portRole, resetPortClaims} from '../../src/transport/portClaims';
import {
  installFakeMIDI,
  uninstallFakeMIDI,
  FakeMIDIAccess,
  FakePort,
} from '../fixtures/webmidi';
import type {TransportStatus} from '@pianel/core/transport/types';

let access: FakeMIDIAccess;
let pedal: FakePort;
let transport: WebMIDIInputTransport;

beforeEach(() => {
  resetMIDIAccess();
  resetPortWatch();
  resetPortClaims();
  access = new FakeMIDIAccess();
  pedal = new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input');
  installFakeMIDI(access);
  transport = new WebMIDIInputTransport();
});

afterEach(async () => {
  await transport.destroy();
  resetPortWatch();
  resetMIDIAccess();
  resetPortClaims();
  uninstallFakeMIDI();
});

describe('WebMIDIInputTransport listing', () => {
  it('enumerates inputs, not outputs', async () => {
    access.inputs.set(pedal.id, pedal);
    const speaker = new FakePort('out-piano', 'FP-30X', 'output');
    access.outputs.set(speaker.id, speaker);

    await expect(transport.listDevices()).resolves.toEqual([
      {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'},
    ]);
  });

  it('hides the input the piano has claimed', async () => {
    const pianoInput = new FakePort('in-piano', 'FP-30X MIDI 1', 'input');
    access.inputs.set(pianoInput.id, pianoInput);
    access.inputs.set(pedal.id, pedal);
    claimPort('in-piano', 'piano');

    await expect(transport.listDevices()).resolves.toEqual([
      {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'},
    ]);
  });

  it('returns an empty list rather than throwing when Web MIDI is unavailable', async () => {
    uninstallFakeMIDI();
    resetMIDIAccess();
    await expect(transport.listDevices()).resolves.toEqual([]);
  });
});

describe('WebMIDIInputTransport attaching', () => {
  it('attaches immediately when the port is already present', async () => {
    access.inputs.set(pedal.id, pedal);

    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');

    expect(transport.status).toBe('connected');
    expect(transport.deviceName).toBe('FootCtrlPlus Bluetooth');
    expect(pedal.listenerCount('midimessage')).toBe(1);
    expect(portRole('in-pedal')).toBe('control');
  });

  it('does not call open on the port', async () => {
    access.inputs.set(pedal.id, pedal);
    await transport.connect('in-pedal');
    expect(pedal.connection).toBe('closed');
  });

  it('waits in connecting when the pedal is asleep, then attaches when it wakes', async () => {
    const seen: TransportStatus[] = [];
    transport.onStatusChange(status => seen.push(status));

    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');
    expect(transport.status).toBe('connecting');

    access.addPort(pedal);

    expect(transport.status).toBe('connected');
    expect(pedal.listenerCount('midimessage')).toBe(1);
    expect(seen).toEqual(['connecting', 'connected']);
  });

  it('matches a remembered port by name when its id changed', async () => {
    const renamed = new FakePort('in-pedal-new', 'FootCtrlPlus Bluetooth', 'input');

    await transport.connect('in-pedal-old', 'FootCtrlPlus Bluetooth');
    access.addPort(renamed);

    expect(transport.status).toBe('connected');
    expect(renamed.listenerCount('midimessage')).toBe(1);
  });

  it('ignores an unrelated port appearing', async () => {
    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');
    access.addPort(new FakePort('in-other', 'Some Keyboard', 'input'));

    expect(transport.status).toBe('connecting');
  });

  it('refuses to attach to the input the piano holds', async () => {
    const pianoInput = new FakePort('in-piano', 'FP-30X MIDI 1', 'input');
    access.inputs.set(pianoInput.id, pianoInput);
    claimPort('in-piano', 'piano');

    await expect(transport.connect('in-piano')).rejects.toThrow(/piano/i);
    expect(pianoInput.listenerCount('midimessage')).toBe(0);
  });
});

describe('WebMIDIInputTransport delivery', () => {
  it('delivers raw bytes to subscribers', async () => {
    access.inputs.set(pedal.id, pedal);
    const received: number[][] = [];
    transport.subscribe(bytes => received.push(bytes));
    await transport.connect('in-pedal');

    pedal.emitMessage([0xb0, 0x14, 0x7f]);
    pedal.emitMessage([0xb0, 0x14, 0x00]);

    expect(received).toEqual([
      [0xb0, 0x14, 0x7f],
      [0xb0, 0x14, 0x00],
    ]);
  });

  it('stops delivering after unsubscribe', async () => {
    access.inputs.set(pedal.id, pedal);
    const received: number[][] = [];
    const unsub = transport.subscribe(bytes => received.push(bytes));
    await transport.connect('in-pedal');

    pedal.emitMessage([0xb0, 0x14, 0x7f]);
    unsub();
    pedal.emitMessage([0xb0, 0x14, 0x00]);

    expect(received).toHaveLength(1);
  });
});

describe('WebMIDIInputTransport losing and regaining the pedal', () => {
  it('falls back to connecting and reattaches silently when it returns', async () => {
    access.inputs.set(pedal.id, pedal);
    const seen: TransportStatus[] = [];
    transport.onStatusChange(status => seen.push(status));
    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');

    access.removePort(pedal);
    expect(transport.status).toBe('connecting');
    expect(pedal.listenerCount('midimessage')).toBe(0);

    access.addPort(pedal);
    expect(transport.status).toBe('connected');
    expect(pedal.listenerCount('midimessage')).toBe(1);
    expect(seen).toEqual(['connected', 'connecting', 'connected']);
  });

  it('does not double-subscribe when the same port is announced twice', async () => {
    access.inputs.set(pedal.id, pedal);
    await transport.connect('in-pedal');

    access.emitConnectionChange(pedal);
    access.addPort(pedal);

    expect(pedal.listenerCount('midimessage')).toBe(1);
  });

  it('releases the port and forgets it on disconnect', async () => {
    access.inputs.set(pedal.id, pedal);
    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');

    await transport.disconnect();

    expect(transport.status).toBe('disconnected');
    expect(transport.deviceName).toBeNull();
    expect(pedal.listenerCount('midimessage')).toBe(0);
    expect(portRole('in-pedal')).toBeNull();

    access.addPort(pedal);
    expect(transport.status).toBe('disconnected');
  });

  it('drops everything on destroy', async () => {
    access.inputs.set(pedal.id, pedal);
    const received: number[][] = [];
    transport.subscribe(bytes => received.push(bytes));
    await transport.connect('in-pedal');

    await transport.destroy();

    expect(pedal.listenerCount('midimessage')).toBe(0);
    expect(access.statechangeListenerCount()).toBe(0);
    pedal.emitMessage([0xb0, 0x14, 0x7f]);
    expect(received).toEqual([]);
  });
});
