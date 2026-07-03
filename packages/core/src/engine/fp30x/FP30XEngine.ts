/**
 * FP-30X Piano Engine Implementation.
 *
 * Implements the PianoEngine interface for the Roland FP-30X.
 * Encapsulates all FP-30X-specific protocol knowledge: DT1/RQ1 builders,
 * notification parser, and tone catalog.
 *
 * Constitution V: Layered Architecture with Engine Abstraction.
 */

import type {PianoEngine} from '../IPianoEngine';
import type {
  Tone,
  ToneCatalog,
  PianoEvent,
  DeviceIdentity,
} from '../../types/types';
import {encodeShift} from '../../helpers/voicingMode';
import type {ShiftTarget} from '../../types/voicingMode';
import {buildDT1, buildRQ1, buildIdentityRequest, encodeTempo} from './sysex';
import {parseNotification, parseStateResponse, isAliveReply} from './parser';
import {fp30xToneCatalog} from './tones';
import {
  ADDR,
  PERFORMANCE_BLOCK_ADDR,
  PERFORMANCE_BLOCK_SIZE,
  TEMPO_BLOCK_ADDR,
  TEMPO_BLOCK_SIZE,
  TRANSPOSE_BLOCK_ADDR,
  TRANSPOSE_BLOCK_SIZE,
  METRONOME_STATE_ADDR,
  METRONOME_STATE_SIZE,
  ALIVE_CHECK_SIZE,
  HEADPHONES_CONNECTION_ADDR,
  HEADPHONES_CONNECTION_SIZE,
} from './addresses';
import {
  FP30X_FAMILY_CODE,
  FP30X_MODEL_NAME,
  ROLAND_MANUFACTURER_ID,
} from './constants';

const SHIFT_ADDR: Readonly<Record<ShiftTarget, readonly number[]>> = {
  'split-left': ADDR.SPLIT_LEFT_SHIFT,
  'split-right': ADDR.SPLIT_RIGHT_SHIFT,
  'dual-tone1': ADDR.DUAL_TONE1_SHIFT,
  'dual-tone2': ADDR.DUAL_TONE2_SHIFT,
};

export class FP30XEngine implements PianoEngine {
  readonly modelName = FP30X_MODEL_NAME;
  readonly tones: ToneCatalog = fp30xToneCatalog;

  buildToneChange(tone: Tone): number[] {
    return buildDT1(ADDR.TONE_CATEGORY, [
      tone.category,
      tone.indexHigh,
      tone.indexLow,
    ]);
  }

  buildVolumeChange(value: number): number[] {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return buildDT1(ADDR.VOLUME, [clamped]);
  }

  buildTempoChange(bpm: number): number[] {
    const [byte1, byte2] = encodeTempo(bpm);
    return buildDT1(ADDR.TEMPO, [byte1, byte2]);
  }

  buildMetronomeToggle(): number[] {
    // FP-30X uses a toggle command: always sends 0x00 to 01 00 05 09
    return buildDT1(ADDR.METRONOME_TOGGLE, [0x00]);
  }

  buildMetronomeParam(
    param: 'beat' | 'pattern' | 'volume' | 'tone',
    value: number,
  ): number[] {
    switch (param) {
      case 'beat':
        return buildDT1(ADDR.METRONOME_BEAT, [value]);
      case 'pattern':
        return buildDT1(ADDR.METRONOME_PATTERN, [value]);
      case 'volume':
        return buildDT1(ADDR.METRONOME_VOLUME, [
          Math.max(0, Math.min(10, value)),
        ]);
      case 'tone':
        return buildDT1(ADDR.METRONOME_TONE, [Math.max(0, Math.min(3, value))]);
    }
  }

  // ─── Phase 3: Split/Dual/Transpose/KeyTouch (T071, T074) ───

  /** Build DT1 to set voice mode (0=Single, 1=Split, 2=Dual, 3=Twin). */
  buildVoiceModeChange(mode: number): number[] {
    return buildDT1(ADDR.VOICE_MODE, [Math.max(0, Math.min(3, mode))]);
  }

  /** Build DT1 to set Split Lower tone (01 00 02 0A). */
  buildLeftToneChange(tone: Tone): number[] {
    return buildDT1(ADDR.LEFT_TONE_CATEGORY, [
      tone.category,
      tone.indexHigh,
      tone.indexLow,
    ]);
  }

  /** Build DT1 to set Dual Tone 2 tone (01 00 02 0D). */
  buildDualTone2Change(tone: Tone): number[] {
    return buildDT1(ADDR.DUAL_TONE2_CATEGORY, [
      tone.category,
      tone.indexHigh,
      tone.indexLow,
    ]);
  }

  /** Build DT1 to set split point (MIDI note number). */
  buildSplitPointChange(note: number): number[] {
    return buildDT1(ADDR.SPLIT_POINT, [Math.max(0, Math.min(127, note))]);
  }

