/**
 * Piano Engine Interface.
 *
 * The contract every piano engine must implement.
 * An engine encapsulates all model-specific protocol knowledge:
 * SysEx message construction, notification parsing, and tone catalog.
 * Adding support for a new piano model means creating a new engine
 * directory under `src/engine/<model>/` that implements this interface.
 *
 * Constitution Principle V: Engine and Transport MUST NOT depend on each other.
 */

import type {
  Tone,
  ToneCatalog,
  PianoEvent,
  DeviceIdentity,
} from '../types/types';
import type {ShiftTarget} from '../types/voicingMode';

export interface PianoEngine {
  /** Human-readable model name (e.g. "Roland FP-30X") */
  readonly modelName: string;

  /** Access the tone catalog for this piano model */
  readonly tones: ToneCatalog;

  /**
   * Build a DT1 SysEx message to change the active tone.
   * Returns raw SysEx bytes (F0...F7) ready for BLE framing.
   * @param tone - The tone to select
   */
  buildToneChange(tone: Tone): number[];

  /**
   * Build a DT1 SysEx message to set volume.
   * @param value - Volume level (0-100)
   */
  buildVolumeChange(value: number): number[];

  /**
   * Build a DT1 SysEx message to set tempo.
   * @param bpm - Tempo in beats per minute (20-250)
   */
  buildTempoChange(bpm: number): number[];

  /**
   * Build a DT1 SysEx message to toggle metronome.
   * Note: FP-30X uses a toggle command (always sends 0x00 to 01 00 05 09),
   * not an explicit on/off value.
   */
  buildMetronomeToggle(): number[];

  /**
   * Build a DT1 SysEx message for a metronome parameter.
   * @param param - Which metronome parameter to set
   * @param value - Parameter-specific value
   */
  buildMetronomeParam(
    param: 'beat' | 'pattern' | 'volume' | 'tone',
    value: number,
  ): number[];

  /** Build a DT1 SysEx message to set voice mode (0=Single, 1=Split, 2=Dual, 3=Twin). */
  buildVoiceModeChange(mode: number): number[];

  /** Build a DT1 SysEx message to set the Split Lower tone (01 00 02 0A). */
  buildLeftToneChange(tone: Tone): number[];

  /** Build a DT1 SysEx message to set the Dual Tone 2 tone (01 00 02 0D). */
  buildDualTone2Change(tone: Tone): number[];

  /** Build a DT1 SysEx message to set split point (MIDI note number). */
  buildSplitPointChange(note: number): number[];

  /** Build a DT1 SysEx message to set Split balance (01 00 02 03, range 56-72, center=64). */
  buildBalanceChange(value: number): number[];

  /** Build a DT1 SysEx message to set Dual balance (01 00 02 05, range 56-72, center=64). */
  buildDualBalanceChange(value: number): number[];

  /** Build a DT1 SysEx message to set keyboard transpose (center=64, range 58-69). */
  buildTransposeChange(value: number): number[];

  /** Build a DT1 SysEx message to set key touch sensitivity (0-5). */
  buildKeyTouchChange(level: number): number[];

  /**
   * Build a DT1 SysEx message to set one of the four voicing-mode shift parameters.
   * `octaves` is the signed shift in octaves (clamped to ±24 internally; encoded
   * as `byte = 64 + octaves`).
   */
  buildShiftChange(target: ShiftTarget, octaves: number): number[];

  /**
   * Build a DT1 SysEx message to set the Twin pair/individual sub-mode (01 00 02 06).
   * The desktop app only ever calls this with 'pair'; 'individual' is exposed for
   * completeness but its speaker-routing semantics are not yet reverse-engineered.
   */
  buildTwinModeSet(mode: 'pair' | 'individual'): number[];

  /**
   * Build SysEx messages to send on connect, after the engine is resolved
   * but before the initial state read. Engines that don't need any post-identify
   * setup should return an empty array.
   *
   * For the FP-30X, this is the cold-boot DT1 unlock sequence — without it the
   * piano silently ignores all DT1 parameter writes. See docs/cold-boot-dt1-unlock.md.
   */
  buildSessionUnlock(): number[][];

  /**
   * Build RQ1 SysEx messages to read the piano's initial state.
   * Returns an array of SysEx messages (typically 3: performance block + tempo + transpose).
   * Each message is raw SysEx bytes (F0...F7).
   */
  buildInitialStateRequest(): number[][];

  /**
   * Build an Identity Request SysEx.
   * Used during connection to verify the device is a compatible piano.
   */
  buildIdentityRequest(): number[];

  /**
   * Build an RQ1 SysEx to ping the piano's alive-check register.
   *
   * The FP-30X exposes a read-only "alive check" at DT1 address `01 00 08 01`
   * that always replies with `0x00`. Used by ConnectionService as a
   * protocol-level heartbeat — BLE can stay connected while the piano has
   * gone unresponsive, and this ping is the only way to detect that.
   *
   * Engines that don't support a heartbeat return an empty array.
   */
  buildAliveCheck(): number[];

  /**
   * Return true iff `rawMidiBytes` is this piano's alive-check reply.
   *
   * Used by ConnectionService to intercept heartbeat replies before they
   * reach the normal notification dispatch (they're plumbing, not user-
   * visible state). Engines without a heartbeat return false.
   */
  isAliveReply(rawMidiBytes: number[]): boolean;

  /**
   * Parse a raw MIDI/SysEx notification from the piano.
   * The input is raw bytes AFTER BLE MIDI framing is stripped
   * (i.e., no BLE header/timestamp bytes -- just MIDI content).
   *
   * @param rawMidiBytes - Raw MIDI bytes with BLE framing removed
   * @returns Parsed event, or null if the message is not relevant
   */
  parseNotification(rawMidiBytes: number[]): PianoEvent | null;

  /**
   * Parse an RQ1 response (DT1 containing requested data).
   * Returns an array of events extracted from the response block.
   * Used to populate initial state on connect.
   *
   * @param rawMidiBytes - Raw MIDI bytes of the RQ1 response
   * @returns Array of events extracted from the response
   */
  parseStateResponse(rawMidiBytes: number[]): PianoEvent[];

  /**
   * Check if a DeviceIdentity matches this engine's supported model(s).
   * @param identity - The device identity to check
   * @returns True if this engine can handle the identified device
   */
  supportsDevice(identity: DeviceIdentity): boolean;
}
