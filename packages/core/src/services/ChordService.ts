import type { ChordResult } from "../types/types";
/**
 * Chord Detection Service (v2 — Comprehensive Vocabulary + Bass Recognition).
 *
 * Maintains a held-notes Set, analyses chords from pitch-class intervals
 * against a 46-template database, picks the best match per held root using
 * set-difference scoring, then emits a display name with optional slash-bass
 * suffix and optional accidental annotations.
 *
 * Architecture: Held-Notes Set model (from discovery doc Section 6).
 *
 * v1 → v2 changes summarised in specs/004-chord-detection-v2/plan.md §Summary.
 */

/** Pitch class names (0-11) — kept for backwards-compatible note-name output. */
const PITCH_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** Sharp-accidental display names. Uses Unicode U+266F. */
const SHARP_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];

/** Flat-accidental display names. Uses Unicode U+266D. */
const FLAT_NAMES = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];

/** Scale-degree labels for the partial-match formatter. Indexed by interval 0..11. */
const DEGREE_NAME = [
  "1",
  "♭2",
  "2",
  "♭3",
  "3",
  "4",
  "♭5",
  "5",
  "♭6",
  "6",
  "♭7",
  "7",
];

/** Internal type: a chord template entry. */
type ChordTemplate = {
  /** Suffix joined onto the root name. Empty string for major triad. */
  name: string;
  /** Intervals from root in semitones (mod 12, excludes 0, sorted ascending). */
  intervals: number[];
};

/**
 * Chord template database — 46 entries total.
 * 42 from the chordcat reference port + 4 added-tone templates (`add9`,
 * `madd9`, `6/9`, `m6/9`) absent from the reference. Intervals are mod 12
 * (excluding 0 / root), sorted ascending.
 */
const CHORD_DB: ChordTemplate[] = [
  // Triads
  { name: "", intervals: [4, 7] },
  { name: "m", intervals: [3, 7] },
  { name: "dim", intervals: [3, 6] },
  { name: "aug", intervals: [4, 8] },
  { name: "sus2", intervals: [2, 7] },
  { name: "sus4", intervals: [5, 7] },

  // Sixths
  { name: "6", intervals: [4, 7, 9] },
  { name: "m6", intervals: [3, 7, 9] },

  // Sevenths
  { name: "7", intervals: [4, 7, 10] },
  { name: "maj7", intervals: [4, 7, 11] },
  { name: "m7", intervals: [3, 7, 10] },
  { name: "mMaj7", intervals: [3, 7, 11] },
  { name: "dim7", intervals: [3, 6, 9] },
  { name: "ø", intervals: [3, 6, 10] },
  { name: "aug7", intervals: [4, 8, 10] },
  { name: "augMaj7", intervals: [4, 8, 11] },

  // Sus sevenths
  { name: "7sus2", intervals: [2, 7, 10] },
  { name: "7sus4", intervals: [5, 7, 10] },
  { name: "maj7sus2", intervals: [2, 7, 11] },
  { name: "maj7sus4", intervals: [5, 7, 11] },

  // Ninths
  { name: "9", intervals: [2, 4, 7, 10] },
  { name: "m9", intervals: [2, 3, 7, 10] },
  { name: "maj9", intervals: [2, 4, 7, 11] },
  { name: "mMaj9", intervals: [2, 3, 7, 11] },
  { name: "aug9", intervals: [2, 4, 8, 10] },
  { name: "augMaj9", intervals: [2, 4, 8, 11] },
  { name: "dim9", intervals: [2, 3, 6, 9] },
  { name: "9sus4", intervals: [2, 5, 7, 10] },
  { name: "maj9sus4", intervals: [2, 5, 7, 11] },

  // Elevenths
  { name: "11", intervals: [2, 4, 5, 7, 10] },
  { name: "m11", intervals: [2, 3, 5, 7, 10] },
  { name: "maj11", intervals: [2, 4, 5, 7, 11] },
  { name: "mMaj11", intervals: [2, 3, 5, 7, 11] },
  { name: "aug11", intervals: [2, 4, 5, 8, 10] },
  { name: "augMaj11", intervals: [2, 4, 5, 8, 11] },
  { name: "dim11", intervals: [2, 3, 5, 6, 9] },

  // Thirteenths
  { name: "13", intervals: [2, 4, 5, 7, 9, 10] },
  { name: "m13", intervals: [2, 3, 5, 7, 9, 10] },
  { name: "maj13", intervals: [2, 4, 5, 7, 9, 11] },
  { name: "mMaj13", intervals: [2, 3, 5, 7, 9, 11] },
  { name: "aug13", intervals: [2, 4, 5, 8, 9, 10] },
  { name: "augMaj13", intervals: [2, 4, 5, 8, 9, 11] },

  // Added-tone (v2 NEW)
  { name: "add9", intervals: [2, 4, 7] },
  { name: "madd9", intervals: [2, 3, 7] },
  { name: "6/9", intervals: [2, 4, 7, 9] },
  { name: "m6/9", intervals: [2, 3, 7, 9] },
];

