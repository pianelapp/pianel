/**
 * Tests for the ConnectionService heartbeat loop.
 *
 * Verifies:
 *   - Cadence: a ping fires every HEARTBEAT_INTERVAL_MS when idle.
 *   - Suppression: inbound traffic within the interval suppresses the next ping.
 *   - Recovery: an alive-reply clears the timeout and resets the miss counter.
 *   - Staleness: MAX_MISSED_BEATS consecutive timeouts → status='stale'.
 *   - Recovery from stale: next alive-reply restores 'connected'.
 *   - Cleanup: disconnect() cancels the interval and outstanding timer.
 *
 * Uses jest fake timers + a fake Transport whose `subscribe` exposes its
 * emitter so the test can simulate inbound bytes.
 */

import {ConnectionService} from '../../src/services/ConnectionService';
import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {createConnectionStore, useConnectionStore} from '../../src/store/connectionStore';
import {createPerformanceStore} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {createProfilesStore} from '../../src/store/profilesStore';
import {createFavoritesStore} from '../../src/store/favoritesStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport, NotificationListener} from '../../src/transport/types';

const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 3000;

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createProfilesStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useConnectionStore.getState().reset();
  // Modern fake timers so we can advance through the 50ms gaps inside
  // ConnectionService.readInitialState() without waiting in real time.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Build a fake transport whose emitter is exposed for test injection. */
function makeFakeTransport() {
  const sent: number[][] = [];
  const listeners: NotificationListener[] = [];
  let status: 'idle' | 'connected' | 'disconnected' = 'idle';

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

  /** Push raw bytes to every subscriber, mimicking transport delivery. */
  function emit(bytes: number[]) {
    for (const l of [...listeners]) l(bytes);
  }

  return {transport, sent, emit};
}

/** Build a fully wired ConnectionService that skips the identity handshake. */
async function makeService() {
  const {transport, sent, emit} = makeFakeTransport();
  const conn = new ConnectionService(transport);
  const piano = new PianoService(transport);
  conn.setPianoService(piano);

  // The identity-request path in ConnectionService waits for an Identity Reply
  // and otherwise falls back to the default engine. Short-circuit by
  // pre-injecting an Identity Reply when the identity request is sent.
  // Identity Reply layout: F0 7E <dev> 06 02 41 19 03 00 00 <fw...> F7.
  const identityReply = [
    0xf0, 0x7e, 0x10, 0x06, 0x02, 0x41, 0x19, 0x03, 0x00, 0x00, 0x1c, 0x01, 0x00, 0x00, 0xf7,
  ];
  (transport.send as jest.Mock).mockImplementation(async (m: number[]) => {
    sent.push(m);
    // Identity Request = F0 7E 7F 06 01 F7. Reply right after send resolves.
    if (m[0] === 0xf0 && m[1] === 0x7e && m[4] === 0x01) {
      // Defer to next tick so the subscriber is registered first.
      queueMicrotask(() => emit(identityReply));
    }
  });

  // connect() awaits several internal setTimeouts (identity timeout, 50ms gaps
  // inside readInitialState). With fake timers we must advance time while the
  // connect promise is pending. We step in 100ms increments so that each
  // microtask chain between awaits gets a chance to flush; total 500ms still
  // stays far below HEARTBEAT_INTERVAL_MS (5000), so no spurious heartbeat
  // tick fires here.
  const connectPromise = conn.connect('device-1');
  for (let i = 0; i < 5; i++) {
    await jest.advanceTimersByTimeAsync(100);
  }
  await connectPromise;

  return {conn, piano, transport, sent, emit};
}

/** Wire-format alive reply: F0 41 10 00 00 00 28 12 01 00 08 01 00 75 F7. */
const ALIVE_REPLY = [
  0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
  0x01, 0x00, 0x08, 0x01, 0x00, 0x75, 0xf7,
];

/** Wire-format alive RQ1 (what the service is expected to send). */
function isAliveRequest(bytes: number[]): boolean {
  return (
    bytes[0] === 0xf0 &&
    bytes[7] === 0x11 && // RQ1 command
    bytes[8] === 0x01 &&
    bytes[9] === 0x00 &&
    bytes[10] === 0x08 &&
    bytes[11] === 0x01
  );
}

describe('ConnectionService heartbeat', () => {
  it('does not send a ping immediately after connect', async () => {
    const {sent} = await makeService();
    expect(sent.filter(isAliveRequest).length).toBe(0);
  });

  it('sends a ping after HEARTBEAT_INTERVAL_MS of silence', async () => {
    const {sent} = await makeService();
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    expect(sent.filter(isAliveRequest).length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses the ping when inbound traffic arrived recently', async () => {
    const {sent, emit} = await makeService();
    // Advance halfway, emit a notification, then advance the rest.
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS / 2);
    emit(ALIVE_REPLY); // any inbound message — using alive reply for simplicity
    const baseline = sent.filter(isAliveRequest).length;
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS / 2 + 10);
    expect(sent.filter(isAliveRequest).length).toBe(baseline);
  });

  it('alive reply clears the pending timeout and prevents stale flip', async () => {
    const {emit} = await makeService();
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10); // ping sent
    // Reply arrives before the timeout fires.
    emit(ALIVE_REPLY);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('two consecutive missed replies flip status to stale', async () => {
    await makeService();
    // First miss
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    // Still connected after 1 miss
    expect(useConnectionStore.getState().status).toBe('connected');

    // Second miss
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    expect(useConnectionStore.getState().status).toBe('stale');
  });

  it('any inbound notification from stale restores connected', async () => {
    const {emit} = await makeService();
    // Force into stale via two misses.
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    expect(useConnectionStore.getState().status).toBe('stale');

    // Now a reply arrives — should restore connected.
    emit(ALIVE_REPLY);
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('alive reply is intercepted — does not surface as a notification', async () => {
    const {conn, emit} = await makeService();
    const seen: unknown[] = [];
    conn.setNotificationHandler((e) => seen.push(e));
    emit(ALIVE_REPLY);
    expect(seen).toHaveLength(0);
  });

  it('alive reply is processed even with no notification handler set', async () => {
    const {emit} = await makeService();
    // Drive into stale without ever calling setNotificationHandler.
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    expect(useConnectionStore.getState().status).toBe('stale');

    emit(ALIVE_REPLY);
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('non-alive inbound notification from stale also restores connected', async () => {
    const {conn, emit} = await makeService();
    // Need a registered notification handler so the non-alive branch is exercised.
    conn.setNotificationHandler(() => {});

    // Drive into stale.
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 10);
    expect(useConnectionStore.getState().status).toBe('stale');

    // A volume DT1 echo (different address — not the alive register).
    // sum = 1+0+2+19+40 = 62; chk = (128 - 62) % 128 = 66.
    const volumeEcho = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      0x01, 0x00, 0x02, 0x13,
      40,
      66,
      0xf7,
    ];
    emit(volumeEcho);
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('disconnect cancels the heartbeat loop', async () => {
    const {conn, sent} = await makeService();
    await conn.disconnect();
    const baseline = sent.filter(isAliveRequest).length;
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(sent.filter(isAliveRequest).length).toBe(baseline);
  });
});
