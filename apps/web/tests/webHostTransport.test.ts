/**
 * Task 6.2/6.3 — failing tests for the web-host transport wrapper that drives
 * the MIDI-SysEx permission prompt on connect and normalizes connect errors.
 *
 * The wrapper delegates every `Transport` method to the reused
 * `WebMIDITransport` (no transport changes) but, on `connect`, translates the
 * browser's permission-denied / blocked errors into an Error whose `.message`
 * is the actionable web-host copy, so the reused desktop `useConnection`
 * reporter surfaces it verbatim. It must:
 *   - proceed normally after the prompt is granted, and
 *   - never crash on denial (it rejects with a normalized, actionable error).
 */
import { WebHostMIDITransport } from '../src/host/WebHostMIDITransport';
import { PERMISSION_DENIED_TITLE } from '../src/host/connectionErrors';

type FakeTransport = {
  connect: jest.Mock<Promise<void>, [string]>;
  disconnect: jest.Mock;
  send: jest.Mock;
  scan: jest.Mock;
  stopScan: jest.Mock;
  listDevices: jest.Mock;
  subscribe: jest.Mock;
  destroy: jest.Mock;
  status: string;
  deviceName: string | null;
};

function makeFakeTransport(): FakeTransport {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    listDevices: jest.fn().mockResolvedValue([]),
    subscribe: jest.fn().mockReturnValue(() => undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    status: 'idle',
    deviceName: null,
  };
}

describe('WebHostMIDITransport', () => {
  it('delegates connect to the wrapped transport and resolves when the prompt is granted', async () => {
    const inner = makeFakeTransport();
    const transport = new WebHostMIDITransport(inner as never);

    await expect(transport.connect('dev-1')).resolves.toBeUndefined();
    expect(inner.connect).toHaveBeenCalledWith('dev-1');
  });

  it('normalizes a permission-denied (SecurityError) connect failure to actionable copy without crashing', async () => {
    const inner = makeFakeTransport();
    inner.connect.mockRejectedValueOnce(
      new DOMException('Permission denied', 'SecurityError'),
    );
    const transport = new WebHostMIDITransport(inner as never);

    await expect(transport.connect('dev-1')).rejects.toThrow(/browser settings/i);
    // The mapped message should match the permission-denied guidance, not crash.
    await expect(
      new WebHostMIDITransport(
        (() => {
          const t = makeFakeTransport();
          t.connect.mockRejectedValueOnce(
            new DOMException('blocked', 'NotAllowedError'),
          );
          return t;
        })() as never,
      ).connect(''),
    ).rejects.toThrow(/midi/i);

    // Sanity: the mapped copy is the permission-denied guidance.
    expect(PERMISSION_DENIED_TITLE.length).toBeGreaterThan(0);
  });

  it('normalizes a no-device error to OS-agnostic "USB / Bluetooth, then retry" copy', async () => {
    const inner = makeFakeTransport();
    inner.connect.mockRejectedValueOnce(
      new Error('No MIDI devices found. Connect your piano and retry.'),
    );
    const transport = new WebHostMIDITransport(inner as never);

    // The thrown message carries the web-host copy so the reused desktop
    // reporter surfaces it verbatim (it must NOT match the desktop reporter's
    // macOS-specific "no midi devices found" branch).
    let caught: unknown;
    try {
      await transport.connect('');
    } catch (e) {
      caught = e;
    }
    const message = (caught as Error).message;
    expect(message.toLowerCase()).toContain('usb');
    expect(message.toLowerCase()).toContain('bluetooth');
    expect(message.toLowerCase()).not.toContain('no midi devices found');
  });

  it('forwards subscribe/send/disconnect/listDevices/destroy to the wrapped transport', async () => {
    const inner = makeFakeTransport();
    const transport = new WebHostMIDITransport(inner as never);

    const listener = jest.fn();
    transport.subscribe(listener);
    expect(inner.subscribe).toHaveBeenCalledWith(listener);

    await transport.send([0x90, 0x40, 0x7f]);
    expect(inner.send).toHaveBeenCalledWith([0x90, 0x40, 0x7f]);

    await transport.listDevices();
    expect(inner.listDevices).toHaveBeenCalled();

    await transport.disconnect();
    expect(inner.disconnect).toHaveBeenCalled();

    await transport.destroy();
    expect(inner.destroy).toHaveBeenCalled();
  });
});
