/**
 * Channel-strip builder tests.
 *
 * The behaviour that matters most is DETERMINISM: a scene that omits a field
 * must still write that field's neutral, or the previous scene's value leaks
 * through (control changes survive Program Change and CC121).
 */

import {fp30xToneCatalog} from '../../../src/engine/fp30x/tones';
import {
  CC,
  buildCoarseTune,
  buildSnapshotMessages,
  buildStripMessages,
} from '../../../src/engine/fp30x/channelStrip';
import {NEUTRAL_STRIP} from '../../../src/types/midiChannelStrip';

const catalog = fp30xToneCatalog;

/** Extract the value of a control change from a message list. */
function ccValue(msgs: number[][], channel: number, controller: number) {
  const m = msgs.find(
    x => x[0] === (0xb0 | (channel - 1)) && x[1] === controller,
  );
  return m?.[2];
}

describe('neutral fill', () => {
  it('writes all eight shaping neutrals for an empty strip', () => {
    const msgs = buildStripMessages(5, {}, catalog);
    expect(ccValue(msgs, 5, CC.VOLUME)).toBe(NEUTRAL_STRIP.volume);
    expect(ccValue(msgs, 5, CC.PAN)).toBe(NEUTRAL_STRIP.pan);
    expect(ccValue(msgs, 5, CC.REVERB_SEND)).toBe(NEUTRAL_STRIP.reverbSend);
    expect(ccValue(msgs, 5, CC.CHORUS_SEND)).toBe(NEUTRAL_STRIP.chorusSend);
    expect(ccValue(msgs, 5, CC.CUTOFF)).toBe(64);
    expect(ccValue(msgs, 5, CC.ATTACK)).toBe(64);
    expect(ccValue(msgs, 5, CC.DECAY)).toBe(64);
    expect(ccValue(msgs, 5, CC.RELEASE)).toBe(64);
  });
});

describe('scene isolation (the inheritance bug)', () => {
  it('a scene that omits cutoff still resets it to neutral', () => {
    // Scene A darkens ch.5; scene B only sets volume. Without neutral fill,
    // scene B would sound with scene A's cutoff.
    const sceneA = buildStripMessages(5, {cutoff: 30}, catalog);
    const sceneB = buildStripMessages(5, {volume: 90}, catalog);
    expect(ccValue(sceneA, 5, CC.CUTOFF)).toBe(30);
    expect(ccValue(sceneB, 5, CC.CUTOFF)).toBe(64);
  });

  it('leaves undeclared channels completely untouched', () => {
    const msgs = buildSnapshotMessages({strips: {5: {volume: 90}}}, catalog);
    const touched = new Set(msgs.map(m => (m[0] & 0x0f) + 1));
    expect([...touched]).toEqual([5]);
  });
});

describe('channel 4 — keyboard part', () => {
  it('never emits a program change', () => {
    const msgs = buildStripMessages(4, {toneId: '0-0-0'} as never, catalog);
    expect(msgs.some(m => (m[0] & 0xf0) === 0xc0)).toBe(false);
    expect(ccValue(msgs, 4, CC.BANK_MSB)).toBeUndefined();
  });

  it('never emits a coarse tune (would stack with DT1 TRANSPOSE)', () => {
    const msgs = buildStripMessages(4, {coarseTune: 12} as never, catalog);
    expect(ccValue(msgs, 4, CC.RPN_LSB)).toBeUndefined();
  });

  it('still applies shaping — the point of including it at all', () => {
    const msgs = buildStripMessages(4, {cutoff: 40, release: 90}, catalog);
    expect(ccValue(msgs, 4, CC.CUTOFF)).toBe(40);
    expect(ccValue(msgs, 4, CC.RELEASE)).toBe(90);
  });
});

describe('channel 10 — percussion', () => {
  it('accepts a rhythm set', () => {
    const jazzSet = catalog.findById('7-0-5')!; // Jazz Set
    const msgs = buildStripMessages(10, {toneId: jazzSet.id}, catalog);
    expect(ccValue(msgs, 10, CC.BANK_MSB)).toBe(120);
  });

  it('skips a melodic tone instead of breaking the drum map', () => {
    const strings = catalog.findById('3-0-0')!; // Epic Strings
    const msgs = buildStripMessages(10, {toneId: strings.id}, catalog);
    expect(msgs.some(m => (m[0] & 0xf0) === 0xc0)).toBe(false);
  });
});

describe('coarse tune', () => {
  it('encodes semitones around 40H and closes with RPN null', () => {
    const msgs = buildCoarseTune(5, 12);
    expect(msgs).toEqual([
      [0xb4, CC.RPN_LSB, 0x02],
      [0xb4, CC.RPN_MSB, 0x00],
      [0xb4, CC.DATA_ENTRY_MSB, 0x4c], // 64 + 12
      [0xb4, CC.RPN_LSB, 0x7f],
      [0xb4, CC.RPN_MSB, 0x7f],
    ]);
  });

  it('clamps beyond the documented +/-24 range', () => {
    expect(buildCoarseTune(1, 99)[2][2]).toBe(0x40 + 24);
    expect(buildCoarseTune(1, -99)[2][2]).toBe(0x40 - 24);
  });
});

describe('BLE budget', () => {
  it('reports the real message cost of a realistic two-layer scene', () => {
    const msgs = buildSnapshotMessages(
      {
        strips: {
          4: {cutoff: 45, release: 85}, // keyboard: shaping only
          5: {toneId: '3-0-0', volume: 80, coarseTune: 12},
        },
      },
      catalog,
    );
    // ch4: 8 shaping. ch5: 3 tone + 8 shaping + 5 RPN = 16.
    expect(msgs).toHaveLength(24);
  });

  it('costs 16 messages for a full non-keyboard strip', () => {
    const msgs = buildStripMessages(5, {toneId: '3-0-0'}, catalog);
    expect(msgs).toHaveLength(16);
  });
});

describe('message ordering', () => {
  it('sends bank/program before the shaping controls', () => {
    const msgs = buildStripMessages(5, {toneId: '3-0-0', cutoff: 20}, catalog);
    const pcIndex = msgs.findIndex(m => (m[0] & 0xf0) === 0xc0);
    const cutoffIndex = msgs.findIndex(m => m[1] === CC.CUTOFF);
    expect(pcIndex).toBeGreaterThanOrEqual(0);
    expect(pcIndex).toBeLessThan(cutoffIndex);
  });

  it('emits channels in ascending order', () => {
    const msgs = buildSnapshotMessages(
      {strips: {11: {volume: 1}, 2: {volume: 2}, 7: {volume: 3}}},
      catalog,
    );
    const order = msgs.map(m => (m[0] & 0x0f) + 1).filter((v, i, a) => v !== a[i - 1]);
    expect(order).toEqual([2, 7, 11]);
  });
});
