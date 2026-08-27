import {WebMIDITransport} from '../../src/transport/WebMIDITransport';
import {resetMIDIAccess} from '../../src/transport/midiAccess';
import {claimPort, portRole, resetPortClaims} from '../../src/transport/portClaims';
import {installFakeMIDI, uninstallFakeMIDI, midiWorld} from '../fixtures/webmidi';

let warn: jest.SpyInstance;

beforeEach(() => {
  resetMIDIAccess();
  resetPortClaims();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  resetMIDIAccess();
  resetPortClaims();
  uninstallFakeMIDI();
});

describe('WebMIDITransport and port claims', () => {
  it('never attaches an input already claimed by the control surface', async () => {
    const {access, output, pedal} = midiWorld({
      outputName: 'FP-30X',
      inputName: 'Totally Different Name',
      withPedal: true,
    });
    installFakeMIDI(access);
    claimPort(pedal!.id, 'control');

    const transport = new WebMIDITransport();
    await transport.connect(output.id);

    expect(pedal!.listenerCount('midimessage')).toBe(0);
    expect(transport.inputPortId).toBe('in-piano');
  });

  it('fails rather than stealing the pedal when it is the only input left', async () => {
    const {access, output, pedal} = midiWorld({withPedal: true});
    access.inputs.delete('in-piano');
    installFakeMIDI(access);
    claimPort(pedal!.id, 'control');

    const transport = new WebMIDITransport();
    await expect(transport.connect(output.id)).rejects.toThrow(
      /No matching MIDI input port/,
    );
    expect(pedal!.listenerCount('midimessage')).toBe(0);
  });

  it('claims the input it attached, and releases it on disconnect', async () => {
    const {access, output} = midiWorld();
    installFakeMIDI(access);

    const transport = new WebMIDITransport();
    await transport.connect(output.id);
    expect(portRole('in-piano')).toBe('piano');

    await transport.disconnect();
    expect(portRole('in-piano')).toBeNull();
  });
});
