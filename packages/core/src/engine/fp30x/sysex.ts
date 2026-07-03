/**
 * Roland DT1/RQ1 SysEx Message Builders for FP-30X.
 *
 * All byte construction per discovery doc Section 4 + Appendix A.
 * Constitution IV: DT1 SysEx Protocol Fidelity.
 */

import {
  ROLAND_MANUFACTURER_ID,
  FP30X_DEVICE_ID,
  FP30X_MODEL_ID,
  DT1_COMMAND,
  RQ1_COMMAND,
  SYSEX_START,
  SYSEX_END,
  IDENTITY_REQUEST,
} from './constants';

/**
 * Calculate the Roland checksum for a set of data bytes.
 *
 * Roland checksum = (128 - (sum of bytes % 128)) % 128
 *
 * The checksum covers the address bytes + data bytes (NOT the header or F0/F7).
 */
export function rolandChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const b of bytes) {
    sum += b;
  }
  return (128 - (sum % 128)) % 128;
}

/**
 * Build a DT1 (Data Set 1) SysEx message.
 *
 * Format: F0 41 [DevID] [ModelID×4] 12 [Addr×4] [Data...] [Checksum] F7
 *
 * @param address 4-byte DT1 parameter address
 * @param data Data bytes to write
 * @returns Complete SysEx message (F0...F7)
 */
export function buildDT1(
  address: readonly number[],
  data: readonly number[],
): number[] {
  const checksumInput = [...address, ...data];
  const checksum = rolandChecksum(checksumInput);

  return [
    SYSEX_START,
    ROLAND_MANUFACTURER_ID,
    FP30X_DEVICE_ID,
    ...FP30X_MODEL_ID,
    DT1_COMMAND,
    ...address,
    ...data,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Build an RQ1 (Request Data 1) SysEx message.
 *
 * Format: F0 41 [DevID] [ModelID×4] 11 [Addr×4] [Size×4] [Checksum] F7
 *
 * @param address 4-byte start address to read from
 * @param size 4-byte size of data to request
 * @returns Complete SysEx message (F0...F7)
 */
export function buildRQ1(
  address: readonly number[],
  size: readonly number[],
): number[] {
  const checksumInput = [...address, ...size];
  const checksum = rolandChecksum(checksumInput);

  return [
    SYSEX_START,
    ROLAND_MANUFACTURER_ID,
    FP30X_DEVICE_ID,
    ...FP30X_MODEL_ID,
    RQ1_COMMAND,
    ...address,
    ...size,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Build a Universal SysEx Identity Request.
 * Used during connection to verify the device is a compatible piano.
 */
export function buildIdentityRequest(): number[] {
  return [...IDENTITY_REQUEST];
}

/**
 * Encode a BPM value into 2-byte Roland tempo format.
 *
 * Roland uses 7-bit-per-byte encoding:
 *   byte1 = floor(bpm / 128)
 *   byte2 = bpm % 128
 *
 * @param bpm Tempo in beats per minute (20–250)
 * @returns [byte1, byte2]
 */
export function encodeTempo(bpm: number): [number, number] {
  const clamped = Math.max(20, Math.min(250, Math.round(bpm)));
  return [Math.floor(clamped / 128), clamped % 128];
}

/**
 * Decode 2-byte Roland tempo format to BPM.
 *
 * @param byte1 High byte
 * @param byte2 Low byte
 * @returns BPM value
 */
export function decodeTempo(byte1: number, byte2: number): number {
  return byte1 * 128 + byte2;
}
