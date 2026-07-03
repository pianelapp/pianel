/**
 * T014: Notification parser tests — byte-level assertions.
 *
 * Verifies DT1 echo parsing, Note On/Off, metronome state,
 * unknown address handling, and RQ1 state response decomposition.
 */

import {parseNotification, parseStateResponse} from '../../../src/engine/fp30x/parser';

describe('parseNotification', () => {
  describe('DT1 volume echo', () => {
    it('parses volume 52 from DT1 echo', () => {
      // Raw SysEx: F0 41 10 00 00 00 28 12 01 00 02 13 34 36 F7
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x13, 0x34, 0x36, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'volume', value: 0x34}); // 52
    });

    it('parses volume 127 (max)', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x13, 0x7f, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'volume', value: 127});
    });
  });

  describe('DT1 tone echo', () => {
    it('parses Concert Piano tone change', () => {
      // F0 41 10 00 00 00 28 12 01 00 02 07 00 00 00 76 F7
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x07, 0x00, 0x00, 0x00, 0x76, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'tone', category: 0, indexHigh: 0, indexLow: 0});
    });

    it('parses GM2 Organ 1 (cat=8, idx=36)', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x07, 0x08, 0x00, 0x24, 0x4a, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'tone', category: 8, indexHigh: 0, indexLow: 0x24});
    });
  });

  describe('DT1 tempo echo', () => {
    it('parses tempo 200 BPM from echo address', () => {
      // Echo tempo at 01 00 01 08: 2 bytes
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x08, 0x01, 0x48, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'tempo', bpm: 200});
    });

    it('parses tempo 98 BPM', () => {
      // 98 BPM = byte1=0, byte2=0x62
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x08, 0x00, 0x62, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'tempo', bpm: 98});
    });
  });

  describe('DT1 metronome state echo', () => {
    it('parses metronome ON', () => {
      // Echo metronome state at 01 00 01 0F: value 01
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x0f, 0x01, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'metronomeState', on: true});
    });

    it('parses metronome OFF', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x0f, 0x00, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'metronomeState', on: false});
    });
  });

  describe('DT1 headphones connection echo', () => {
    it('parses disconnected (0x00) as connected:false', () => {
      // Echo headphones at 01 00 01 10: data byte 0x00
      // Checksum: sum = 1+0+1+16+0 = 18; chk = (128-18) % 128 = 110 = 0x6E
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x10, 0x00, 0x6e, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'headphonesConnection', connected: false});
    });

    it('parses connected (0x01) as connected:true', () => {
      // sum = 1+0+1+16+1 = 19; chk = (128-19) % 128 = 109 = 0x6D
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x10, 0x01, 0x6d, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'headphonesConnection', connected: true});
    });

    it('treats any non-zero byte as connected:true (defensive)', () => {
      // Roland's "connected" semantics: anything non-zero counts. Use 0x7F.
      // sum = 1+0+1+16+127 = 145; chk = (128 - 145%128) % 128 = (128-17)%128 = 111 = 0x6F
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x10, 0x7f, 0x6f, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'headphonesConnection', connected: true});
    });

    it('returns null for malformed (empty data) packet', () => {
      // Truncated DT1: header + address + checksum + F7, no data byte.
      // extractDT1Payload requires a minimum payload of 6 bytes; this is 5.
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x01, 0x10, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toBeNull();
    });
  });

  describe('DT1 metronome beat', () => {
    it('parses 4/4 beat', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x1f, 0x03, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'metronomeBeat', value: 3});
    });
  });

  describe('DT1 key touch', () => {
    it('parses Medium key touch', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x1d, 0x03, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'keyTouch', value: 3});
    });
  });

  describe('DT1 voice mode', () => {
    it('parses Split mode', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x00, 0x01, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'voiceMode', value: 1});
    });
  });

  describe('DT1 left tone', () => {
    it('parses left tone change', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x0a, 0x03, 0x00, 0x00, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'leftTone', category: 3, indexHigh: 0, indexLow: 0});
    });
  });

  describe('Note On/Off', () => {
    it('parses Note On C4 velocity 100', () => {
      const bytes = [0x90, 0x3c, 0x64];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'noteOn', note: 60, velocity: 100});
    });

    it('parses Note On with velocity 0 as Note Off', () => {
      const bytes = [0x90, 0x3c, 0x00];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'noteOff', note: 60});
    });

    it('parses Note Off', () => {
      const bytes = [0x80, 0x3c, 0x40];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'noteOff', note: 60});
    });

    it('parses Note On on channel 2 (status 0x91)', () => {
      const bytes = [0x91, 0x40, 0x50];
      const event = parseNotification(bytes);
      expect(event).toEqual({type: 'noteOn', note: 64, velocity: 80});
    });
  });

  describe('DT1 unknown address', () => {
    it('returns unknown event for unrecognized DT1 address', () => {
      // Some unknown address: 01 00 02 0D
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x02, 0x0d, 0x04, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toEqual({
        type: 'unknown',
        address: [0x01, 0x00, 0x02, 0x0d],
        data: [0x04],
      });
    });
  });

  describe('metronome toggle command', () => {
    it('returns null for metronome toggle (command, not state)', () => {
      const bytes = [
        0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
        0x01, 0x00, 0x05, 0x09, 0x00, 0x00, 0xf7,
      ];
      const event = parseNotification(bytes);
      expect(event).toBeNull();
    });
  });

  describe('non-relevant messages', () => {
    it('returns null for empty input', () => {
      expect(parseNotification([])).toBeNull();
    });

    it('returns null for non-DT1 SysEx', () => {
      // GM2 System On
      expect(parseNotification([0xf0, 0x7e, 0x7f, 0x09, 0x03, 0xf7])).toBeNull();
    });
  });

  /**
   * T017: CC/PC echo parser tests.
   *
   * Control Change and Program Change messages echoed from the piano
   * should be parsed into typed events, not silently discarded.
   */

  describe('Control Change parsing', () => {
    it('parses CC volume (controller 7) on channel 0', () => {
      const bytes = [0xb0, 0x07, 0x64]; // CC ch0, controller 7, value 100
      const event = parseNotification(bytes);
      expect(event).not.toBeNull();
      expect(event).toEqual({
        type: 'controlChange',
        channel: 0,
        controller: 7,
        value: 100,
      });
    });

    it('parses CC pan (controller 10) on channel 1', () => {
      const bytes = [0xb1, 0x0a, 0x40]; // CC ch1, controller 10, value 64
      const event = parseNotification(bytes);
      expect(event).not.toBeNull();
      expect(event).toEqual({
        type: 'controlChange',
        channel: 1,
        controller: 10,
        value: 64,
      });
    });
  });

  describe('Program Change parsing', () => {
    it('parses Program Change on channel 0', () => {
      const bytes = [0xc0, 0x05]; // PC ch0, program 5
      const event = parseNotification(bytes);
      expect(event).not.toBeNull();
      expect(event).toEqual({
        type: 'programChange',
        channel: 0,
        program: 5,
      });
    });

    it('parses Program Change on channel 2', () => {
      const bytes = [0xc2, 0x10]; // PC ch2, program 16
      const event = parseNotification(bytes);
      expect(event).not.toBeNull();
      expect(event).toEqual({
        type: 'programChange',
        channel: 2,
        program: 16,
      });
    });
  });
});

