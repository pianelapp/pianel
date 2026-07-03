/**
 * T050: Beat echo encoding fix — unit tests.
 *
 * The FP-30X sends beat echo notifications at DT1 address 01 00 01 0A
 * using beat count encoding (0,2,3,4,5,6) instead of the index encoding
 * (0-5) used by the write address 01 00 02 1F. The parser must map
 * echo values to store indices.
 */

import {parseNotification} from '../../../src/engine/fp30x/parser';

/**
 * Build a full DT1 SysEx frame with correct Roland checksum.
 * F0 41 10 00 00 00 28 12 <addr4> <data> <checksum> F7
 */
function buildDT1Frame(address: number[], data: number[]): number[] {
  const checksumInput = [...address, ...data];
  let sum = 0;
  for (const b of checksumInput) sum += b;
  const checksum = (128 - (sum % 128)) % 128;
  return [
    0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
    ...address, ...data, checksum, 0xf7,
  ];
}

const ECHO_BEAT_ADDRESS = [0x01, 0x00, 0x01, 0x0a];
const WRITE_BEAT_ADDRESS = [0x01, 0x00, 0x02, 0x1f];

describe('parseNotification — beat echo encoding (01 00 01 0A)', () => {
  it('maps beat count 4 (4/4) to index 3', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x04]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 3});
  });

  it('maps beat count 6 (6/4) to index 5', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x06]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 5});
  });

  it('maps beat count 0 (0/4) to index 0', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x00]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 0});
  });

  it('maps beat count 2 (2/4) to index 1', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x02]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 1});
  });

  it('maps beat count 3 (3/4) to index 2', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x03]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 2});
  });

  it('maps beat count 5 (5/4) to index 4', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x05]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 4});
  });

  it('returns null for unknown beat count 1', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x01]);
    const event = parseNotification(bytes);
    expect(event).toBeNull();
  });

  it('returns null for unknown beat count 7', () => {
    const bytes = buildDT1Frame(ECHO_BEAT_ADDRESS, [0x07]);
    const event = parseNotification(bytes);
    expect(event).toBeNull();
  });
});

describe('parseNotification — write beat address (01 00 02 1F) unchanged', () => {
  it('passes through index 3 unchanged for 4/4', () => {
    const bytes = buildDT1Frame(WRITE_BEAT_ADDRESS, [0x03]);
    const event = parseNotification(bytes);
    expect(event).toEqual({type: 'metronomeBeat', value: 3});
  });
});
