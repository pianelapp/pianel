/**
 * T012: Parser tests for voicing-mode DT1 echoes + performance-block extraction.
 *
 * Sources: docs/roland-sysex-discovery.md §6 — performance parameter block + notification format.
 */

import {parseNotification, parseStateResponse} from '../../../src/engine/fp30x/parser';
import {buildDT1, buildRQ1} from '../../../src/engine/fp30x/sysex';

function dt1Echo(address: number[], data: number[]): number[] {
  // Caller-side this is the same wire format the piano sends back.
  return buildDT1(address, data);
}

describe('parseNotification — voicing-mode echo addresses', () => {
  it('parses split-left shift echo at 01 00 02 02', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x02], [0x41]));
    expect(evt).toEqual({type: 'splitLeftShift', value: 0x41});
  });

  it('parses dual-tone2 shift echo at 01 00 02 04', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x04], [0x3f]));
    expect(evt).toEqual({type: 'dualT2Shift', value: 0x3f});
  });

  it('parses twin-mode echo at 01 00 02 06', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x06], [0x00]));
    expect(evt).toEqual({type: 'twinMode', value: 0x00});
  });

  it('parses split-right shift echo at 01 00 02 16', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x16], [0x4c]));
    expect(evt).toEqual({type: 'splitRightShift', value: 0x4c});
  });

  it('parses dual-tone1 shift echo at 01 00 02 17', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x17], [0x34]));
    expect(evt).toEqual({type: 'dualT1Shift', value: 0x34});
  });

  it('parses dual balance echo at 01 00 02 05 (separate from Split at 0x03)', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x05], [0x44]));
    expect(evt).toEqual({type: 'dualBalance', value: 0x44});
  });

  it('still parses Split balance echo at 01 00 02 03', () => {
    const evt = parseNotification(dt1Echo([0x01, 0x00, 0x02, 0x03], [0x40]));
    expect(evt).toEqual({type: 'balance', value: 0x40});
  });

  it('parses dual-tone2 (toneForDual) echo at 01 00 02 0D', () => {
    const evt = parseNotification(
      dt1Echo([0x01, 0x00, 0x02, 0x0d], [0x05, 0x00, 0x01]),
    );
    expect(evt).toEqual({
      type: 'dualTone2',
      category: 0x05,
      indexHigh: 0x00,
      indexLow: 0x01,
    });
  });
});

describe('parseStateResponse — performance block extracts shifts + twin-mode', () => {
  // Build a 36-byte performance-block response with known marker bytes at the relevant offsets.
  function buildPerfBlockResponse(): number[] {
    const data: number[] = new Array(0x24).fill(0x00);
    // Mirror discovery-doc defaults where helpful
    data[0x00] = 0x02; // voice mode = dual (just so the case fires)
    data[0x01] = 0x36; // split point default
    data[0x02] = 0x41; // split-left shift = +1
    data[0x03] = 0x40; // balance center
    data[0x04] = 0x3f; // dual-tone2 shift = -1
    data[0x05] = 0x44; // dual balance (separate from Split at 0x03)
    data[0x06] = 0x00; // twin mode = pair
    data[0x07] = 0x00; // right tone category
    data[0x08] = 0x00; // right tone idx hi
    data[0x09] = 0x00; // right tone idx lo
    data[0x0a] = 0x03; // split lower tone category (Strings)
    data[0x0b] = 0x00;
    data[0x0c] = 0x00;
    data[0x0d] = 0x05; // dual tone 2 category (Pad)
    data[0x0e] = 0x00;
    data[0x0f] = 0x01;
    data[0x13] = 0x64; // volume 100
    data[0x16] = 0x4c; // split-right shift = +12
    data[0x17] = 0x34; // dual-tone1 shift = -12
    data[0x1d] = 0x03; // key touch medium
    data[0x1f] = 0x03; // metronome beat 4/4
    return buildDT1([0x01, 0x00, 0x02, 0x00], data);
  }

  const events = parseStateResponse(buildPerfBlockResponse());

  it('emits splitLeftShift event from offset 0x02', () => {
    expect(events).toContainEqual({type: 'splitLeftShift', value: 0x41});
  });

  it('emits dualT2Shift event from offset 0x04', () => {
    expect(events).toContainEqual({type: 'dualT2Shift', value: 0x3f});
  });

  it('emits dualBalance event from offset 0x05 (separate from Split balance at 0x03)', () => {
    expect(events).toContainEqual({type: 'dualBalance', value: 0x44});
  });

  it('emits twinMode event from offset 0x06', () => {
    expect(events).toContainEqual({type: 'twinMode', value: 0x00});
  });

  it('emits splitRightShift event from offset 0x16', () => {
    expect(events).toContainEqual({type: 'splitRightShift', value: 0x4c});
  });

  it('emits dualT1Shift event from offset 0x17', () => {
    expect(events).toContainEqual({type: 'dualT1Shift', value: 0x34});
  });

  it('still emits the pre-existing voiceMode/splitPoint/balance/tone/leftTone events (regression)', () => {
    expect(events).toContainEqual({type: 'voiceMode', value: 0x02});
    expect(events).toContainEqual({type: 'splitPoint', value: 0x36});
    expect(events).toContainEqual({type: 'balance', value: 0x40});
    expect(events).toContainEqual({
      type: 'leftTone',
      category: 0x03,
      indexHigh: 0,
      indexLow: 0,
    });
  });

  it('emits a separate dualTone2 event from offsets 0x0D-0x0F', () => {
    expect(events).toContainEqual({
      type: 'dualTone2',
      category: 0x05,
      indexHigh: 0x00,
      indexLow: 0x01,
    });
  });

  // Avoid unused import warnings for buildRQ1 in editors
  void buildRQ1;
});
