/**
 * T012: Tone catalog integrity tests.
 *
 * Verifies 321 total tones, category counts, findByDT1 for known tones,
 * search by name, boundary tones per category.
 */

import {fp30xToneCatalog, SN_PIANO, SN_EPIANO, SN_ORGAN, SN_STRINGS, SN_PAD, SN_SYNTH, SN_OTHER, SN_DRUMS, GM2_TONES} from '../../../src/engine/fp30x/tones';

describe('FP-30X Tone Catalog', () => {
  const catalog = fp30xToneCatalog;

  describe('total counts', () => {
    it('has 314 total tones (256 GM2 minus 7 SN duplicates)', () => {
      expect(catalog.totalCount).toBe(314);
    });

    it('has 9 categories', () => {
      expect(catalog.categories.length).toBe(9);
    });

    it('has 65 SuperNATURAL tones', () => {
      const snCount = catalog.categories
        .filter(c => c.id !== 0x08)
        .reduce((sum, c) => sum + c.tones.length, 0);
      expect(snCount).toBe(65);
    });

    it('has 249 GM2 tones (7 SN duplicates hidden)', () => {
      const gm2Cat = catalog.categories.find(c => c.id === 0x08);
      expect(gm2Cat?.tones.length).toBe(249);
    });
  });

  describe('category counts', () => {
    it('Piano has 12 tones', () => {
      expect(SN_PIANO.length).toBe(12);
    });

    it('E.Piano has 7 tones', () => {
      expect(SN_EPIANO.length).toBe(7);
    });

    it('Organ has 13 tones', () => {
      expect(SN_ORGAN.length).toBe(13);
    });

    it('Strings has 8 tones', () => {
      expect(SN_STRINGS.length).toBe(8);
    });

    it('Pad has 7 tones', () => {
      expect(SN_PAD.length).toBe(7);
    });

    it('Synth has 3 tones', () => {
      expect(SN_SYNTH.length).toBe(3);
    });

    it('Other has 6 tones', () => {
      expect(SN_OTHER.length).toBe(6);
    });

    it('Drums has 9 tones', () => {
      expect(SN_DRUMS.length).toBe(9);
    });

    it('GM2 has 249 tones after hiding 7 SN duplicates', () => {
      expect(GM2_TONES.length).toBe(249);
    });
  });

  describe('findByDT1', () => {
    it('finds Concert Piano at (0, 0, 0)', () => {
      const tone = catalog.findByDT1(0, 0, 0);
      expect(tone).toBeDefined();
      expect(tone?.name).toBe('Concert Piano');
      expect(tone?.isGM2).toBe(false);
    });

    it('finds Harpsi 8\'+4\' at (0, 0, 11) — last Piano tone', () => {
      const tone = catalog.findByDT1(0, 0, 11);
      expect(tone?.name).toBe("Harpsi 8'+4'");
    });

    it('finds 1976SuitCase at (1, 0, 0) — first E.Piano', () => {
      const tone = catalog.findByDT1(1, 0, 0);
      expect(tone?.name).toBe('1976SuitCase');
    });

    it('finds Epic Strings at (3, 0, 0)', () => {
      const tone = catalog.findByDT1(3, 0, 0);
      expect(tone?.name).toBe('Epic Strings');
    });

    it('finds Standard Set at (7, 0, 0) — first Drums', () => {
      const tone = catalog.findByDT1(7, 0, 0);
      expect(tone?.name).toBe('Standard Set');
    });

    it('finds SFX Set at (7, 0, 8) — last Drums', () => {
      const tone = catalog.findByDT1(7, 0, 8);
      expect(tone?.name).toBe('SFX Set');
    });

    it('finds GM2 Piano 1 at (8, 0, 0)', () => {
      const tone = catalog.findByDT1(8, 0, 0);
      expect(tone?.name).toBe('Piano 1');
      expect(tone?.isGM2).toBe(true);
    });

    it('finds GM2 Organ 1 at (8, 0, 0x24)', () => {
      const tone = catalog.findByDT1(8, 0, 0x24);
      expect(tone?.name).toBe('Organ 1');
    });

    it('finds GM2 French Horn1 at (8, 1, 0) — first tone with indexHigh=1', () => {
      // Position 128 → indexHigh=1, indexLow=0
      const tone = catalog.findByDT1(8, 1, 0);
      expect(tone?.name).toBe('French Horn1');
      expect(tone?.position).toBe(128);
    });

    it('finds GM2 Explosion at (8, 1, 127) — last GM2 tone', () => {
      // Position 255 → indexHigh=1, indexLow=127
      const tone = catalog.findByDT1(8, 1, 127);
      expect(tone?.name).toBe('Explosion');
    });

    it('returns undefined for non-existent tone', () => {
      expect(catalog.findByDT1(9, 0, 0)).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('finds Concert Piano by ID "0-0-0"', () => {
      const tone = catalog.findById('0-0-0');
      expect(tone?.name).toBe('Concert Piano');
    });

    it('finds GM2 Piano 1 by ID "8-0-0"', () => {
      const tone = catalog.findById('8-0-0');
      expect(tone?.name).toBe('Piano 1');
    });

    it('returns undefined for non-existent ID', () => {
      expect(catalog.findById('99-0-0')).toBeUndefined();
    });
  });

  describe('searchByName', () => {
    it('finds tones matching "Piano"', () => {
      const results = catalog.searchByName('Piano');
      expect(results.length).toBeGreaterThan(5);
      expect(results.some(t => t.name === 'Concert Piano')).toBe(true);
    });

    it('searches case-insensitively', () => {
      const results = catalog.searchByName('piano');
      expect(results.some(t => t.name === 'Concert Piano')).toBe(true);
    });

    it('returns empty for no match', () => {
      expect(catalog.searchByName('zzzzz')).toEqual([]);
    });
  });

  describe('getToneAtPosition', () => {
    it('gets Concert Piano at position 0 in Piano category', () => {
      const tone = catalog.getToneAtPosition(0x00, 0);
      expect(tone?.name).toBe('Concert Piano');
    });

    it('gets last Synth tone at position 2', () => {
      const tone = catalog.getToneAtPosition(0x05, 2);
      expect(tone?.name).toBe('Flip Pad');
    });

    it('returns undefined for invalid position', () => {
      expect(catalog.getToneAtPosition(0x00, 99)).toBeUndefined();
    });

    it('returns undefined for invalid category', () => {
      expect(catalog.getToneAtPosition(0x09, 0)).toBeUndefined();
    });
  });

  describe('unique IDs', () => {
    it('all tones have unique IDs', () => {
      const ids = new Set<string>();
      for (const cat of catalog.categories) {
        for (const t of cat.tones) {
          expect(ids.has(t.id)).toBe(false);
          ids.add(t.id);
        }
      }
      expect(ids.size).toBe(314);
    });
  });

  describe('GM2 index encoding', () => {
    // GM2_TONES is filtered (7 SN duplicates hidden), so array index no
    // longer equals protocol position. Iterate by the tone's `position`
    // property instead.
    it('every surfaced GM2 tone has indexHigh/indexLow derived from its position', () => {
      for (const t of GM2_TONES) {
        expect(t.indexHigh).toBe(Math.floor(t.position / 128));
        expect(t.indexLow).toBe(t.position % 128);
      }
    });

    it('positions <128 produce indexHigh=0; positions >=128 produce indexHigh=1', () => {
      for (const t of GM2_TONES) {
        if (t.position < 128) {
          expect(t.indexHigh).toBe(0);
        } else {
          expect(t.indexHigh).toBe(1);
        }
      }
    });
  });

  describe('GM2 SN-duplicate positions are hidden', () => {
    const hiddenPositions = [22, 24, 27, 49, 53, 57, 77];

    it.each(hiddenPositions)(
      'GM2 position %i is not present in the catalog',
      position => {
        const present = GM2_TONES.some(t => t.position === position);
        expect(present).toBe(false);
      },
    );

    it.each(hiddenPositions)(
      'findByDT1(0x08, 0, %i) returns undefined',
      position => {
        expect(catalog.findByDT1(0x08, 0, position)).toBeUndefined();
      },
    );
  });
});
