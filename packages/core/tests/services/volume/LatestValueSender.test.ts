import {
  LatestValueSender,
  type LatestValueSenderOptions,
} from '../../../src/services/volume/LatestValueSender';

const INTERVAL_MS = 25;

interface SendRecord {
  value: number;
  startedAt: number;
  endedAt: number | null;
}

function makeSender(overrides: Partial<LatestValueSenderOptions> = {}) {
  const records: SendRecord[] = [];
  const delivered: number[] = [];
  const failed: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let sendDelayMs = 0;
  let rejectNext = 0;

  const send = jest.fn(async (value: number) => {
    const record: SendRecord = {value, startedAt: Date.now(), endedAt: null};
    records.push(record);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      if (sendDelayMs > 0) {
        await new Promise<void>(r => setTimeout(r, sendDelayMs));
      }
      if (rejectNext > 0) {
        rejectNext--;
        throw new Error('send failed');
      }
    } finally {
      inFlight--;
      record.endedAt = Date.now();
    }
  });

  const sender = new LatestValueSender({
    intervalMs: INTERVAL_MS,
    send,
    now: () => Date.now(),
    setTimer: (callback, delayMs) => {
      const id = setTimeout(callback, delayMs);
      return () => clearTimeout(id);
    },
    onDelivered: value => delivered.push(value),
    onFailed: value => failed.push(value),
    ...overrides,
  });

  return {
    sender,
    send,
    records,
    delivered,
    failed,
    get maxInFlight() {
      return maxInFlight;
    },
    setSendDelay(ms: number) {
      sendDelayMs = ms;
    },
    rejectNextSends(count: number) {
      rejectNext = count;
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LatestValueSender', () => {
  it('sends the first request immediately', async () => {
    const h = makeSender();
    h.sender.request(10);
    expect(h.send).toHaveBeenCalledWith(10);
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'delivered',
      value: 10,
    });
    expect(h.delivered).toEqual([10]);
  });

  it('keeps at most 40 sends in any 1000 ms window for 1000 requests in one second, ending on the last value', async () => {
    const h = makeSender();
    for (let i = 0; i < 1000; i++) {
      h.sender.request(i % 128);
      await jest.advanceTimersByTimeAsync(1);
    }
    await jest.advanceTimersByTimeAsync(200);

    const starts = h.records.map(r => r.startedAt);
    for (const t0 of starts) {
      const inWindow = starts.filter(t => t >= t0 && t < t0 + 1000).length;
      expect(inWindow).toBeLessThanOrEqual(40);
    }
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(INTERVAL_MS);
    }
    expect(h.records[h.records.length - 1].value).toBe(999 % 128);
  });

  it('never overlaps sends and follows request order', async () => {
    const h = makeSender();
    h.setSendDelay(40);
    const requested: number[] = [];
    for (let i = 1; i <= 60; i++) {
      requested.push(i);
      h.sender.request(i);
      await jest.advanceTimersByTimeAsync(3);
    }
    await jest.advanceTimersByTimeAsync(500);

    expect(h.maxInFlight).toBe(1);
    const values = h.records.map(r => r.value);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    for (let i = 1; i < h.records.length; i++) {
      expect(h.records[i].startedAt).toBeGreaterThanOrEqual(
        h.records[i - 1].endedAt as number,
      );
    }
    expect(values[values.length - 1]).toBe(60);
  });

  it('holds only the newest pending value', async () => {
    const h = makeSender();
    h.sender.request(1);
    h.sender.request(2);
    h.sender.request(3);
    h.sender.request(4);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.records.map(r => r.value)).toEqual([1, 4]);
  });

  it('skips a value equal to the last delivered value', async () => {
    const h = makeSender();
    h.sender.request(50);
    await h.sender.settled();
    await jest.advanceTimersByTimeAsync(100);
    h.sender.request(50);
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'unchanged',
      value: 50,
    });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('sends a forced value even when unchanged', async () => {
    const h = makeSender();
    h.sender.request(50);
    await h.sender.settled();
    await jest.advanceTimersByTimeAsync(100);
    h.sender.request(50, {force: true});
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'delivered',
      value: 50,
    });
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it('retries after a rejection instead of skipping the value as unchanged', async () => {
    const h = makeSender();
    h.sender.request(70);
    await h.sender.settled();
    await jest.advanceTimersByTimeAsync(100);

    h.rejectNextSends(1);
    h.sender.request(80);
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'failed',
      value: 80,
    });
    expect(h.failed).toEqual([80]);

    await jest.advanceTimersByTimeAsync(100);
    h.sender.request(70);
    const outcome = h.sender.settled();
    await jest.advanceTimersByTimeAsync(100);
    await expect(outcome).resolves.toEqual({status: 'delivered', value: 70});
    expect(h.records.map(r => r.value)).toEqual([70, 80, 70]);
  });

  it('treats a synchronously throwing send as a failure without throwing', async () => {
    const h = makeSender({
      send: () => {
        throw new Error('boom');
      },
    });
    expect(() => h.sender.request(5)).not.toThrow();
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'failed',
      value: 5,
    });
    expect(h.failed).toEqual([5]);
  });

  it('forgets the delivered value on resetDelivered', async () => {
    const h = makeSender();
    h.sender.request(30);
    await h.sender.settled();
    await jest.advanceTimersByTimeAsync(100);
    h.sender.resetDelivered();
    h.sender.request(30);
    await h.sender.settled();
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it('cancel drops the pending value and the armed timer, letting the in-flight send finish', async () => {
    const h = makeSender();
    h.setSendDelay(10);
    h.sender.request(1);
    h.sender.request(2);
    h.sender.cancel();
    await jest.advanceTimersByTimeAsync(200);
    expect(h.records.map(r => r.value)).toEqual([1]);
    expect(h.delivered).toEqual([1]);
  });

  it('cancel while waiting on the interval sends nothing more', async () => {
    const h = makeSender();
    h.sender.request(1);
    await jest.advanceTimersByTimeAsync(1);
    h.sender.request(2);
    h.sender.cancel();
    await jest.advanceTimersByTimeAsync(200);
    expect(h.records.map(r => r.value)).toEqual([1]);
  });

  it('settled resolves null when idle with nothing sent and never rejects', async () => {
    const h = makeSender();
    await expect(h.sender.settled()).resolves.toBeNull();
    h.rejectNextSends(1);
    h.sender.request(9);
    await expect(h.sender.settled()).resolves.toEqual({
      status: 'failed',
      value: 9,
    });
  });

  it('settled waits for the trailing send', async () => {
    const h = makeSender();
    h.sender.request(1);
    await jest.advanceTimersByTimeAsync(1);
    h.sender.request(2);
    const outcome = h.sender.settled();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    await expect(outcome).resolves.toEqual({status: 'delivered', value: 2});
  });
});
