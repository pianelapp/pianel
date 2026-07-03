/**
 * Tests for FP30XEngine.isAliveReply — the heartbeat reply detector.
 *
 * The piano answers an RQ1 to 01 00 08 01 with a DT1 to the same address
 * carrying `data = [0x00]`. ConnectionService uses isAliveReply to
 * intercept these replies before the normal notification path.
 */

import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';

const engine = new FP30XEngine();

/** Wire-format DT1 reply: F0 41 10 00 00 00 28 12 01 00 08 01 <data> <chk> F7 */
function aliveReply(data: number): number[] {
  // Checksum over addr (01 00 08 01) + data:
  // sum = 1+0+8+1+data; chk = (128 - sum%128) % 128.
  const sum = 1 + 0 + 8 + 1 + data;
  const chk = (128 - (sum % 128)) % 128;
  return [
    0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
    0x01, 0x00, 0x08, 0x01,
    data,
    chk,
    0xf7,
  ];
}

describe('FP30XEngine.isAliveReply', () => {
  it('returns true for the canonical 0x00 alive reply', () => {
    expect(engine.isAliveReply(aliveReply(0x00))).toBe(true);
  });

  it('returns false when the data byte is not 0x00', () => {
    expect(engine.isAliveReply(aliveReply(0x01))).toBe(false);
  });

  it('returns false for a DT1 to a different address (volume echo)', () => {
    // Volume DT1: 01 00 02 13 + [40], not the alive address.
    const sum = 1 + 0 + 2 + 19 + 40;
    const chk = (128 - (sum % 128)) % 128;
    const volumeEcho = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      0x01, 0x00, 0x02, 0x13,
      40,
      chk,
      0xf7,
    ];
    expect(engine.isAliveReply(volumeEcho)).toBe(false);
  });

  it('returns false for a Note On message', () => {
    expect(engine.isAliveReply([0x90, 60, 100])).toBe(false);
  });

  it('returns false for an Identity Reply SysEx', () => {
    expect(
      engine.isAliveReply([
        0xf0, 0x7e, 0x10, 0x06, 0x02,
        0x41, 0x19, 0x03, 0x00, 0x00, 0x1c, 0x01, 0x00, 0x00,
        0xf7,
      ]),
    ).toBe(false);
  });

  it('returns false for an empty buffer', () => {
    expect(engine.isAliveReply([])).toBe(false);
  });

  it('returns false for a truncated DT1 missing the data byte', () => {
    expect(
      engine.isAliveReply([
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x08, 0x01,
        0xf7,
      ]),
    ).toBe(false);
  });
});
