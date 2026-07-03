/**
 * BLE MIDI Packet Framing for react-native-ble-plx.
 *
 * Wraps raw MIDI messages in BLE MIDI packet format for writing,
 * and strips BLE framing from incoming notifications.
 *
 * BLE MIDI spec: Apple Bluetooth MIDI accessory spec.
 * Constitution IV: DT1 SysEx Protocol Fidelity.
 */

/**
 * Get the current BLE MIDI timestamp (13-bit, millisecond-based).
 * Uses the lower 13 bits of the current time in ms.
 */
function getTimestamp(): {header: number; timestamp: number} {
  const now = Date.now() & 0x1fff; // 13-bit
  const header = 0x80 | ((now >> 7) & 0x3f);
  const timestamp = 0x80 | (now & 0x7f);
  return {header, timestamp};
}

/**
 * Wrap a single raw MIDI message in a BLE MIDI packet.
 *
 * Standard: [Header] [Timestamp] [MIDI data...]
 * SysEx:    [Header] [Timestamp] [F0] [payload...] [Timestamp] [F7]
 *
 * @param midiData Raw MIDI bytes (e.g., [0xF0, ...payload, 0xF7] for SysEx)
 * @returns BLE MIDI packet as number array
 */
export function wrapInBleMidiPacket(midiData: number[]): number[] {
  const {header, timestamp} = getTimestamp();

  if (midiData[0] === 0xf0 && midiData[midiData.length - 1] === 0xf7) {
    // SysEx: Header, Timestamp, F0, body, EndTimestamp, F7
    const sysexBody = midiData.slice(1, -1);
    const endTimestamp = 0x80 | (Date.now() & 0x7f);
    return [header, timestamp, 0xf0, ...sysexBody, endTimestamp, 0xf7];
  }

  return [header, timestamp, ...midiData];
}

/**
 * Wrap multiple MIDI messages into a single BLE MIDI packet.
 *
 * Per BLE MIDI spec, multiple messages share a single header byte,
 * each with their own timestamp byte.
 *
 * @param messages Array of raw MIDI messages
 * @returns Single BLE MIDI packet containing all messages
 */
export function wrapMultipleInBleMidiPacket(messages: number[][]): number[] {
  const {header} = getTimestamp();
  const result: number[] = [header];

  for (const msg of messages) {
    const msgTimestamp = 0x80 | (Date.now() & 0x7f);

    if (msg[0] === 0xf0 && msg[msg.length - 1] === 0xf7) {
      const sysexBody = msg.slice(1, -1);
      const endTimestamp = 0x80 | (Date.now() & 0x7f);
      result.push(msgTimestamp, 0xf0, ...sysexBody, endTimestamp, 0xf7);
    } else {
      result.push(msgTimestamp, ...msg);
    }
  }

  return result;
}

/**
 * Strip BLE MIDI framing from an incoming notification.
 *
 * Extracts raw MIDI bytes by removing the header byte and timestamp bytes.
 * Handles both standard messages and SysEx with embedded timestamps.
 *
 * @param blePacket Raw bytes from BLE notification
 * @returns Array of raw MIDI messages (each is a complete message)
 */
export function stripBleFraming(blePacket: number[]): number[][] {
  if (blePacket.length < 3) return [];

  const messages: number[][] = [];
  let i = 1; // Skip header byte
  let lastStatusByte = 0;

  while (i < blePacket.length) {
    // Skip timestamp byte
    if (i < blePacket.length && (blePacket[i] & 0x80) !== 0) {
      i++;
    }

    if (i >= blePacket.length) break;

    // SysEx start
    if (blePacket[i] === 0xf0) {
      // T019 (A7): SysEx resets running status
      lastStatusByte = 0;

      const sysex: number[] = [0xf0];
      i++; // skip F0

      while (i < blePacket.length) {
        if (blePacket[i] === 0xf7) {
          sysex.push(0xf7);
          i++;
          break;
        }
        // Skip embedded timestamps (bit 7 set, not F7)
        if ((blePacket[i] & 0x80) !== 0) {
          i++;
          continue;
        }
        sysex.push(blePacket[i]);
        i++;
      }

      if (sysex.length > 1) {
        messages.push(sysex);
      }
    } else if ((blePacket[i] & 0x80) !== 0) {
      // Standard MIDI message with explicit status byte
      const status = blePacket[i];
      const msgType = status & 0xf0;

      // T019 (A7): Save status for running status (channel messages only)
      if (msgType >= 0x80 && msgType <= 0xe0) {
        lastStatusByte = status;
      }

      if (msgType === 0xc0 || msgType === 0xd0) {
        // Program Change / Channel Pressure: 2 bytes
        if (i + 1 < blePacket.length) {
          messages.push([status, blePacket[i + 1]]);
          i += 2;
        } else {
          i++;
        }
      } else if (msgType >= 0x80 && msgType <= 0xe0) {
        // 3-byte messages: Note On/Off, CC, Pitch Bend, etc.
        if (i + 2 < blePacket.length) {
          messages.push([status, blePacket[i + 1], blePacket[i + 2]]);
          i += 3;
        } else {
          i++;
        }
      } else {
        // System messages (0xF0-0xFF) other than SysEx — skip
        i++;
      }
    } else {
      // T019 (A7): Running status — data byte without a status byte
      if (lastStatusByte >= 0x80 && lastStatusByte <= 0xef) {
        const msgType = lastStatusByte & 0xf0;

        if (msgType === 0xc0 || msgType === 0xd0) {
          // 2-byte message: status + 1 data byte
          messages.push([lastStatusByte, blePacket[i]]);
          i += 1;
        } else {
          // 3-byte message: status + 2 data bytes
          if (i + 1 < blePacket.length) {
            messages.push([lastStatusByte, blePacket[i], blePacket[i + 1]]);
            i += 2;
          } else {
            i++;
          }
        }
      } else {
        // No valid running status — skip byte
        i++;
      }
    }
  }

  return messages;
}

/**
 * Convert a base64-encoded string to a byte array.
 * Used for BLE characteristic value decoding.
 */
export function base64ToBytes(base64: string): number[] {
  const binary = atob(base64);
  const bytes: number[] = new Array(binary.length);
  for (let j = 0; j < binary.length; j++) {
    bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
}

/**
 * Convert a byte array to a base64-encoded string.
 * Used for BLE characteristic value encoding.
 */
export function bytesToBase64(bytes: number[]): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
