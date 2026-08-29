import {getMIDIAccess, resetMIDIAccess} from '../../src/transport/midiAccess';

type RequestFn = (options?: MIDIOptions) => Promise<MIDIAccess>;

function installRequest(fn: RequestFn | undefined): void {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: fn,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  resetMIDIAccess();
  installRequest(undefined);
});

describe('getMIDIAccess', () => {
  it('requests access once and hands the same object to every caller', async () => {
    const access = {} as MIDIAccess;
    const request = jest.fn().mockResolvedValue(access);
    installRequest(request);

    const [a, b] = await Promise.all([getMIDIAccess(), getMIDIAccess()]);
    const c = await getMIDIAccess();

    expect(request).toHaveBeenCalledTimes(1);
    expect(a).toBe(access);
    expect(b).toBe(access);
    expect(c).toBe(access);
  });

  it('asks for sysex', async () => {
    const request = jest.fn().mockResolvedValue({} as MIDIAccess);
    installRequest(request);

    await getMIDIAccess();

    expect(request).toHaveBeenCalledWith({sysex: true});
  });

  it('does not memoise a rejection, so a later retry can still succeed', async () => {
    const access = {} as MIDIAccess;
    const request = jest
      .fn()
      .mockRejectedValueOnce(new DOMException('Permission denied', 'SecurityError'))
      .mockResolvedValue(access);
    installRequest(request);

    await expect(getMIDIAccess()).rejects.toThrow(/denied/i);
    await expect(getMIDIAccess()).resolves.toBe(access);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects with a clear error when the browser has no Web MIDI', async () => {
    installRequest(undefined);
    await expect(getMIDIAccess()).rejects.toThrow(/Web MIDI API not available/);
  });

  it('forgets the access object after a reset', async () => {
    const request = jest.fn().mockResolvedValue({} as MIDIAccess);
    installRequest(request);

    await getMIDIAccess();
    resetMIDIAccess();
    await getMIDIAccess();

    expect(request).toHaveBeenCalledTimes(2);
  });
});
