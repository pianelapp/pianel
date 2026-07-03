/**
 * FP-30X Notification Parser.
 *
 * Parses raw MIDI bytes (after BLE framing is stripped) into typed
 * PianoEvent objects. Handles DT1 echoes, Note On/Off, and
 * running status.
 *
 * Constitution II: Bidirectional Control Surface.
 * Constitution IV: DT1 SysEx Protocol Fidelity.
 */

import type {PianoEvent, DeviceIdentity} from '../../types/types';
import {
  ROLAND_MANUFACTURER_ID,
  FP30X_DEVICE_ID,
  FP30X_MODEL_ID,
  DT1_COMMAND,
  SYSEX_END,
} from './constants';
import {decodeTempo} from './sysex';

/** DT1 header bytes to match: F0 41 10 00 00 00 28 12 */
const DT1_HEADER = [
  0xf0,
  ROLAND_MANUFACTURER_ID,
  FP30X_DEVICE_ID,
  ...FP30X_MODEL_ID,
  DT1_COMMAND,
];

/**
 * Check if bytes starting at offset match the DT1 header.
 */
function matchesDT1Header(bytes: number[], offset: number): boolean {
  if (offset + DT1_HEADER.length > bytes.length) return false;
  for (let i = 0; i < DT1_HEADER.length; i++) {
    if (bytes[offset + i] !== DT1_HEADER[i]) return false;
  }
  return true;
}

/**
 * Compare a 4-byte address from the message against a known address.
 */
function addressEquals(
  msgAddr: number[],
  knownAddr: readonly number[],
): boolean {
  return (
    msgAddr[0] === knownAddr[0] &&
    msgAddr[1] === knownAddr[1] &&
    msgAddr[2] === knownAddr[2] &&
    msgAddr[3] === knownAddr[3]
  );
}

/** Maps echo beat count values (0,2,3,4,5,6) to store index (0-5). */
const BEAT_COUNT_TO_INDEX: Record<number, number> = {
  0: 0, // 0/4
  2: 1, // 2/4
  3: 2, // 3/4
  4: 3, // 4/4
  5: 4, // 5/4
  6: 5, // 6/4
};

/**
 * Parse a DT1 notification into a typed event.
 *
 * @param address 4-byte DT1 address
 * @param data Data bytes following the address (before checksum)
 */
