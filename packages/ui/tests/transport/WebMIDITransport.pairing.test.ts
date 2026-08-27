import {WebMIDITransport} from '../../src/transport/WebMIDITransport';
import {resetMIDIAccess} from '../../src/transport/midiAccess';
import {
  installFakeMIDI,
  uninstallFakeMIDI,
  midiWorld,
  FakePort,
  FakeMIDIAccess,
} from '../fixtures/webmidi';

let warn: jest.SpyInstance;

beforeEach(() => {
  resetMIDIAccess();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  resetMIDIAccess();
  uninstallFakeMIDI();
  WebMIDITransport.chooser = null;
});

describe('WebMIDITransport input pairing', () => {
  it('attaches the piano input when its name matches the output exactly', async () => {
    const {access, output, input, pedal} = midiWorld({withPedal: true});
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.connect(output.id);

    expect(input.listenerCount('midimessage')).toBe(1);
    expect(pedal!.listenerCount('midimessage')).toBe(0);
    expect(transport.inputPortId).toBe('in-piano');
  });

  it('attaches the piano input by prefix when the platform suffixes input names', async () => {
    const {access, output, input, pedal} = midiWorld({
      outputName: 'FP-30X',
      inputName: 'FP-30X MIDI 1',
      withPedal: true,
    });
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.connect(output.id);

    expect(input.listenerCount('midimessage')).toBe(1);
    expect(pedal!.listenerCount('midimessage')).toBe(0);
    expect(transport.inputPortId).toBe('in-piano');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not deliver footswitch bytes to piano notification listeners', async () => {
    const {access, output, pedal} = midiWorld({
      outputName: 'FP-30X',
      inputName: 'FP-30X MIDI 1',
      withPedal: true,
    });
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    const received: number[][] = [];
    transport.subscribe(bytes => received.push(bytes));
    await transport.connect(output.id);

    pedal!.emitMessage([0xb0, 0x14, 0x7f]);

    expect(received).toEqual([]);
  });

  it('still falls back to the first input when nothing matches, and says so', async () => {
    const access = new FakeMIDIAccess();
    const output = new FakePort('out-piano', 'FP-30X', 'output');
    const stranger = new FakePort('in-other', 'Some Other Thing', 'input');
    access.outputs.set(output.id, output);
    access.inputs.set(stranger.id, stranger);
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.connect(output.id);

    expect(stranger.listenerCount('midimessage')).toBe(1);
    expect(transport.inputPortId).toBe('in-other');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[MIDI] no input port matched'),
      expect.anything(),
    );
  });

  it('reports no input port before connecting and after disconnecting', async () => {
    const {access, output} = midiWorld();
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    expect(transport.inputPortId).toBeNull();

    await transport.connect(output.id);
    expect(transport.inputPortId).toBe('in-piano');

    await transport.disconnect();
    expect(transport.inputPortId).toBeNull();
  });

  it('throws when the device has no input port at all', async () => {
    const access = new FakeMIDIAccess();
    const output = new FakePort('out-piano', 'FP-30X', 'output');
    access.outputs.set(output.id, output);
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await expect(transport.connect(output.id)).rejects.toThrow(
      /No matching MIDI input port/,
    );
  });
});

describe('WebMIDITransport shared MIDI access', () => {
  it('requests access once across listDevices and connect', async () => {
    const {access, output} = midiWorld();
    const request = installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.listDevices();
    await transport.connect(output.id);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('registers exactly one statechange listener per connect', async () => {
    const {access, output} = midiWorld();
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.connect(output.id);
    expect(access.statechangeListenerCount()).toBe(1);

    await transport.disconnect();
    expect(access.statechangeListenerCount()).toBe(0);
  });
});
