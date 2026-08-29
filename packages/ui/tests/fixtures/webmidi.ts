type Handler = (event: Event) => void;

export class FakePort {
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' = 'closed';
  readonly send = jest.fn();
  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(
    readonly id: string,
    readonly name: string | null,
    readonly type: 'input' | 'output',
  ) {}

  async open(): Promise<FakePort> {
    this.connection = 'open';
    return this;
  }

  async close(): Promise<FakePort> {
    this.connection = 'closed';
    return this;
  }

  addEventListener(type: string, fn: Handler): void {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(fn);
    this.handlers.set(type, set);
  }

  removeEventListener(type: string, fn: Handler): void {
    this.handlers.get(type)?.delete(fn);
  }

  listenerCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  emitMessage(bytes: number[]): void {
    const event = {data: Uint8Array.from(bytes)} as unknown as Event;
    for (const fn of [...(this.handlers.get('midimessage') ?? [])]) fn(event);
  }
}

export class FakeMIDIAccess {
  readonly inputs = new Map<string, FakePort>();
  readonly outputs = new Map<string, FakePort>();
  private readonly statechange = new Set<Handler>();

  addEventListener(type: string, fn: Handler): void {
    if (type === 'statechange') this.statechange.add(fn);
  }

  removeEventListener(type: string, fn: Handler): void {
    if (type === 'statechange') this.statechange.delete(fn);
  }

  statechangeListenerCount(): number {
    return this.statechange.size;
  }

  addPort(port: FakePort): void {
    port.state = 'connected';
    this.mapFor(port).set(port.id, port);
    this.fire(port);
  }

  removePort(port: FakePort): void {
    port.state = 'disconnected';
    this.mapFor(port).delete(port.id);
    this.fire(port);
  }

  emitConnectionChange(port: FakePort): void {
    this.fire(port);
  }

  private mapFor(port: FakePort): Map<string, FakePort> {
    return port.type === 'input' ? this.inputs : this.outputs;
  }

  private fire(port: FakePort): void {
    const event = {port} as unknown as Event;
    for (const fn of [...this.statechange]) fn(event);
  }
}

export function installFakeMIDI(access: FakeMIDIAccess): jest.Mock {
  const request = jest.fn().mockResolvedValue(access);
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: request,
    configurable: true,
    writable: true,
  });
  return request;
}

export function uninstallFakeMIDI(): void {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

export function midiWorld(
  opts: {
    outputName?: string;
    inputName?: string;
    withPedal?: boolean;
    pedalFirst?: boolean;
  } = {},
): {
  access: FakeMIDIAccess;
  output: FakePort;
  input: FakePort;
  pedal: FakePort | null;
} {
  const outputName = opts.outputName ?? 'FP-30X';
  const inputName = opts.inputName ?? 'FP-30X';
  const access = new FakeMIDIAccess();
  const output = new FakePort('out-piano', outputName, 'output');
  const input = new FakePort('in-piano', inputName, 'input');
  const pedal = opts.withPedal
    ? new FakePort('in-pedal', 'FootCtrlPlus Bluetooth', 'input')
    : null;

  access.outputs.set(output.id, output);
  if (pedal && opts.pedalFirst !== false) access.inputs.set(pedal.id, pedal);
  access.inputs.set(input.id, input);
  if (pedal && opts.pedalFirst === false) access.inputs.set(pedal.id, pedal);

  return {access, output, input, pedal};
}