describe('parseStateResponse', () => {
  it('decomposes performance block into individual events', () => {
    // Simulate RQ1 response for performance block (01 00 02 00, 32+ bytes)
    const address = [0x01, 0x00, 0x02, 0x00];
    const data = new Array(0x24).fill(0);
    // Voice mode = Single (0)
    data[0x00] = 0x00;
    // Split point = F#3 (54)
    data[0x01] = 0x36;
    // Balance = center (64)
    data[0x03] = 0x40;
    // Tone = Concert Piano (0, 0, 0)
    data[0x07] = 0x00;
    data[0x08] = 0x00;
    data[0x09] = 0x00;
    // Left tone = Epic Strings (3, 0, 0)
    data[0x0a] = 0x03;
    data[0x0b] = 0x00;
    data[0x0c] = 0x00;
    // Volume = 100
    data[0x13] = 0x64;
    // Key touch = Medium (3)
    data[0x1d] = 0x03;
    // Metronome beat = 4/4 (3)
    data[0x1f] = 0x03;
    // Metronome pattern = Off (0)
    data[0x20] = 0x00;
    // Metronome volume = 5
    data[0x21] = 0x05;
    // Metronome tone = Click (0)
    data[0x22] = 0x00;

    // Build raw SysEx
    const checksumInput = [...address, ...data];
    let sum = 0;
    for (const b of checksumInput) sum += b;
    const checksum = (128 - (sum % 128)) % 128;
    const rawBytes = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      ...address, ...data, checksum, 0xf7,
    ];

    const events = parseStateResponse(rawBytes);

    expect(events).toContainEqual({type: 'voiceMode', value: 0});
    expect(events).toContainEqual({type: 'splitPoint', value: 54});
    expect(events).toContainEqual({type: 'balance', value: 64});
    expect(events).toContainEqual({type: 'tone', category: 0, indexHigh: 0, indexLow: 0});
    expect(events).toContainEqual({type: 'leftTone', category: 3, indexHigh: 0, indexLow: 0});
    expect(events).toContainEqual({type: 'volume', value: 100});
    expect(events).toContainEqual({type: 'keyTouch', value: 3});
    expect(events).toContainEqual({type: 'metronomeBeat', value: 3});
    expect(events).toContainEqual({type: 'metronomePattern', value: 0});
    expect(events).toContainEqual({type: 'metronomeVolume', value: 5});
    expect(events).toContainEqual({type: 'metronomeTone', value: 0});
  });

  it('emits headphonesConnection event when a single-byte echo at 01 00 01 10 is received', () => {
    // RQ1 reply for headphones echo: address 01 00 01 10, 1 data byte = 0x01 (connected).
    const address = [0x01, 0x00, 0x01, 0x10];
    const data = [0x01];
    const checksumInput = [...address, ...data];
    let sum = 0;
    for (const b of checksumInput) sum += b;
    const checksum = (128 - (sum % 128)) % 128;
    const rawBytes = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      ...address, ...data, checksum, 0xf7,
    ];

    const events = parseStateResponse(rawBytes);
    expect(events).toContainEqual({type: 'headphonesConnection', connected: true});
  });

  it('emits headphonesConnection:false for a 0x00 echo at 01 00 01 10', () => {
    const address = [0x01, 0x00, 0x01, 0x10];
    const data = [0x00];
    const checksumInput = [...address, ...data];
    let sum = 0;
    for (const b of checksumInput) sum += b;
    const checksum = (128 - (sum % 128)) % 128;
    const rawBytes = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      ...address, ...data, checksum, 0xf7,
    ];

    const events = parseStateResponse(rawBytes);
    expect(events).toContainEqual({type: 'headphonesConnection', connected: false});
  });

  it('decomposes tempo block response', () => {
    // Tempo block at 01 00 03 09, 2 bytes: 200 BPM
    const address = [0x01, 0x00, 0x03, 0x09];
    const data = [0x01, 0x48]; // 200 BPM
    const checksumInput = [...address, ...data];
    let sum = 0;
    for (const b of checksumInput) sum += b;
    const checksum = (128 - (sum % 128)) % 128;
    const rawBytes = [
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      ...address, ...data, checksum, 0xf7,
    ];

    const events = parseStateResponse(rawBytes);
    expect(events).toContainEqual({type: 'tempo', bpm: 200});
  });

  it('returns empty array for non-DT1 input', () => {
    expect(parseStateResponse([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])).toEqual([]);
  });
});

// T017 (A7): CC/PC echo handling tests
describe('parseNotification CC/PC echoes', () => {
  it('parses CC volume (controller 7) on channel 0', () => {
    const event = parseNotification([0xb0, 0x07, 0x64]);
    expect(event).toEqual({type: 'controlChange', channel: 0, controller: 7, value: 100});
  });

  it('parses CC pan (controller 10) on channel 1', () => {
    const event = parseNotification([0xb1, 0x0a, 0x40]);
    expect(event).toEqual({type: 'controlChange', channel: 1, controller: 10, value: 64});
  });

  it('parses Program Change on channel 0', () => {
    const event = parseNotification([0xc0, 0x05]);
    expect(event).toEqual({type: 'programChange', channel: 0, program: 5});
  });

  it('parses Program Change on channel 2', () => {
    const event = parseNotification([0xc2, 0x10]);
    expect(event).toEqual({type: 'programChange', channel: 2, program: 16});
  });
});
