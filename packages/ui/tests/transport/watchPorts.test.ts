import {watchPorts, resetPortWatch} from '../../src/transport/watchPorts';
import {resetMIDIAccess} from '../../src/transport/midiAccess';
import {
  installFakeMIDI,
  uninstallFakeMIDI,
  FakeMIDIAccess,
  FakePort,
} from '../fixtures/webmidi';
import type {PortEvent} from '../../src/transport/watchPorts';

let access: FakeMIDIAccess;

beforeEach(() => {
  resetMIDIAccess();
  resetPortWatch();
  access = new FakeMIDIAccess();
  installFakeMIDI(access);
});

afterEach(() => {
  resetPortWatch();
  resetMIDIAccess();
  uninstallFakeMIDI();
});

describe('watchPorts', () => {
  it('reports a port that appears after the page loaded', async () => {
    const seen: PortEvent[] = [];
    await watchPorts(event => seen.push(event));

    const pedal = new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input');
    access.addPort(pedal);

    expect(seen).toHaveLength(1);
    expect(seen[0].presence).toBe('appeared');
    expect(seen[0].port.id).toBe('in-pedal');
  });

  it('reports a port that goes away', async () => {
    const pedal = new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input');
    access.inputs.set(pedal.id, pedal);

    const seen: PortEvent[] = [];
    await watchPorts(event => seen.push(event));
    access.removePort(pedal);

    expect(seen).toHaveLength(1);
    expect(seen[0].presence).toBe('disappeared');
  });

  it('does not report a port that was already there when we subscribed', async () => {
    const pedal = new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input');
    access.inputs.set(pedal.id, pedal);

    const seen: PortEvent[] = [];
    await watchPorts(event => seen.push(event));

    expect(seen).toEqual([]);
  });

  it('ignores a connection change on a port whose state did not change', async () => {
    const pedal = new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input');
    access.inputs.set(pedal.id, pedal);

    const seen: PortEvent[] = [];
    await watchPorts(event => seen.push(event));

    pedal.connection = 'open';
    access.emitConnectionChange(pedal);
    pedal.connection = 'closed';
    access.emitConnectionChange(pedal);

    expect(seen).toEqual([]);
  });

  it('survives an event delivered with no port', async () => {
    const seen: PortEvent[] = [];
    await watchPorts(event => seen.push(event));

    expect(() =>
      access.emitConnectionChange(null as unknown as FakePort),
    ).not.toThrow();
    expect(seen).toEqual([]);
  });

  it('registers exactly one statechange listener however many subscribers there are', async () => {
    await watchPorts(() => {});
    await watchPorts(() => {});
    await watchPorts(() => {});

    expect(access.statechangeListenerCount()).toBe(1);
  });

  it('fans one event out to every subscriber', async () => {
    const a: PortEvent[] = [];
    const b: PortEvent[] = [];
    await watchPorts(event => a.push(event));
    await watchPorts(event => b.push(event));

    access.addPort(new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input'));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('stops delivering to an unsubscribed listener and drops the last one', async () => {
    const seen: PortEvent[] = [];
    const unsubA = await watchPorts(event => seen.push(event));
    const unsubB = await watchPorts(() => {});

    unsubA();
    access.addPort(new FakePort('in-a', 'A', 'input'));
    expect(seen).toEqual([]);

    unsubB();
    expect(access.statechangeListenerCount()).toBe(0);
  });
});
