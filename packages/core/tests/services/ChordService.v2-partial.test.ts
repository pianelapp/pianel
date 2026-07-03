/**
 * v2-partial: covers partial-voicing annotations (FR-001, FR-003, US3).
 *
 * T026 — voicings missing one chord tone render `<base>(no<degree>)`.
 * T027 — voicings with one extra non-chord tone render `<base>(add<degree>)`.
 * T028 — voicings combining one omitted + one extra tone render both clauses.
 *
 * Degree labels follow `DEGREE_NAME` in `ChordService.ts`:
 *   ['1','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7']
 */

import {ChordService} from '../../src/services/ChordService';

describe('ChordService v2 — partial voicings, omitted (T026)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('C-E-B → Cmaj7(no5)', () => {
    [60, 64, 71].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('Cmaj7(no5)');
  });

  it('C-G-B♭ → C7(no3)', () => {
    [60, 67, 70].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('C7(no3)');
  });

  it('C-E♭-B♭ → Cm7(no5)', () => {
    [60, 63, 70].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('Cm7(no5)');
  });
});

describe('ChordService v2 — partial voicings, extra (T027)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('C-E-G-D♭ → C(add♭2) — extra ♭2 above C major', () => {
    [60, 64, 67, 61].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('C(add♭2)');
  });

  it('C-E-G-F♯ → C(add♭5) — extra ♭5 above C major', () => {
    [60, 64, 67, 66].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('C(add♭5)');
  });
});

describe('ChordService v2 — partial voicings, combined omitted + extra (T028)', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('C-E-B-D♭ → Cmaj7(no5,add♭2)', () => {
    [60, 64, 71, 61].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('Cmaj7(no5,add♭2)');
  });

  it('C-G-B♭-F♯ → C7(no3,add♭5)', () => {
    // C-G-B♭ alone is C7(no3); adding F♯ injects a ♭5 above C.
    // Expected per-root best: 7 [4,7,10] → omit=[4] extra=[6] → 2 acc.
    [60, 67, 70, 66].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('C7(no3,add♭5)');
  });

  it('C-E♭-B♭-D → Cm9(no5) — m9 absorbs the added 9, no combined annotation', () => {
    // Sanity case: adding a 9 to Cm7(no5) lands on Cm9(no5), 1 omit only.
    [60, 63, 70, 62].forEach(n => service.addNote(n));
    expect(service.getCurrent().name).toBe('Cm9(no5)');
  });
});

describe('ChordService v2 — annotation field decomposition', () => {
  let service: ChordService;
  beforeEach(() => {
    service = new ChordService();
  });

  it('exact match → annotation is null', () => {
    // C major triad in root position — no accidentals.
    [60, 64, 67].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('C');
    expect(r.annotation).toBeNull();
  });

  it('partial omitted-only → annotation is "(no5)"', () => {
    // Cmaj7 without the 5th.
    [60, 64, 71].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('Cmaj7(no5)');
    expect(r.annotation).toBe('(no5)');
  });

  it('partial extra-only → annotation is "(add♭2)"', () => {
    // C major triad + an added ♭2.
    [60, 64, 67, 61].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('C(add♭2)');
    expect(r.annotation).toBe('(add♭2)');
  });

  it('combined omitted + extra → annotation contains both clauses', () => {
    // Cmaj7 missing the 5th, with an added ♭2.
    [60, 64, 71, 61].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    expect(r.name).toBe('Cmaj7(no5,add♭2)');
    expect(r.annotation).toBe('(no5,add♭2)');
  });

  it('empty/single/two-note states → annotation is null', () => {
    expect(service.getCurrent().annotation).toBeNull();
    service.addNote(60);
    expect(service.getCurrent().annotation).toBeNull();
    service.addNote(64);
    expect(service.getCurrent().annotation).toBeNull();
  });

  it('decomposition invariant: name === root + (quality !== "maj" ? quality : "") + (annotation ?? "") + slash bass', () => {
    // Cmaj7/E + (no5) — first inversion partial.
    // E3 (52) + B3 (59) + C4 (60) — Cmaj7 inv #1 without the 5.
    [52, 59, 60].forEach(n => service.addNote(n));
    const r = service.getCurrent();
    if (r.root !== null && r.quality !== null) {
      const expected =
        r.root +
        (r.quality === 'maj' ? '' : r.quality) +
        (r.annotation ?? '') +
        (r.bass !== r.root ? `/${r.bass}` : '');
      expect(r.name).toBe(expected);
    }
  });
});