function parseDT1Event(
  address: number[],
  data: number[],
): PianoEvent | null {
  // Tone change: 01 00 02 07 + 3 bytes (category, indexHigh, indexLow)
  if (
    address[0] === 0x01 &&
    address[1] === 0x00 &&
    address[2] === 0x02 &&
    address[3] === 0x07 &&
    data.length >= 3
  ) {
    return {
      type: 'tone',
      category: data[0],
      indexHigh: data[1],
      indexLow: data[2],
    };
  }

  // Split Lower tone change: 01 00 02 0A + 3 bytes
  if (
    address[0] === 0x01 &&
    address[1] === 0x00 &&
    address[2] === 0x02 &&
    address[3] === 0x0a &&
    data.length >= 3
  ) {
    return {
      type: 'leftTone',
      category: data[0],
      indexHigh: data[1],
      indexLow: data[2],
    };
  }

  // Dual Tone 2 change: 01 00 02 0D + 3 bytes
  if (
    address[0] === 0x01 &&
    address[1] === 0x00 &&
    address[2] === 0x02 &&
    address[3] === 0x0d &&
    data.length >= 3
  ) {
    return {
      type: 'dualTone2',
      category: data[0],
      indexHigh: data[1],
      indexLow: data[2],
    };
  }

  // Volume: 01 00 02 13
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x13]) && data.length >= 1) {
    return {type: 'volume', value: data[0]};
  }

  // Voice mode: 01 00 02 00
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x00]) && data.length >= 1) {
    return {type: 'voiceMode', value: data[0]};
  }

  // Split point: 01 00 02 01
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x01]) && data.length >= 1) {
    return {type: 'splitPoint', value: data[0]};
  }

  // Split Balance: 01 00 02 03
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x03]) && data.length >= 1) {
    return {type: 'balance', value: data[0]};
  }

  // Dual Balance: 01 00 02 05 (separate register from Split)
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x05]) && data.length >= 1) {
    return {type: 'dualBalance', value: data[0]};
  }

  // Split — Left Shift: 01 00 02 02
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x02]) && data.length >= 1) {
    return {type: 'splitLeftShift', value: data[0]};
  }

  // Dual — Tone 2 Shift: 01 00 02 04
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x04]) && data.length >= 1) {
    return {type: 'dualT2Shift', value: data[0]};
  }

  // Twin Pair/Individual: 01 00 02 06
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x06]) && data.length >= 1) {
    return {type: 'twinMode', value: data[0]};
  }

  // Split — Right Shift: 01 00 02 16
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x16]) && data.length >= 1) {
    return {type: 'splitRightShift', value: data[0]};
  }

  // Dual — Tone 1 Shift: 01 00 02 17
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x17]) && data.length >= 1) {
    return {type: 'dualT1Shift', value: data[0]};
  }

  // Key touch: 01 00 02 1D
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x1d]) && data.length >= 1) {
    return {type: 'keyTouch', value: data[0]};
  }

  // Metronome beat: 01 00 02 1F
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x1f]) && data.length >= 1) {
    return {type: 'metronomeBeat', value: data[0]};
  }

  // Metronome pattern: 01 00 02 20
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x20]) && data.length >= 1) {
    return {type: 'metronomePattern', value: data[0]};
  }

  // Metronome volume: 01 00 02 21
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x21]) && data.length >= 1) {
    return {type: 'metronomeVolume', value: data[0]};
  }

  // Metronome tone: 01 00 02 22
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x22]) && data.length >= 1) {
    return {type: 'metronomeTone', value: data[0]};
  }

  // Transpose: 01 00 03 07
  if (addressEquals(address, [0x01, 0x00, 0x03, 0x07]) && data.length >= 1) {
    return {type: 'transpose', value: data[0]};
  }

  // Tempo: 01 00 03 09 + 2 bytes
  if (addressEquals(address, [0x01, 0x00, 0x03, 0x09]) && data.length >= 2) {
    return {type: 'tempo', bpm: decodeTempo(data[0], data[1])};
  }

  // Echo addresses (read-only mirrors — same events, different addresses)

  // Echo metronome state: 01 00 01 0F
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x0f]) && data.length >= 1) {
    return {type: 'metronomeState', on: data[0] === 0x01};
  }

  // Echo headphones connection: 01 00 01 10
  // Roland's wire-format uses 0x00 for "disconnected"; any non-zero byte is
  // treated as connected (matches the safest interpretation of the protocol).
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x10]) && data.length >= 1) {
    return {type: 'headphonesConnection', connected: data[0] !== 0x00};
  }

  // Echo tempo: 01 00 01 08
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x08]) && data.length >= 2) {
    return {type: 'tempo', bpm: decodeTempo(data[0], data[1])};
  }

  // Echo transpose: 01 00 01 01
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x01]) && data.length >= 1) {
    return {type: 'transpose', value: data[0]};
  }

  // Echo metronome beat count: 01 00 01 0A — uses beat count encoding, not index
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x0a]) && data.length >= 1) {
    const index = BEAT_COUNT_TO_INDEX[data[0]];
    if (index === undefined) return null;
    return {type: 'metronomeBeat', value: index};
  }

  // Metronome toggle: 01 00 05 09 — ignore (it's the command, not state)
  if (addressEquals(address, [0x01, 0x00, 0x05, 0x09])) {
    return null;
  }

  // Unknown DT1 address
  return {type: 'unknown', address: [...address], data: [...data]};
}

/**
 * Extract DT1 payload from raw SysEx bytes.
 *
 * Finds the DT1 header, collects all bytes with bit 7 clear
 * (skipping BLE timestamps that may be interleaved) until F7.
 *
 * Returns [address(4), ...data, checksum] or null if not a valid DT1.
 */
function extractDT1Payload(
  bytes: number[],
): {address: number[]; data: number[]} | null {
  // Find DT1 header start
  let headerStart = -1;
  for (let i = 0; i <= bytes.length - DT1_HEADER.length; i++) {
    if (matchesDT1Header(bytes, i)) {
      headerStart = i;
      break;
    }
  }
  if (headerStart === -1) return null;

  // Collect data bytes after header (skip any bytes with bit 7 set — BLE timestamps)
  const payloadStart = headerStart + DT1_HEADER.length;
  const payload: number[] = [];
  for (let i = payloadStart; i < bytes.length; i++) {
    if (bytes[i] === SYSEX_END) break;
    // Skip bytes with bit 7 set (BLE MIDI timestamps)
    if ((bytes[i] & 0x80) !== 0) continue;
    payload.push(bytes[i]);
  }

  // Minimum: 4 address bytes + 1 data byte + 1 checksum = 6
  if (payload.length < 6) return null;

  const address = payload.slice(0, 4);
  // Data is everything between address and checksum (last byte)
  const data = payload.slice(4, payload.length - 1);

  return {address, data};
}

