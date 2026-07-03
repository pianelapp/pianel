/**
 * Cold-boot DT1 unlock: the FP-30X silently ignores DT1 parameter writes after
 * a fresh power-on until this sequence is sent. The expected bytes here are
 * lifted verbatim from a PacketLogger capture of the Roland Piano App.
 *
 * See docs/cold-boot-dt1-unlock.md.
 */

import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';

describe('FP30XEngine.buildSessionUnlock', () => {
  const engine = new FP30XEngine();

  it('returns exactly two messages in ship 3', () => {
    expect(engine.buildSessionUnlock()).toHaveLength(2);
  });

  it('first message matches the Roland Piano App unlock write to 01 00 03 06 = 01 (enable DT1 writes)', () => {
    const [first] = engine.buildSessionUnlock();
    expect(first).toEqual([
      0xf0, // SysEx start
      0x41, // Roland manufacturer
      0x10, // FP-30X device ID
      0x00, 0x00, 0x00, 0x28, // Model ID
      0x12, // DT1 command
      0x01, 0x00, 0x03, 0x06, // Address
      0x01, // Data
      0x75, // Roland checksum (verified: 128 - (1+0+3+6+1) = 117 = 0x75)
      0xf7, // SysEx end
    ]);
  });

  it('second message matches the Roland Piano App write to 01 00 03 00 = 00 01 (enable bidirectional echo)', () => {
    const [, second] = engine.buildSessionUnlock();
    expect(second).toEqual([
      0xf0,
      0x41,
      0x10,
      0x00, 0x00, 0x00, 0x28,
      0x12,
      0x01, 0x00, 0x03, 0x00, // Address
      0x00, 0x01, // Data (2 bytes)
      0x7b, // Roland checksum (verified: 128 - (1+0+3+0+0+1) = 123 = 0x7B)
      0xf7,
    ]);
  });
});
