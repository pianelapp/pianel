/**
 * T067: Chord detection tests.
 *
 * C major, C minor, dim, aug, 7th chords, single note, 2 notes,
 * non-chord intervals, empty clear.
 */

import {ChordService} from '../../src/services/ChordService';

describe('ChordService', () => {
  let service: ChordService;

  beforeEach(() => {
    service = new ChordService();
  });

  describe('empty state', () => {
    it('returns empty result with 0 notes', () => {
      const result = service.getCurrent();
      expect(result.name).toBe('');
      expect(result.root).toBeNull();
      expect(result.noteCount).toBe(0);
    });
  });

  describe('single note', () => {
    it('shows note name for C4', () => {
      service.addNote(60);
      const result = service.getCurrent();
      expect(result.name).toBe('C4');
      expect(result.noteCount).toBe(1);
    });

    it('shows note name for G3', () => {
      service.addNote(55);
      expect(service.getCurrent().name).toBe('G3');
    });
  });

  describe('two notes', () => {
    it('shows both note names', () => {
      service.addNote(60); // C4
      service.addNote(64); // E4
      const result = service.getCurrent();
      expect(result.name).toBe('C4 E4');
      expect(result.noteCount).toBe(2);
    });
  });

  describe('major chords', () => {
    it('identifies C major (C4 E4 G4)', () => {
      service.addNote(60); // C
      service.addNote(64); // E
      service.addNote(67); // G
      expect(service.getCurrent().name).toBe('C');
      expect(service.getCurrent().root).toBe('C');
    });

    it('identifies G major (G3 B3 D4)', () => {
      service.addNote(55); // G
      service.addNote(59); // B
      service.addNote(62); // D
      expect(service.getCurrent().name).toBe('G');
    });

    it('identifies F major', () => {
      service.addNote(65); // F
      service.addNote(69); // A
      service.addNote(72); // C
      expect(service.getCurrent().name).toBe('F');
    });
  });

  describe('minor chords', () => {
    it('identifies C minor (C4 Eb4 G4)', () => {
      service.addNote(60); // C
      service.addNote(63); // Eb
      service.addNote(67); // G
      expect(service.getCurrent().name).toBe('Cm');
    });

    it('identifies A minor (A3 C4 E4)', () => {
      service.addNote(57); // A
      service.addNote(60); // C
      service.addNote(64); // E
      expect(service.getCurrent().name).toBe('Am');
    });
  });

  describe('diminished', () => {
    it('identifies C diminished (C Eb Gb)', () => {
      service.addNote(60); // C
      service.addNote(63); // Eb
      service.addNote(66); // Gb
      expect(service.getCurrent().name).toBe('Cdim');
    });
  });

  describe('augmented', () => {
    it('identifies C augmented (C E G#)', () => {
      service.addNote(60); // C
      service.addNote(64); // E
      service.addNote(68); // G#
      expect(service.getCurrent().name).toBe('Caug');
    });
  });

  describe('seventh chords', () => {
    it('identifies C major 7th (C E G B)', () => {
      service.addNote(60);
      service.addNote(64);
      service.addNote(67);
      service.addNote(71);
      expect(service.getCurrent().name).toBe('Cmaj7');
    });

    it('identifies C minor 7th (C Eb G Bb)', () => {
      service.addNote(60);
      service.addNote(63);
      service.addNote(67);
      service.addNote(70);
      expect(service.getCurrent().name).toBe('Cm7');
    });

    it('identifies C dominant 7th (C E G Bb)', () => {
      service.addNote(60);
      service.addNote(64);
      service.addNote(67);
      service.addNote(70);
      expect(service.getCurrent().name).toBe('C7');
    });

    it('identifies C diminished 7th (C Eb Gb A)', () => {
      service.addNote(60);
      service.addNote(63);
      service.addNote(66);
      service.addNote(69);
      expect(service.getCurrent().name).toBe('Cdim7');
    });
  });

  describe('note removal', () => {
    it('updates chord when a note is released', () => {
      service.addNote(60); // C
      service.addNote(64); // E
      service.addNote(67); // G
      expect(service.getCurrent().name).toBe('C');

      service.removeNote(64); // Release E → C4 G4
      expect(service.getCurrent().noteCount).toBe(2);
    });

    it('clears when all notes released', () => {
      service.addNote(60);
      service.addNote(64);
      service.removeNote(60);
      service.removeNote(64);
      expect(service.getCurrent().name).toBe('');
      expect(service.getCurrent().noteCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('clears all held notes', () => {
      service.addNote(60);
      service.addNote(64);
      service.addNote(67);
      service.clear();
      expect(service.getCurrent().noteCount).toBe(0);
    });
  });

  describe('listener', () => {
    it('notifies on chord change', () => {
      const results: string[] = [];
      service.subscribe(r => results.push(r.name));

      service.addNote(60);
      service.addNote(64);
      service.addNote(67);

      expect(results.length).toBe(3);
      expect(results[2]).toBe('C'); // After 3rd note = C major
    });

    it('unsubscribes correctly', () => {
      const results: string[] = [];
      const unsub = service.subscribe(r => results.push(r.name));

      service.addNote(60);
      unsub();
      service.addNote(64);

      expect(results.length).toBe(1); // Only first note
    });
  });
});
