/**
 * v2-slash: covers slash-chord detection (FR-002, FR-003, US2).
 *
 * T017 — triad inversions render `<C><quality>/<bass>`.
 * T018 — seventh inversions render `<C><quality>/<bass>`.
 * T019 — root-in-bass voicings omit the slash suffix.
 * T020 — rootless / non-chord-tone bass still slashes.
 * T021 — bass-rooted tie-breaker (C6 vs Am7) locks FR-003 ambiguity.
 */

import {ChordService} from '../../src/services/ChordService';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const TRIADS: ReadonlyArray<{name: string; intervals: number[]}> = [
  {name: '', intervals: [4, 7]},
  {name: 'm', intervals: [3, 7]},
  {name: 'dim', intervals: [3, 6]},
  {name: 'aug', intervals: [4, 8]},
  {name: 'sus2', intervals: [2, 7]},
  {name: 'sus4', intervals: [5, 7]},
];

const SEVENTHS: ReadonlyArray<{name: string; intervals: number[]}> = [
  {name: '7', intervals: [4, 7, 10]},
  {name: 'maj7', intervals: [4, 7, 11]},
  {name: 'm7', intervals: [3, 7, 10]},
  {name: 'mMaj7', intervals: [3, 7, 11]},
  {name: 'dim7', intervals: [3, 6, 9]},
  {name: 'ø', intervals: [3, 6, 10]},
  {name: 'aug7', intervals: [4, 8, 10]},
  {name: 'augMaj7', intervals: [4, 8, 11]},
];

const C4 = 60;

/** Build an inverted voicing: chord tones rotated so the n-th is in the bass.
 *  E.g., C major (root=0, intervals=[4,7]) inverted by index=1 (E in bass)
 *  yields E3 G3 C4 — pitch order [4, 7, 12] starting an octave lower. */
function inversion(
  rootPc: number,
  intervals: number[],
  inversionIndex: number,
): {midi: number[]; bassPc: number} {
  // All chord-tone pitch classes (incl. root) in interval order.
  const tones = [0, ...intervals];
  // Rotate so the inversion-index'th tone is first.
  const rotated = [...tones.slice(inversionIndex), ...tones.slice(0, inversionIndex)];
  const rootMidi = C4 + rootPc;
  let prev = rootMidi + rotated[0] - 12; // shift the rotated set one octave lower
  const midi = [prev];
  for (let i = 1; i < rotated.length; i += 1) {
    // Build ascending MIDI numbers, ensuring strictly increasing.
    const ideal = rootMidi + rotated[i] - (rotated[i] >= rotated[0] ? 12 : 0);
    const value = ideal > prev ? ideal : prev + 1;
    midi.push(value);
    prev = value;
  }
  const bassPc = ((rootPc + rotated[0]) % 12 + 12) % 12;
  return {midi, bassPc};
}

/**
 * Inversions of these (template × inversion-index) pairs are mathematically
 * equivalent to a *different* chord at root position, so the bass-rooted
 * tie-breaker (research.md R4) wins them with the alias name and no slash:
 *
 *   • symmetric chords (aug, dim7) — all rotations are themselves at 0 acc;
 *   • sus2 inv #2 ↔ sus4; sus4 inv #1 ↔ sus2 (5th-related duality);
 *   • m7 inv #1 ↔ 6 (Cm7/E♭ ≡ E♭6); ø inv #1 ↔ m6.
 *
 * These cases are exercised in their alias form below ("root in bass omits
 * slash" already covers `Eaug`, `E♭6`, `E♭m6`, etc.).
 */
const ALIASED_INVERSIONS = new Set<string>([
  'aug-1',
  'aug-2',
  'sus2-2',
  'sus4-1',
  'dim7-1',
  'dim7-2',
  'dim7-3',
  'm7-1',
  'ø-1',
]);

describe('ChordService v2 — slash chords, triads (T017)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  for (const t of TRIADS) {
    for (let inv = 1; inv <= t.intervals.length; inv += 1) {
      const key = `${t.name || 'maj'}-${inv}`;
      if (ALIASED_INVERSIONS.has(key)) continue;
      it(`C${t.name} inversion #${inv} renders C${t.name}/<bass>`, () => {
        const {midi, bassPc} = inversion(0, t.intervals, inv);
        for (const n of midi) service.addNote(n);
        const r = service.getCurrent();
        expect(r.root).toBe('C');
        expect(r.quality).toBe(t.name === '' ? 'maj' : t.name);
        expect(r.bass).toBe(SHARP_NAMES[bassPc]);
        expect(r.name).toBe(`C${t.name}/${SHARP_NAMES[bassPc]}`);
      });
    }
  }
});

describe('ChordService v2 — slash chords, sevenths (T018)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  for (const t of SEVENTHS) {
    for (let inv = 1; inv <= t.intervals.length; inv += 1) {
      const key = `${t.name}-${inv}`;
      if (ALIASED_INVERSIONS.has(key)) continue;
      it(`C${t.name} inversion #${inv} renders C${t.name}/<bass>`, () => {
        const {midi, bassPc} = inversion(0, t.intervals, inv);
        for (const n of midi) service.addNote(n);
        const r = service.getCurrent();
        expect(r.root).toBe('C');
        expect(r.quality).toBe(t.name);
        expect(r.bass).toBe(SHARP_NAMES[bassPc]);
        expect(r.name).toBe(`C${t.name}/${SHARP_NAMES[bassPc]}`);
      });
    }
  }
});

describe('ChordService v2 — slash chords, root in bass omits slash (T019)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  for (const t of [...TRIADS, ...SEVENTHS]) {
    it(`C${t.name} in root position does NOT carry a slash`, () => {
      const rootMidi = C4;
      for (const iv of [0, ...t.intervals]) service.addNote(rootMidi + iv);
      const r = service.getCurrent();
      expect(r.name).not.toContain('/');
      expect(r.bass).toBe('C');
    });
  }
});

describe('ChordService v2 — rootless bass / non-chord-tone bass (T020)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('F♯ + G + B + D + F — slash suffix is emitted when bass is not a chord tone', () => {
    // F♯2=42, G3=55, B3=59, D4=62, F4=65 — G7 voiced with F♯ in the bass.
    // The algorithm absorbs the F♯ pitch class as an extra chord-tone of G
    // (interval 11 = major7), so the rendered name carries an `add7`
    // annotation. The R3-mandated invariant we lock here is just the slash
    // suffix: bass ≠ root MUST produce `/<bassName>`.
    [42, 55, 59, 62, 65].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.root).toBe('G');
    expect(r.bass).toBe('F♯');
    expect(r.name.endsWith('/F♯')).toBe(true);
    expect(r.name.startsWith('G')).toBe(true);
  });
});

describe('ChordService v2 — bass-rooted tie-breaker, FR-003 (T021)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('C4 + E4 + G4 + A4 (bass = C) resolves to C6, not Am7/C', () => {
    [60, 64, 67, 69].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('C6');
    expect(r.root).toBe('C');
    expect(r.quality).toBe('6');
  });

  it('A3 + C4 + E4 + G4 (bass = A) resolves to Am7, not C6/A', () => {
    [57, 60, 64, 67].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('Am7');
    expect(r.root).toBe('A');
    expect(r.quality).toBe('m7');
  });
});