  /** Build DT1 to set Split balance (01 00 02 03). Caller is responsible for
   *  clamping to the Roland-app range (56..72); engine only enforces the wire
   *  byte range (0..127) so external echoes can be parsed faithfully. */
  buildBalanceChange(value: number): number[] {
    return buildDT1(ADDR.BALANCE, [Math.max(0, Math.min(127, value))]);
  }

  /** Build DT1 to set Dual balance (01 00 02 05). Separate register from Split. */
  buildDualBalanceChange(value: number): number[] {
    return buildDT1(ADDR.DUAL_BALANCE, [Math.max(0, Math.min(127, value))]);
  }

  /** Build DT1 to set keyboard transpose (center=64, range 58-69 = -6 to +5). */
  buildTransposeChange(value: number): number[] {
    return buildDT1(ADDR.TRANSPOSE, [Math.max(58, Math.min(69, value))]);
  }

  /** Build DT1 to set key touch (0=Fix, 1=SuperLight, 2=Light, 3=Medium, 4=Heavy, 5=SuperHeavy). */
  buildKeyTouchChange(level: number): number[] {
    return buildDT1(ADDR.KEY_TOUCH, [Math.max(0, Math.min(5, level))]);
  }

  /** Build DT1 to set a voicing-mode shift parameter (64-offset octave encoding). */
  buildShiftChange(target: ShiftTarget, octaves: number): number[] {
    const addr = SHIFT_ADDR[target];
    return buildDT1(addr, [encodeShift(octaves)]);
  }

  /** Build DT1 to set Twin pair/individual (01 00 02 06). App always calls 'pair'. */
  buildTwinModeSet(mode: 'pair' | 'individual'): number[] {
    return buildDT1(ADDR.TWIN_MODE, [mode === 'pair' ? 0x00 : 0x01]);
  }

  /**
   * Cold-boot DT1 unlock. The FP-30X ignores DT1 parameter writes after a
   * fresh power-on until this sequence is sent, and a second write is required
   * to enable bidirectional echo (physical button → BLE notification).
   *
   * Ship 3 (current): two writes.
   *   01 00 03 06 = 01      — enables DT1 parameter writes
   *   01 00 03 00 = 00 01   — enables echo notifications for physical actions
   *                           (tempo +/-, metronome button, tone buttons)
   *
   * Both verified against the Roland Piano App handshake.
   * See docs/cold-boot-dt1-unlock.md.
   */
  buildSessionUnlock(): number[][] {
    return [
      buildDT1(ADDR.SESSION_UNLOCK_A, [0x01]),
      buildDT1(ADDR.SESSION_UNLOCK_B, [0x00, 0x01]),
    ];
  }

  /**
   * Build the alive-check RQ1.
   *
   * Targets `01 00 08 01`; the piano always replies with a DT1 to the same
   * address carrying `data = [0x00]`. Used by ConnectionService as a
   * heartbeat.
   */
  buildAliveCheck(): number[] {
    return buildRQ1(ADDR.ALIVE_CHECK, ALIVE_CHECK_SIZE);
  }

  isAliveReply(rawMidiBytes: number[]): boolean {
    return isAliveReply(rawMidiBytes);
  }

  buildInitialStateRequest(): number[][] {
    return [
      // Performance block: voice mode, tones, volume, key touch, metronome params
      buildRQ1(PERFORMANCE_BLOCK_ADDR, PERFORMANCE_BLOCK_SIZE),
      // Tempo block: 2-byte tempo
      buildRQ1(TEMPO_BLOCK_ADDR, TEMPO_BLOCK_SIZE),
      // Transpose: 1 byte
      buildRQ1(TRANSPOSE_BLOCK_ADDR, TRANSPOSE_BLOCK_SIZE),
      // Metronome state: 1 byte (on/off from echo mirror 01 00 01 0F)
      buildRQ1(METRONOME_STATE_ADDR, METRONOME_STATE_SIZE),
      // Headphones connection: 1 byte from echo mirror 01 00 01 10
      buildRQ1(HEADPHONES_CONNECTION_ADDR, HEADPHONES_CONNECTION_SIZE),
    ];
  }

  buildIdentityRequest(): number[] {
    return buildIdentityRequest();
  }

  parseNotification(rawMidiBytes: number[]): PianoEvent | null {
    return parseNotification(rawMidiBytes);
  }

  parseStateResponse(rawMidiBytes: number[]): PianoEvent[] {
    return parseStateResponse(rawMidiBytes);
  }

  supportsDevice(identity: DeviceIdentity): boolean {
    return (
      identity.manufacturerId === ROLAND_MANUFACTURER_ID &&
      identity.familyCode[0] === FP30X_FAMILY_CODE[0] &&
      identity.familyCode[1] === FP30X_FAMILY_CODE[1]
    );
  }
}
