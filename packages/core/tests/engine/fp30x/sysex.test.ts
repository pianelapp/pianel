/**
 * T010: SysEx builder tests — byte-level assertions.
 *
 * Verifies DT1/RQ1 construction, Roland checksum, and tempo encoding
 * against known-good captures from the Roland Piano App.
 */

import {
  buildDT1,
  buildRQ1,
  buildIdentityRequest,
  rolandChecksum,
  encodeTempo,
  decodeTempo,
} from '../../../src/engine/fp30x/sysex';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';

describe('rolandChecksum', () => {
  it('computes checksum for Concert Piano tone change', () => {
    // Address: 01 00 02 07, Data: 00 00 00
    // Sum = 1+0+2+7+0+0+0 = 10, checksum = (128-10)%128 = 118 = 0x76
    expect(rolandChecksum([0x01, 0x00, 0x02, 0x07, 0x00, 0x00, 0x00])).toBe(0x76);
  });

  it('computes checksum for Epic Strings tone change', () => {
    // Address: 01 00 02 07, Data: 03 00 00
    // Sum = 1+0+2+7+3+0+0 = 13, checksum = (128-13)%128 = 115 = 0x73
    expect(rolandChecksum([0x01, 0x00, 0x02, 0x07, 0x03, 0x00, 0x00])).toBe(0x73);
  });

  it('computes checksum for GM2 Organ 1 tone change', () => {
    // Address: 01 00 02 07, Data: 08 00 24
    // Sum = 1+0+2+7+8+0+36 = 54, checksum = (128-54)%128 = 74 = 0x4A
    expect(rolandChecksum([0x01, 0x00, 0x02, 0x07, 0x08, 0x00, 0x24])).toBe(0x4a);
  });

  it('computes checksum for volume 52', () => {
    // Address: 01 00 02 13, Data: 34
    // Sum = 1+0+2+19+52 = 74, checksum = (128-74)%128 = 54 = 0x36
    expect(rolandChecksum([0x01, 0x00, 0x02, 0x13, 0x34])).toBe(0x36);
  });

  it('returns 0 when sum is exact multiple of 128', () => {
    // Sum = 128, checksum = (128-0)%128 = 0
    expect(rolandChecksum([0x40, 0x40])).toBe(0);
  });
});

describe('buildDT1', () => {
  it('builds Concert Piano tone change matching PacketLogger capture', () => {
    // From discovery doc: F0 41 10 00 00 00 28 12 01 00 02 07 00 00 00 76 F7
    const result = buildDT1(
      [0x01, 0x00, 0x02, 0x07],
      [0x00, 0x00, 0x00],
    );
    expect(result).toEqual([
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      0x01, 0x00, 0x02, 0x07, 0x00, 0x00, 0x00, 0x76, 0xf7,
    ]);
  });

  it('builds volume change DT1', () => {
    const result = buildDT1([0x01, 0x00, 0x02, 0x13], [0x64]);
    // Checksum: 1+0+2+19+100 = 122, (128-122)%128 = 6
    expect(result[result.length - 2]).toBe(0x06); // checksum
    expect(result[0]).toBe(0xf0);
    expect(result[result.length - 1]).toBe(0xf7);
  });

  it('builds metronome toggle DT1', () => {
    // Address: 01 00 05 09, Data: 00 (always toggle)
    const result = buildDT1([0x01, 0x00, 0x05, 0x09], [0x00]);
    expect(result[0]).toBe(0xf0);
    expect(result[8]).toBe(0x01); // addr[0]
    expect(result[11]).toBe(0x09); // addr[3]
    expect(result[12]).toBe(0x00); // data
    expect(result[result.length - 1]).toBe(0xf7);
  });

  it('builds tempo change DT1 for 200 BPM', () => {
    // 200 BPM → byte1=0x01, byte2=0x48
    const result = buildDT1([0x01, 0x00, 0x03, 0x09], [0x01, 0x48]);
    expect(result[0]).toBe(0xf0);
    expect(result[12]).toBe(0x01); // tempo high
    expect(result[13]).toBe(0x48); // tempo low
    expect(result[result.length - 1]).toBe(0xf7);
  });
});

describe('buildRQ1', () => {
  it('builds performance block request', () => {
    const result = buildRQ1(
      [0x01, 0x00, 0x02, 0x00],
      [0x00, 0x00, 0x00, 0x24],
    );
    expect(result[0]).toBe(0xf0);
    expect(result[7]).toBe(0x11); // RQ1 command
    expect(result[8]).toBe(0x01); // addr start
    expect(result[15]).toBe(0x24); // size last byte
    expect(result[result.length - 1]).toBe(0xf7);
  });

  it('builds tempo block request', () => {
    const result = buildRQ1(
      [0x01, 0x00, 0x03, 0x09],
      [0x00, 0x00, 0x00, 0x02],
    );
    expect(result[7]).toBe(0x11); // RQ1 command
    expect(result.length).toBe(18); // F0 + 5 header + RQ1 + 4 addr + 4 size + checksum + F7
  });
});

