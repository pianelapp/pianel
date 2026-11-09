import {ConnectionService} from '../../src/services/ConnectionService';
import {PianoService} from '../../src/services/PianoService';
import {PresetService} from '../../src/services/presets/PresetService';
import type {Transport, NotificationListener} from '../../src/transport/types';

const IDENTITY_REPLY = [
  0xf0, 0x7e, 0x10, 0x06, 0x02, 0x41, 0x19, 0x03, 0x00, 0x00, 0x1c, 0x01, 0x00,
  0x00, 0xf7,
];

export const engineVolumeMessage = (vv: number): number[] => [
  0xf0, 0x7f, 0x7f, 0x04, 0x01, 0x00, vv, 0xf7,
];

export const isEngineVolume = (m: number[]): boolean =>
  m[0] === 0xf0 && m[1] === 0x7f && m[2] === 0x7f && m[3] === 0x04 && m[4] === 0x01;

const isIdentityRequest = (m: number[]): boolean =>
  m[0] === 0xf0 && m[1] === 0x7e && m[4] === 0x01;

export const isRq1 = (m: number[]): boolean =>
  m[0] === 0xf0 && m[1] === 0x41 && m[7] === 0x11;

export const isDt1 = (m: number[]): boolean =>
  m[0] === 0xf0 && m[1] === 0x41 && m[7] === 0x12;

export const isOutputVolumeWrite = (m: number[]): boolean =>
  isDt1(m) && m[8] === 0x01 && m[9] === 0x00 && m[10] === 0x02 && m[11] === 0x13;

const isPerformanceBlockRequest = (m: number[]): boolean =>
  isRq1(m) && m[8] === 0x01 && m[9] === 0x00 && m[10] === 0x02 && m[11] === 0x00;

function performanceBlockResponse(outputVolume: number): number[] {
  const address = [0x01, 0x00, 0x02, 0x00];
  const data = new Array(0x24).fill(0);
  data[0x13] = outputVolume;
  data[0x1d] = 0x03;
  let sum = 0;
  for (const b of [...address, ...data]) sum += b;
  const checksum = (128 - (sum % 128)) % 128;
  return [
    0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
    ...address, ...data, checksum, 0xf7,
  ];
}

export interface EngineVolumeHarnessOptions {
  readBackOutputVolume?: number;
}

export function makeEngineVolumeHarness(
  options: EngineVolumeHarnessOptions = {},
) {
  const {readBackOutputVolume} = options;
  const sent: number[][] = [];
  const listeners: NotificationListener[] = [];
  let status: 'idle' | 'connected' | 'disconnected' = 'idle';

  const emit = (bytes: number[]) => {
    for (const l of [...listeners]) l(bytes);
  };

  const transport: Transport = {
    get status() {
      return status;
    },
    scan: jest.fn(async () => {}),
    stopScan: jest.fn(async () => {}),
    connect: jest.fn(async () => {
      status = 'connected';
    }),
    disconnect: jest.fn(async () => {
      status = 'disconnected';
    }),
    send: jest.fn(async (m: number[]) => {
      sent.push(m);
      if (isIdentityRequest(m)) {
        queueMicrotask(() => emit(IDENTITY_REPLY));
      }
      if (readBackOutputVolume !== undefined && isPerformanceBlockRequest(m)) {
        queueMicrotask(() => emit(performanceBlockResponse(readBackOutputVolume)));
      }
    }),
    subscribe: (listener: NotificationListener) => {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    destroy: jest.fn(async () => {}),
  };

  const conn = new ConnectionService(transport);
  const piano = new PianoService(transport);
  conn.setPianoService(piano);
  conn.setNotificationHandler(event => piano.dispatchEvent(event));
  const presets = new PresetService(piano);
  presets.setConnectionService(conn);

  return {
    conn,
    piano,
    presets,
    transport,
    sent,
    engineVolumeSends: () => sent.filter(isEngineVolume),
    outputVolumeWrites: () => sent.filter(isOutputVolumeWrite),
    clearSent() {
      sent.length = 0;
    },
  };
}

export async function settle(promise: Promise<unknown>, ms = 600): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    await jest.advanceTimersByTimeAsync(50);
  }
  await promise;
}