/**
 * Detect an alive-check reply from raw SysEx bytes.
 *
 * The FP-30X answers an RQ1 to 01 00 08 01 with a DT1 to the same
 * address carrying a single data byte 0x00. Used by ConnectionService
 * (via FP30XEngine.isAliveReply) to intercept heartbeat replies before
 * they reach the normal notification dispatch — they're plumbing, not
 * user-visible state.
 */
export function isAliveReply(rawMidiBytes: number[]): boolean {
  const payload = extractDT1Payload(rawMidiBytes);
  if (!payload) return false;
  if (!addressEquals(payload.address, [0x01, 0x00, 0x08, 0x01])) return false;
  return payload.data.length === 1 && payload.data[0] === 0x00;
}

/**
 * Parse a single raw MIDI/SysEx notification from the piano.
 *
 * The input is raw bytes AFTER BLE MIDI framing is stripped
 * (no BLE header/timestamp bytes — just MIDI content).
 *
 * Returns null if the message is not relevant.
 */
export function parseNotification(
  rawMidiBytes: number[],
): PianoEvent | null {
  if (rawMidiBytes.length === 0) return null;

  const status = rawMidiBytes[0];

  // Note On: 0x9n (channel n)
  if ((status & 0xf0) === 0x90 && rawMidiBytes.length >= 3) {
    const note = rawMidiBytes[1];
    const velocity = rawMidiBytes[2];
    // Note On with velocity 0 = Note Off
    if (velocity === 0) {
      return {type: 'noteOff', note};
    }
    return {type: 'noteOn', note, velocity};
  }

  // Note Off: 0x8n (channel n)
  if ((status & 0xf0) === 0x80 && rawMidiBytes.length >= 3) {
    return {type: 'noteOff', note: rawMidiBytes[1]};
  }

  // SysEx: starts with F0
  if (status === 0xf0) {
    const dt1 = extractDT1Payload(rawMidiBytes);
    if (dt1) {
      return parseDT1Event(dt1.address, dt1.data);
    }
    // Non-DT1 SysEx (identity reply, GM system on, etc.) — ignore
    return null;
  }

  // T020 (A7): Control Change: 0xBn (channel n) — 3 bytes
  if ((status & 0xf0) === 0xb0 && rawMidiBytes.length >= 3) {
    return {
      type: 'controlChange',
      channel: status & 0x0f,
      controller: rawMidiBytes[1],
      value: rawMidiBytes[2],
    };
  }

  // T020 (A7): Program Change: 0xCn (channel n) — 2 bytes
  if ((status & 0xf0) === 0xc0 && rawMidiBytes.length >= 2) {
    return {
      type: 'programChange',
      channel: status & 0x0f,
      program: rawMidiBytes[1],
    };
  }

  // Other MIDI messages — ignore
  return null;
}

/**
 * Parse an RQ1 response (DT1 containing bulk requested data).
 *
 * Used to populate initial state on connect. The response is a DT1
 * with the requested address and all data bytes in sequence.
 *
 * Decomposes the block into individual parameter events.
 */
