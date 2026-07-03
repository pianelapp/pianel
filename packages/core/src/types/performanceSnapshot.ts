/**
 * Performance snapshot — the captured-state shape used by both `Preset.snapshot`
 * and `Profile.defaultState`. Encodes every parameter in FR-005.
 *
 * Reuses `QuickToneSlot` (R4) as the voice-mode container — `QuickToneSlot`
 * already captures every DT1 byte that any voicing mode (Single/Split/Dual/Twin)
 * cares about (right/left/dualTone2 tone IDs, splitPoint, balance, dualBalance,
 * four shifts), so we don't need a parallel discriminated union.
 *
 * Loader policy (FR-010, FR-023, SC-008): missing optional fields fall back to
 * the documented defaults in `data-model.md §9` and apply skips the
 * corresponding DT1 write.
 */

import type {QuickToneSlot} from './quickToneSlot';

export interface PerformanceSnapshot {
  /** Master output volume (0-100). DT1: 01 00 02 13. */
  volume: number;

  /** Tempo (BPM 20-250). DT1: 01 00 03 09. */
  tempo: number;

  /** Metronome capture (FR-005 §3). All fields optional ⇒ "no change" on apply. */
  metronome: {
    /** DT1: 01 00 01 0F (echo address). */
    on?: boolean;
    /** Beat 0-5. DT1: 01 00 02 1F. */
    beat?: number;
    /** Pattern 0-7. DT1: 01 00 02 20. */
    pattern?: number;
    /** Volume 0-10. DT1: 01 00 02 21. */
    volume?: number;
    /** Tone 0-3. DT1: 01 00 02 22. */
    tone?: number;
  };

  /** Voice mode + per-mode parameters (FR-005 §4). The active mode is
   *  `voiceModeSnapshot.voiceMode`. */
  voiceModeSnapshot: QuickToneSlot;

  /** Current tone (FR-005 §5). For Single/Twin this duplicates
   *  `voiceModeSnapshot.rightToneId`. Allowed to be null when not applicable. */
  currentToneId: string | null;

  /** Three quick-tone slot assignments (FR-005 §6). Fixed length 3
   *  (Assumptions — *Quick-tone slot count*). */
  quickToneSlots: [
    QuickToneSlot | null,
    QuickToneSlot | null,
    QuickToneSlot | null,
  ];
}

/** Default `PerformanceSnapshot` used by the forward-compat loader when an
 *  imported file is missing one or more snapshot fields (R2, R8, data-model §9). */
export const DEFAULT_PERFORMANCE_SNAPSHOT: PerformanceSnapshot = {
  volume: 100,
  tempo: 120,
  metronome: {},
  voiceModeSnapshot: {
    voiceMode: 'single',
    rightToneId: null,
    leftToneId: null,
    dualTone2Id: null,
  },
  currentToneId: null,
  quickToneSlots: [null, null, null],
};
