/** A 4-byte DT1/RQ1 address tuple */
export type DT1Address = readonly [number, number, number, number];

/** DT1 address map for FP-30X (model 0x28) */
export const ADDR = {
  // System info
  FIRMWARE: [0x01, 0x00, 0x00, 0x00] as const,

  // Heartbeat / device-info block (01 00 08 xx)
  ALIVE_CHECK: [0x01, 0x00, 0x08, 0x01] as const,
  ADDRESS_MAP_VERSION: [0x01, 0x00, 0x08, 0x00] as const,

  // Performance parameters (01 00 02 xx)
  VOICE_MODE: [0x01, 0x00, 0x02, 0x00] as const,
  SPLIT_POINT: [0x01, 0x00, 0x02, 0x01] as const,
  SPLIT_LEFT_SHIFT: [0x01, 0x00, 0x02, 0x02] as const,
  // Split balance lives here. Dual balance is a SEPARATE register at 0x05.
  // Verified from Bluetooth capture of Roland Piano App: writes go to 0x03 in
  // Split mode, 0x05 in Dual mode; the piano stores them independently.
  // (Kept as `BALANCE` for back-compat with earlier code; semantically it's
  // SPLIT_BALANCE.)
  BALANCE: [0x01, 0x00, 0x02, 0x03] as const,
  DUAL_TONE2_SHIFT: [0x01, 0x00, 0x02, 0x04] as const,
  DUAL_BALANCE: [0x01, 0x00, 0x02, 0x05] as const,
  TWIN_MODE: [0x01, 0x00, 0x02, 0x06] as const,
  TONE_CATEGORY: [0x01, 0x00, 0x02, 0x07] as const,
  TONE_INDEX_HIGH: [0x01, 0x00, 0x02, 0x08] as const,
  TONE_INDEX_LOW: [0x01, 0x00, 0x02, 0x09] as const,
  LEFT_TONE_CATEGORY: [0x01, 0x00, 0x02, 0x0a] as const,
  LEFT_TONE_INDEX_HIGH: [0x01, 0x00, 0x02, 0x0b] as const,
  LEFT_TONE_INDEX_LOW: [0x01, 0x00, 0x02, 0x0c] as const,
  // Dual Tone 2 lives at 0x0D, NOT 0x0A — verified from Roland Piano App 1.5.9
  // APK reverse-engineering (`toneForDual` in midiConnector.js).
  DUAL_TONE2_CATEGORY: [0x01, 0x00, 0x02, 0x0d] as const,
  DUAL_TONE2_INDEX_HIGH: [0x01, 0x00, 0x02, 0x0e] as const,
  DUAL_TONE2_INDEX_LOW: [0x01, 0x00, 0x02, 0x0f] as const,
  VOLUME: [0x01, 0x00, 0x02, 0x13] as const,
  SPLIT_RIGHT_SHIFT: [0x01, 0x00, 0x02, 0x16] as const,
  DUAL_TONE1_SHIFT: [0x01, 0x00, 0x02, 0x17] as const,
  KEY_TOUCH: [0x01, 0x00, 0x02, 0x1d] as const,
  METRONOME_BEAT: [0x01, 0x00, 0x02, 0x1f] as const,
  METRONOME_PATTERN: [0x01, 0x00, 0x02, 0x20] as const,
  METRONOME_VOLUME: [0x01, 0x00, 0x02, 0x21] as const,
  METRONOME_TONE: [0x01, 0x00, 0x02, 0x22] as const,

  // Control parameters (01 00 03 xx)
  TRANSPOSE: [0x01, 0x00, 0x03, 0x07] as const,
  TEMPO: [0x01, 0x00, 0x03, 0x09] as const,

  // Utility toggles (01 00 05 xx)
  METRONOME_TOGGLE: [0x01, 0x00, 0x05, 0x09] as const,

  // Session unlock writes (see docs/cold-boot-dt1-unlock.md).
  // On cold boot the FP-30X ignores DT1 parameter writes until a specific
  // unlock sequence is sent. Captured from Roland Piano App handshake.
  SESSION_UNLOCK_A: [0x01, 0x00, 0x03, 0x06] as const,
  SESSION_UNLOCK_B: [0x01, 0x00, 0x03, 0x00] as const,

  // Read-only status mirror (01 00 01 xx) - for notification parsing
  ECHO_TRANSPOSE: [0x01, 0x00, 0x01, 0x01] as const,
  ECHO_TEMPO: [0x01, 0x00, 0x01, 0x08] as const,
  ECHO_METRONOME_BEAT: [0x01, 0x00, 0x01, 0x0a] as const,
  ECHO_METRONOME_STATE: [0x01, 0x00, 0x01, 0x0f] as const,
  ECHO_HEADPHONES_CONNECTION: [0x01, 0x00, 0x01, 0x10] as const,
} as const;

/** Performance parameter block start address (for RQ1 bulk read) */
export const PERFORMANCE_BLOCK_ADDR = [0x01, 0x00, 0x02, 0x00] as const;
/** Performance block size: 36 bytes (0x00 through 0x23) */
export const PERFORMANCE_BLOCK_SIZE = [0x00, 0x00, 0x00, 0x24] as const;

/**
 * Tempo block address (for RQ1 read).
 *
 * Reads target the echo mirror at `01 00 01 08`, NOT the write target at
 * `01 00 03 09`. The write target only reflects what the controller last
 * wrote — on a fresh boot with no writes yet, it returns `00 00` (BPM 0).
 * The echo mirror always reflects the piano's actual current tempo.
 */
export const TEMPO_BLOCK_ADDR = [0x01, 0x00, 0x01, 0x08] as const;
/** Tempo block size: 2 bytes */
export const TEMPO_BLOCK_SIZE = [0x00, 0x00, 0x00, 0x02] as const;

/**
 * Transpose block address (for RQ1 read).
 *
 * Reads target the echo mirror at `01 00 01 01`, NOT the write target at
 * `01 00 03 07`. Same rationale as TEMPO_BLOCK_ADDR.
 */
export const TRANSPOSE_BLOCK_ADDR = [0x01, 0x00, 0x01, 0x01] as const;
/** Transpose block size: 1 byte */
export const TRANSPOSE_BLOCK_SIZE = [0x00, 0x00, 0x00, 0x01] as const;

/** Metronome state address (for RQ1 read — echo/status mirror) */
export const METRONOME_STATE_ADDR = [0x01, 0x00, 0x01, 0x0f] as const;
/** Metronome state size: 1 byte (0x00=off, 0x01=on) */
export const METRONOME_STATE_SIZE = [0x00, 0x00, 0x00, 0x01] as const;

/** Headphones connection address (for RQ1 read — echo/status mirror at `01 00 01 10`) */
export const HEADPHONES_CONNECTION_ADDR = [0x01, 0x00, 0x01, 0x10] as const;
/** Headphones connection size: 1 byte (0x00=disconnected, non-zero=connected) */
export const HEADPHONES_CONNECTION_SIZE = [0x00, 0x00, 0x00, 0x01] as const;

/** Alive-check block size: 1 byte. The piano always replies `0x00`. */
export const ALIVE_CHECK_SIZE = [0x00, 0x00, 0x00, 0x01] as const;