export function parseStateResponse(
  rawMidiBytes: number[],
): PianoEvent[] {
  const events: PianoEvent[] = [];
  const dt1 = extractDT1Payload(rawMidiBytes);
  if (!dt1) return events;

  const {address, data} = dt1;

  // Performance block response: 01 00 02 00
  if (addressEquals(address, [0x01, 0x00, 0x02, 0x00]) && data.length >= 0x20) {
    // Voice mode at offset 0x00
    events.push({type: 'voiceMode', value: data[0x00]});
    // Split point at offset 0x01
    events.push({type: 'splitPoint', value: data[0x01]});
    // Split — Left Shift at offset 0x02
    events.push({type: 'splitLeftShift', value: data[0x02]});
    // Balance at offset 0x03
    events.push({type: 'balance', value: data[0x03]});
    // Dual — Tone 2 Shift at offset 0x04
    events.push({type: 'dualT2Shift', value: data[0x04]});
    // Dual Balance at offset 0x05 (separate from Split Balance at 0x03)
    events.push({type: 'dualBalance', value: data[0x05]});
    // Twin Pair/Individual at offset 0x06
    events.push({type: 'twinMode', value: data[0x06]});
    // Tone (right/single) at offsets 0x07, 0x08, 0x09
    events.push({
      type: 'tone',
      category: data[0x07],
      indexHigh: data[0x08],
      indexLow: data[0x09],
    });
    // Split Lower tone at offsets 0x0A, 0x0B, 0x0C
    events.push({
      type: 'leftTone',
      category: data[0x0a],
      indexHigh: data[0x0b],
      indexLow: data[0x0c],
    });
    // Dual Tone 2 at offsets 0x0D, 0x0E, 0x0F (separate from Split Lower)
    events.push({
      type: 'dualTone2',
      category: data[0x0d],
      indexHigh: data[0x0e],
      indexLow: data[0x0f],
    });
    // Volume at offset 0x13
    events.push({type: 'volume', value: data[0x13]});
    // Split — Right Shift at offset 0x16
    events.push({type: 'splitRightShift', value: data[0x16]});
    // Dual — Tone 1 Shift at offset 0x17
    events.push({type: 'dualT1Shift', value: data[0x17]});
    // Key touch at offset 0x1D
    events.push({type: 'keyTouch', value: data[0x1d]});
    // Metronome beat at offset 0x1F
    events.push({type: 'metronomeBeat', value: data[0x1f]});

    // Extended block (if present)
    if (data.length > 0x20) {
      events.push({type: 'metronomePattern', value: data[0x20]});
    }
    if (data.length > 0x21) {
      events.push({type: 'metronomeVolume', value: data[0x21]});
    }
    if (data.length > 0x22) {
      events.push({type: 'metronomeTone', value: data[0x22]});
    }
  }

  // Tempo block response — write target: 01 00 03 09
  if (addressEquals(address, [0x01, 0x00, 0x03, 0x09]) && data.length >= 2) {
    events.push({type: 'tempo', bpm: decodeTempo(data[0], data[1])});
  }

  // Tempo block response — echo mirror: 01 00 01 08 (preferred for RQ1)
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x08]) && data.length >= 2) {
    events.push({type: 'tempo', bpm: decodeTempo(data[0], data[1])});
  }

  // Transpose block response — write target: 01 00 03 07
  if (addressEquals(address, [0x01, 0x00, 0x03, 0x07]) && data.length >= 1) {
    events.push({type: 'transpose', value: data[0]});
  }

  // Transpose block response — echo mirror: 01 00 01 01 (preferred for RQ1)
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x01]) && data.length >= 1) {
    events.push({type: 'transpose', value: data[0]});
  }

  // Metronome state response: 01 00 01 0F (echo mirror — 0x00=off, 0x01=on)
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x0f]) && data.length >= 1) {
    events.push({type: 'metronomeState', on: data[0] === 0x01});
  }

  // Headphones connection response: 01 00 01 10 (echo mirror — 0x00=disconnected, non-zero=connected)
  if (addressEquals(address, [0x01, 0x00, 0x01, 0x10]) && data.length >= 1) {
    events.push({type: 'headphonesConnection', connected: data[0] !== 0x00});
  }

  return events;
}

/**
 * Parse a Universal SysEx Identity Reply into a DeviceIdentity.
 *
 * Expected format: F0 7E <deviceId> 06 02 <mfr> <fc1> <fc2> <fm1> <fm2> <ver...> F7
 * Example FP-30X: F0 7E 10 06 02 41 19 03 00 00 1C 01 00 00 F7
 *
 * Returns null if the bytes are not a valid Identity Reply.
 */
export function parseIdentityReply(rawMidiBytes: number[]): DeviceIdentity | null {
  // Strip any BLE timestamp bytes (bit 7 set, not F0/F7)
  const bytes = rawMidiBytes.filter(
    (b, i) => i === 0 || b === SYSEX_END || (b & 0x80) === 0 || b === 0xf0,
  );

  // Minimum: F0 7E <dev> 06 02 <mfr> <fc1> <fc2> <fm1> <fm2> F7 = 11 bytes
  if (bytes.length < 11) return null;
  if (bytes[0] !== 0xf0 || bytes[1] !== 0x7e) return null;
  if (bytes[3] !== 0x06 || bytes[4] !== 0x02) return null;

  const deviceId = bytes[2];
  const manufacturerId = bytes[5];
  const familyCode: [number, number] = [bytes[6], bytes[7]];
  const modelId = [bytes[8], bytes[9]];

  // Firmware bytes (if present, up to 4 bytes before F7)
  let firmware: string | undefined;
  if (bytes.length >= 14) {
    firmware = `${bytes[10]}.${bytes[11]}.${bytes[12]}.${bytes[13]}`;
  }

  return {manufacturerId, deviceId, familyCode, modelId, firmware};
}
