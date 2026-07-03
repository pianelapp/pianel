/**
 * PianoEngine Interface & Shared Engine Types
 *
 * Defines the contract that every piano engine implementation must fulfill.
 * Each Roland piano model (FP-30X, FP-60X, etc.) provides its own engine
 * that implements this interface.
 *
 * Constitution Principle V: Layered Architecture with Engine Abstraction.
 * The engine encapsulates ALL model-specific protocol knowledge.
 *
 * Source of truth: specs/002-fp30x-controller-v2/contracts/piano-engine.ts
 */

// ─── Tone Catalog ─────────────────────────────────────────────

/** A single playable tone (sound) on the piano. */
export interface Tone {
  /** Unique string identifier (e.g. "sn-piano-concert-1") */
  id: string;
  /** Display name (e.g. "Concert Piano 1") */
  name: string;
  /** DT1 category byte (0x00-0x08) */
  category: number;
  /** Human-readable category name (e.g. "Piano") */
  categoryName: string;
  /** DT1 index high byte */
  indexHigh: number;
  /** DT1 index low byte */
  indexLow: number;
  /** Ordinal position within its category (0-based) */
  position: number;
  /** True if this is a GM2 tone, false if SuperNATURAL */
  isGM2: boolean;
}

/** A group of tones belonging to the same instrument category. */
export interface ToneCategory {
  /** DT1 category byte (0x00-0x08) */
  id: number;
  /** Display name (e.g. "Piano", "E.Piano", "Strings") */
  name: string;
  /** Tones in this category, ordered by position */
  tones: Tone[];
}

/** Provides lookup and search operations over the full tone catalog. */
export interface ToneCatalog {
  /** All categories with their tones */
  categories: ToneCategory[];
  /** Total tone count across all categories */
  totalCount: number;

  /**
   * Find a tone by its DT1 bytes.
   * @param category - DT1 category byte
   * @param indexHigh - DT1 index high byte
   * @param indexLow - DT1 index low byte
   * @returns The matching tone, or undefined if not found
   */
  findByDT1(
    category: number,
    indexHigh: number,
    indexLow: number,
  ): Tone | undefined;

  /**
   * Find a tone by its string ID.
   * @param id - Unique tone identifier
   * @returns The matching tone, or undefined if not found
   */
  findById(id: string): Tone | undefined;

  /**
   * Search tones by name (case-insensitive, across all categories).
   * @param query - Search string to match against tone names
   * @returns Array of matching tones
   */
  searchByName(query: string): Tone[];

  /**
   * Get tone at position N from a specific category.
   * @param categoryId - DT1 category byte
   * @param position - Ordinal position within the category (0-based)
   * @returns The tone at that position, or undefined if out of range
   */
  getToneAtPosition(categoryId: number, position: number): Tone | undefined;
}

// ─── Piano Events ────────────────────────────────────────────

/**
 * Discriminated union of all piano state events.
 *
 * Used for both incoming BLE notifications (piano → app) and
 * app-originated state changes (pad apply, preset apply → stores).
 *
 * Each variant is distinguished by its `type` field.
 */
export type PianoEvent =
  | { type: "tone"; category: number; indexHigh: number; indexLow: number }
  | { type: "volume"; value: number }
  | { type: "tempo"; bpm: number }
  | { type: "metronomeState"; on: boolean }
  | { type: "headphonesConnection"; connected: boolean }
  | { type: "metronomeBeat"; value: number }
  | { type: "metronomePattern"; value: number }
  | { type: "metronomeVolume"; value: number }
  | { type: "metronomeTone"; value: number }
  | { type: "voiceMode"; value: number }
  | { type: "transpose"; value: number }
  | { type: "keyTouch"; value: number }
  | { type: "splitPoint"; value: number }
  | { type: "balance"; value: number }
  | { type: "dualBalance"; value: number }
  | { type: "leftTone"; category: number; indexHigh: number; indexLow: number }
  | { type: "dualTone2"; category: number; indexHigh: number; indexLow: number }
  | { type: "splitLeftShift"; value: number }
  | { type: "splitRightShift"; value: number }
  | { type: "dualT1Shift"; value: number }
  | { type: "dualT2Shift"; value: number }
  | { type: "twinMode"; value: number }
  | { type: "noteOn"; note: number; velocity: number }
  | { type: "noteOff"; note: number }
  | {
      type: "controlChange";
      channel: number;
      controller: number;
      value: number;
    }
  | { type: "programChange"; channel: number; program: number }
  | { type: "unknown"; address: number[]; data: number[] };

// ─── Device Identity ──────────────────────────────────────────

/** Identity information returned by a MIDI Identity Reply (F0 7E ... F7). */
export interface DeviceIdentity {
  /** Manufacturer ID (Roland = 0x41) */
  manufacturerId: number;
  /** Device ID (default 0x10) */
  deviceId: number;
  /** Device family code (2 bytes, LSB first) */
  familyCode: [number, number];
  /** Model number bytes */
  modelId: number[];
  /** Firmware version string, if available */
  firmware?: string;
}

// ─── Piano Capabilities ──────────────────────────────────────

/**
 * Declares optional hardware capabilities for a piano model.
 * Used by the presentation layer to conditionally show/hide controls.
 */
export interface PianoCapabilities {
  /** Whether the piano supports keyboard split mode */
  hasSplit: boolean;
  /** Whether the piano supports dual (layer) mode */
  hasDual: boolean;
  /** Whether the piano supports twin piano mode */
  hasTwin: boolean;
  /** Whether the piano supports transpose */
  hasTranspose: boolean;
  /** Whether the piano supports key touch sensitivity adjustment */
  hasKeyTouch: boolean;
  /** Maximum volume value (FP-30X: 100) */
  maxVolume: number;
  /** Valid tempo range as [min, max] in BPM */
  tempoRange: [number, number];
}

// ─── Chord Detection Result ─────────────────────────────────

/**
 * Result of chord detection based on currently held notes.
 *
 * The `name` field is the full display string (e.g. "Cmaj7/G"), while
 * the other fields decompose it into parts for flexible rendering:
 *   root — the chord's root note (e.g. "C")
 *   quality — the chord type (e.g. "maj7")
 *   annotation — any additional voicing info (e.g. "(no5)/G")
 *   bass — the bass note if different from root (e.g. "G" in "Cmaj7/G")
 *
 * For non-chord results (0, 1, or 2 held notes), `root` and `quality`
 * are null and `name` is a simple concatenation of note names (e.g.
 * "C4 E4"). For detected chords, all fields are non-null and must satisfy
 * the decomposition invariant described in `annotation`.
 */
export interface ChordResult {
  /** Display string: "C", "Cm", "G7", or note names. */
  name: string;
  /** Root note name (null if no chord detected). */
  root: string | null;
  /** Bass note name — pitch class of the lowest held note. Null when no notes. */
  bass: string | null;
  /** Chord quality / template base name ("maj", "m7", "13"...). Null when no chord. */
  quality: string | null;
  /** Partial-voicing annotation block including the outer parens, e.g.
   *  `"(no5)"`, `"(no5,add♭2)"`. Null when the voicing matches the template
   *  exactly. Renderers that style quality and bass independently (e.g.
   *  subscript quality) consume this as a separate text run.
   *
   *  Decomposition invariant for chord-detected results:
   *    name === root
   *         + (quality === 'maj' ? '' : quality)
   *         + (annotation ?? '')
   *         + (bass !== root ? '/' + bass : ''). */
  annotation: string | null;
  /** Number of held notes. */
  noteCount: number;
  /** Held MIDI note numbers, sorted ascending. */
  notes: number[];
}