describe('buildIdentityRequest', () => {
  it('returns Universal SysEx Identity Request', () => {
    expect(buildIdentityRequest()).toEqual([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
  });
});

describe('encodeTempo', () => {
  it('encodes 107 BPM', () => {
    expect(encodeTempo(107)).toEqual([0x00, 0x6b]);
  });

  it('encodes 128 BPM', () => {
    expect(encodeTempo(128)).toEqual([0x01, 0x00]);
  });

  it('encodes 200 BPM', () => {
    expect(encodeTempo(200)).toEqual([0x01, 0x48]);
  });

  it('encodes 20 BPM (minimum)', () => {
    expect(encodeTempo(20)).toEqual([0x00, 0x14]);
  });

  it('encodes 250 BPM (maximum)', () => {
    expect(encodeTempo(250)).toEqual([0x01, 0x7a]);
  });

  it('clamps below minimum', () => {
    expect(encodeTempo(10)).toEqual([0x00, 0x14]); // clamped to 20
  });

  it('clamps above maximum', () => {
    expect(encodeTempo(300)).toEqual([0x01, 0x7a]); // clamped to 250
  });
});

describe('decodeTempo', () => {
  it('decodes 107 BPM', () => {
    expect(decodeTempo(0x00, 0x6b)).toBe(107);
  });

  it('decodes 128 BPM', () => {
    expect(decodeTempo(0x01, 0x00)).toBe(128);
  });

  it('decodes 200 BPM', () => {
    expect(decodeTempo(0x01, 0x48)).toBe(200);
  });

  it('roundtrips with encodeTempo', () => {
    for (let bpm = 20; bpm <= 250; bpm++) {
      const [b1, b2] = encodeTempo(bpm);
      expect(decodeTempo(b1, b2)).toBe(bpm);
    }
  });
});

describe('FP30XEngine.buildAliveCheck', () => {
  it('produces RQ1 to 01 00 08 01 with size 1 byte and correct checksum', () => {
    // Bytes covered by checksum: addr (01 00 08 01) + size (00 00 00 01).
    // Sum = 1+0+8+1+0+0+0+1 = 11. Checksum = (128-11)%128 = 117 = 0x75.
    const engine = new FP30XEngine();
    expect(engine.buildAliveCheck()).toEqual([
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x11,
      0x01, 0x00, 0x08, 0x01,
      0x00, 0x00, 0x00, 0x01,
      0x75,
      0xf7,
    ]);
  });
});

describe('FP30XEngine.buildInitialStateRequest', () => {
  it('includes an RQ1 to 01 00 01 10 with 1-byte size (headphones connection)', () => {
    const engine = new FP30XEngine();
    const requests = engine.buildInitialStateRequest();

    // Each request is a full SysEx: F0 41 10 00 00 00 28 11 <addr×4> <size×4> <chk> F7.
    // Address bytes live at indices 8..11; size at 12..15.
    const headphoneRQ1 = requests.find(
      (req) =>
        req[8] === 0x01 &&
        req[9] === 0x00 &&
        req[10] === 0x01 &&
        req[11] === 0x10,
    );

    expect(headphoneRQ1).toBeDefined();
    // Size = 00 00 00 01
    expect(headphoneRQ1!.slice(12, 16)).toEqual([0x00, 0x00, 0x00, 0x01]);
  });

  it('still includes the existing RQ1s (performance, tempo, transpose, metronome)', () => {
    const engine = new FP30XEngine();
    const requests = engine.buildInitialStateRequest();

    function hasAddress(addr: readonly number[]): boolean {
      return requests.some(
        (req) =>
          req[8] === addr[0] &&
          req[9] === addr[1] &&
          req[10] === addr[2] &&
          req[11] === addr[3],
      );
    }

    expect(hasAddress([0x01, 0x00, 0x02, 0x00])).toBe(true); // performance block
    expect(hasAddress([0x01, 0x00, 0x01, 0x08])).toBe(true); // tempo echo
    expect(hasAddress([0x01, 0x00, 0x01, 0x01])).toBe(true); // transpose echo
    expect(hasAddress([0x01, 0x00, 0x01, 0x0f])).toBe(true); // metronome state echo
  });
});