/** Internal scoring intermediate produced by `scoreMatch`. */
type ChordMatch = {
  /** Pitch class 0..11 (C = 0). */
  root: number;
  /** Template's `name` field. Empty string for major triad. */
  baseName: string;
  /** Template intervals NOT present in the held set. */
  omittedTones: number[];
  /** Held intervals NOT present in the template. */
  extraTones: number[];
  /** omittedTones.length + extraTones.length. Lower = better match. */
  numAccidentals: number;
  /** Bass pitch class 0..11. Filled by `pickBestChord`. */
  bass: number;
};

type ChordListener = (result: ChordResult) => void;

export class ChordService {
  private heldNotes = new Set<number>();
  private listeners: ChordListener[] = [];
  private useSharps: boolean;

  constructor(opts?: { useSharps?: boolean }) {
    this.useSharps = opts?.useSharps ?? true;
  }

  /** Add a note (Note On). */
  addNote(note: number): void {
    this.heldNotes.add(note);
    this.analyze();
  }

  /** Remove a note (Note Off). */
  removeNote(note: number): void {
    this.heldNotes.delete(note);
    this.analyze();
  }

  /** Clear all held notes. */
  clear(): void {
    this.heldNotes.clear();
    this.analyze();
  }

  /** Subscribe to chord changes. */
  subscribe(listener: ChordListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /** Get current chord result without subscribing. */
  getCurrent(): ChordResult {
    return this.buildResult();
  }

  /** Set the display preference for sharps (true) or flats (false). Re-fires
   *  analysis so subscribers receive the re-rendered name. Detection is
   *  unaffected. */
  setUseSharps(useSharps: boolean): void {
    this.useSharps = useSharps;
    this.analyze();
  }

  /** Get the current sharp/flat display preference. */
  getUseSharps(): boolean {
    return this.useSharps;
  }

  // ─── Private ────────────────────────────────────────────────

  private analyze(): void {
    const result = this.buildResult();
    for (const listener of this.listeners) {
      listener(result);
    }
  }

  private buildResult(): ChordResult {
    const notes = Array.from(this.heldNotes).sort((a, b) => a - b);
    const noteCount = notes.length;
    const names = this.useSharps ? SHARP_NAMES : FLAT_NAMES;

    if (noteCount === 0) {
      return {
        name: "",
        root: null,
        bass: null,
        quality: null,
        annotation: null,
        noteCount: 0,
        notes: [],
      };
    }

    if (noteCount === 1) {
      const name = noteToName(notes[0]);
      const pcName = names[notes[0] % 12];
      return {
        name,
        root: pcName,
        bass: pcName,
        quality: null,
        annotation: null,
        noteCount: 1,
        notes,
      };
    }

    if (noteCount === 2) {
      const name = `${noteToName(notes[0])} ${noteToName(notes[1])}`;
      const bass = names[notes[0] % 12];
      return {
        name,
        root: null,
        bass,
        quality: null,
        annotation: null,
        noteCount: 2,
        notes,
      };
    }

    // 3+ notes: score every candidate root × template and pick the global best.
    const pitchClasses = [...new Set(notes.map((n) => n % 12))];
    const bassPitchClass = notes[0] % 12;
    const match = pickBestChord(pitchClasses, bassPitchClass);

    if (match) {
      return {
        name: formatName(match, this.useSharps),
        root: names[match.root],
        bass: names[match.bass],
        quality: match.baseName === "" ? "maj" : match.baseName,
        annotation: buildAnnotation(match),
        noteCount,
        notes,
      };
    }

    // Only reachable when 3+ notes are held but fewer than 3 unique pitch
    // classes are present (e.g., octave doublings of one or two notes); the
    // scoring algorithm cannot identify a chord without 3 distinct pcs.
    return {
      name: notes.map(noteToName).join(" "),
      root: null,
      bass: names[bassPitchClass],
      quality: null,
      annotation: null,
      noteCount,
      notes,
    };
  }
}

/**
 * Convert MIDI note number to note name with octave.
 * 60 = C4, 61 = C#4, etc.
 */
function noteToName(note: number): string {
  const pitchClass = note % 12;
  const octave = Math.floor(note / 12) - 1;
  return `${PITCH_NAMES[pitchClass]}${octave}`;
}

/**
 * Corrected interval helper. For a given root and set of pitch classes,
 * returns the intervals (mod 12, excluding 0, sorted ascending). Fixes the
 * compound-interval bug from the reference port (research.md R2).
 */
function intervalsForRoot(pitchClasses: number[], root: number): number[] {
  return pitchClasses
    .filter((pc) => pc !== root)
    .map((pc) => (((pc - root) % 12) + 12) % 12)
    .sort((a, b) => a - b);
}

/** Templates carry their CHORD_DB index for use as the final tie-breaker. */
type ScoredMatch = ChordMatch & { templateIdx: number };

/**
 * Score a single (intervals, template) pair using set-difference. The result
 * fixes `root` and `baseName`; `bass` is filled by `pickBestChord` after the
 * global winner is selected.
 */
function scoreMatch(
  intervals: number[],
  template: ChordTemplate,
  root: number,
  templateIdx: number,
): ScoredMatch {
  const omittedTones = template.intervals.filter((t) => !intervals.includes(t));
  const extraTones = intervals.filter((i) => !template.intervals.includes(i));
  return {
    root,
    baseName: template.name,
    omittedTones,
    extraTones,
    numAccidentals: omittedTones.length + extraTones.length,
    bass: -1,
    templateIdx,
  };
}

/**
 * Pick the globally best chord interpretation for a held set of pitch
 * classes. Returns null when fewer than 3 distinct pitch classes are held.
 *
 * Tie-breaker chain (research.md R4, refined per data-model.md):
 *   1. fewer `numAccidentals` wins,
 *   2. candidate with `root === bassPitchClass` wins (bass-rooted preference),
 *   3. lower `root` pitch-class index wins,
 *   4. lower CHORD_DB declaration index wins — declaration order is curated so
 *      common templates (maj, m7, ...) precede exotic ones (augMaj7, mMaj7),
 *      giving musically-natural defaults when accidentals tie. Replaces R4's
 *      lex-on-`baseName` step, which would otherwise pick `augMaj7` over
 *      `maj7` (a < m) and yield surprising names.
 */
function pickBestChord(
  pitchClasses: number[],
  bassPitchClass: number,
): ChordMatch | null {
  if (pitchClasses.length < 3) return null;

  const compare = (a: ScoredMatch, b: ScoredMatch): number => {
    if (a.numAccidentals !== b.numAccidentals)
      return a.numAccidentals - b.numAccidentals;
    const aBass = a.root === bassPitchClass ? 1 : 0;
    const bBass = b.root === bassPitchClass ? 1 : 0;
    if (aBass !== bBass) return bBass - aBass;
    if (a.root !== b.root) return a.root - b.root;
    return a.templateIdx - b.templateIdx;
  };

  let winner: ScoredMatch | null = null;
  for (const root of pitchClasses) {
    const intervals = intervalsForRoot(pitchClasses, root);
    for (let i = 0; i < CHORD_DB.length; i += 1) {
      const m = scoreMatch(intervals, CHORD_DB[i], root, i);
      if (winner === null || compare(m, winner) < 0) winner = m;
    }
  }

  if (winner === null) return null;
  return {
    root: winner.root,
    baseName: winner.baseName,
    omittedTones: winner.omittedTones,
    extraTones: winner.extraTones,
    numAccidentals: winner.numAccidentals,
    bass: bassPitchClass,
  };
}

/**
 * Build the partial-voicing annotation block — `"(noN,addN,...)"` — or null
 * when the held set matches the template exactly. Shared by `formatName`
 * (which composes the flat display string) and `buildResult` (which exposes
 * it as a separate field on `ChordResult`).
 */
function buildAnnotation(match: ChordMatch): string | null {
  if (match.numAccidentals === 0) return null;
  const parts: string[] = [];
  for (const t of match.omittedTones) parts.push(`no${DEGREE_NAME[t]}`);
  for (const t of match.extraTones) parts.push(`add${DEGREE_NAME[t]}`);
  return `(${parts.join(",")})`;
}

/**
 * Render a `ChordMatch` as a display string.
 *
 * Composition: `<rootName><baseName>` + optional `(noN,addN,…)` annotation
 * block + optional `/<bassName>` slash suffix. The annotation block precedes
 * the slash suffix so the output reads `<root><quality>(<accidentals>)/<bass>`.
 */
function formatName(match: ChordMatch, useSharps: boolean): string {
  const names = useSharps ? SHARP_NAMES : FLAT_NAMES;
  let s = `${names[match.root]}${match.baseName}`;
  const annotation = buildAnnotation(match);
  if (annotation !== null) s += annotation;
  if (match.bass !== match.root) s += `/${names[match.bass]}`;
  return s;
}

// Lazy singleton — preserved from v1.
let chordServiceInstance: ChordService | null = null;

export function getChordService(): ChordService {
  if (!chordServiceInstance) {
    chordServiceInstance = new ChordService();
  }
  return chordServiceInstance;
}
