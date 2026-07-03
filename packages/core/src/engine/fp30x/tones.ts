/**
 * FP-30X Tone Catalog
 *
 * Catalog of 314 tones surfaced to the UI: 65 SuperNATURAL + 249 GM2.
 * The piano supports 256 GM2 positions, but 7 of them duplicate sounds
 * already present in the SuperNATURAL catalog (matching Bank MSB 121 /
 * LSB / PC). Those 7 GM2 duplicates are filtered out of the UI catalog
 * — see `GM2_DUPLICATE_OF_SN_POSITIONS` below. Their positions stay
 * reserved because GM2 indices are positional; the piano still accepts
 * them on the wire, they're just hidden from the picker.
 *
 * DT1 tone selection writes 3 data bytes to address 01 00 02 07:
 *   [category, indexHigh, indexLow]
 *
 * SuperNATURAL tones (categories 0x00-0x07): indexHigh is always 0.
 * GM2 tones (category 0x08): indexHigh = floor(position / 128),
 *                             indexLow  = position % 128.
 *
 * Source of truth: docs/roland-sysex-discovery.md
 */

import type {Tone, ToneCategory, ToneCatalog} from '../../types/types';

// ─── Helper ──────────────────────────────────────────────────

function tone(
  category: number,
  categoryName: string,
  position: number,
  name: string,
): Tone {
  const isGM2 = category === 0x08;
  const indexHigh = isGM2 ? Math.floor(position / 128) : 0;
  const indexLow = isGM2 ? position % 128 : position;
  return {
    id: `${category}-${indexHigh}-${indexLow}`,
    name,
    category,
    categoryName,
    indexHigh,
    indexLow,
    position,
    isGM2,
  };
}

// ─── SuperNATURAL Tones (65 total, 8 categories) ────────────

/** Category 0x00 — Piano (12 tones) */
export const SN_PIANO: Tone[] = [
  tone(0x00, 'Piano', 0, 'Concert Piano'),
  tone(0x00, 'Piano', 1, 'Ballad Piano'),
  tone(0x00, 'Piano', 2, 'Mellow Piano'),
  tone(0x00, 'Piano', 3, 'Bright Piano'),
  tone(0x00, 'Piano', 4, 'Upright Piano'),
  tone(0x00, 'Piano', 5, 'Mellow Upright'),
  tone(0x00, 'Piano', 6, 'Bright Upright'),
  tone(0x00, 'Piano', 7, 'Rock Piano'),
  tone(0x00, 'Piano', 8, 'Ragtime Piano'),
  tone(0x00, 'Piano', 9, 'Magical Piano'),
  tone(0x00, 'Piano', 10, 'Harpsichord'),
  tone(0x00, 'Piano', 11, "Harpsi 8'+4'"),
];

/** Category 0x01 — E.Piano (7 tones) */
export const SN_EPIANO: Tone[] = [
  tone(0x01, 'E.Piano', 0, '1976SuitCase'),
  tone(0x01, 'E.Piano', 1, 'Wurly 200'),
  tone(0x01, 'E.Piano', 2, 'Phase EP Mix'),
  tone(0x01, 'E.Piano', 3, "80's FM EP"),
  tone(0x01, 'E.Piano', 4, 'Clav.'),
  tone(0x01, 'E.Piano', 5, 'Vibraphone'),
  tone(0x01, 'E.Piano', 6, 'Celesta'),
];

/** Category 0x02 — Organ (13 tones) */
export const SN_ORGAN: Tone[] = [
  tone(0x02, 'Organ', 0, 'B.Organ Slow'),
  tone(0x02, 'Organ', 1, 'Combo Jz.Org'),
  tone(0x02, 'Organ', 2, 'Ballad Organ'),
  tone(0x02, 'Organ', 3, 'Gospel Spin'),
  tone(0x02, 'Organ', 4, 'Full Stops'),
  tone(0x02, 'Organ', 5, 'Mellow Bars'),
  tone(0x02, 'Organ', 6, 'Lower Organ'),
  tone(0x02, 'Organ', 7, 'Light Organ'),
  tone(0x02, 'Organ', 8, 'Pipe Organ'),
  tone(0x02, 'Organ', 9, "Nason Flt 8'"),
  tone(0x02, 'Organ', 10, 'ChurchOrgan1'),
  tone(0x02, 'Organ', 11, 'ChurchOrgan2'),
  tone(0x02, 'Organ', 12, 'Accordion'),
];

/** Category 0x03 — Strings (8 tones) */
export const SN_STRINGS: Tone[] = [
  tone(0x03, 'Strings', 0, 'Epic Strings'),
  tone(0x03, 'Strings', 1, 'Rich Strings'),
  tone(0x03, 'Strings', 2, 'SymphonicStr1'),
  tone(0x03, 'Strings', 3, 'SymphonicStr2'),
  tone(0x03, 'Strings', 4, 'Orchestra'),
  tone(0x03, 'Strings', 5, 'String Trio'),
  tone(0x03, 'Strings', 6, 'Harpiness'),
  tone(0x03, 'Strings', 7, 'OrchestraBrs'),
];

/** Category 0x04 — Pad (7 tones) */
export const SN_PAD: Tone[] = [
  tone(0x04, 'Pad', 0, 'Super SynPad'),
  tone(0x04, 'Pad', 1, 'Choir Aahs 1'),
  tone(0x04, 'Pad', 2, 'Choir Aahs 2'),
  tone(0x04, 'Pad', 3, 'D50 StackPad'),
  tone(0x04, 'Pad', 4, 'JP8 Strings'),
  tone(0x04, 'Pad', 5, 'Soft Pad'),
  tone(0x04, 'Pad', 6, 'Solina'),
];

/** Category 0x05 — Synth (3 tones) */
export const SN_SYNTH: Tone[] = [
  tone(0x05, 'Synth', 0, 'Super Saw'),
  tone(0x05, 'Synth', 1, 'Trancy Synth'),
  tone(0x05, 'Synth', 2, 'Flip Pad'),
];

/** Category 0x06 — Other (6 tones) */
export const SN_OTHER: Tone[] = [
  tone(0x06, 'Other', 0, 'Jazz Scat'),
  tone(0x06, 'Other', 1, "Comp'd JBass"),
  tone(0x06, 'Other', 2, 'Nylon-str.Gt'),
  tone(0x06, 'Other', 3, 'Steel-str.Gt'),
  tone(0x06, 'Other', 4, 'AcousticBass'),
  tone(0x06, 'Other', 5, 'A.Bass+Cymbl'),
];

/** Category 0x07 — Drums (9 kits) */
export const SN_DRUMS: Tone[] = [
  tone(0x07, 'Drums', 0, 'Standard Set'),
  tone(0x07, 'Drums', 1, 'Room Set'),
  tone(0x07, 'Drums', 2, 'Power Set'),
  tone(0x07, 'Drums', 3, 'Electric Set'),
  tone(0x07, 'Drums', 4, 'Analog Set'),
  tone(0x07, 'Drums', 5, 'Jazz Set'),
  tone(0x07, 'Drums', 6, 'Brush Set'),
  tone(0x07, 'Drums', 7, 'Orchestra Set'),
  tone(0x07, 'Drums', 8, 'SFX Set'),
];

// ─── GM2 Tones (256 positions, 249 surfaced, category 0x08) ───

/**
 * All 256 GM2 tone names in sequential order (position 0-255).
 * Entries marked DUPLICATE OF SN are also present in the SuperNATURAL
 * catalog (same Bank MSB 121 / LSB / PC) and are filtered out of the
 * surfaced GM2 list — see `GM2_DUPLICATE_OF_SN_POSITIONS`.
 */
const GM2_TONE_NAMES: string[] = [
  // 0-7: Piano
  'Piano 1',
  'Piano 1w',
  'Piano 1d',
  'Piano 2',
  'Piano 2w',
  'Piano 3',
  'Piano 3w',
  'Honky-tonk',
  // 8-15: Honky-tonk / E.Piano
  'Honky-tonk w',
  'E.Piano 1',
  'Detuned EP 1',
  'Vintage EP',
  "60's E.Piano",
  'E.Piano 2',
  'Detuned EP 2',
  'St.FM EP',
  // 16-23: EP / Harpsichord / Clav
  'EP Legend',
  'EP Phaser',
  'Harpsi.',
  'Coupled Hps.',
  'Harpsi.w',
  'Harpsi.o',
  'Clav.', // pos 22 — DUPLICATE OF SN E.Piano "Clav." (1-0-4)
  'Pulse Clav.',
  // 24-31: Celesta / Mallet / Bells
  'Celesta', // pos 24 — DUPLICATE OF SN E.Piano "Celesta" (1-0-6)
  'Glockenspiel',
  'Music Box',
  'Vibraphone', // pos 27 — DUPLICATE OF SN E.Piano "Vibraphone" (1-0-5)
  'Vibraphone w',
  'Marimba',
  'Marimba w',
  'Xylophone',
  // 32-39: Tubular Bells / Organ
  'TubularBells',
  'Church Bell',
  'Carillon',
  'Santur',
  'Organ 1',
  'TremoloOrgan',
  "60's Organ",
  'Organ 2',
  // 40-47: Organ continued
  'Perc.Organ 1',
  'Chorus Organ',
  'Perc.Organ 2',
  'Rock Organ',
  'Church Org.1',
  'Church Org.2',
  'Church Org.3',
  'Reed Organ',
  // 48-55: Organ / Accordion / Guitar
  'Puff Organ',
  'Accordion 1', // pos 49 — DUPLICATE OF SN Organ "Accordion" (2-0-12)
  'Accordion 2',
  'Harmonica',
  'Bandoneon',
  'Nylon-str.Gt', // pos 53 — DUPLICATE OF SN Other "Nylon-str.Gt" (6-0-2)
  'Ukulele',
  'Nylon Gt o',
  // 56-63: Guitar
  'Nylon Gt 2',
  'Steel-str.Gt', // pos 57 — DUPLICATE OF SN Other "Steel-str.Gt" (6-0-3)
  '12-str.Gt',
  'Mandolin',
  'Steel+Body',
  'Jazz Guitar',
  'Hawaiian Gt',
  'Clean Guitar',
  // 64-71: Guitar continued
  'Chorus Gt 1',
  'Mid Tone Gt',
  'Muted Guitar',
  'Funk Guitar1',
  'Funk Guitar2',
  'Chorus Gt 2',
  'Overdrive Gt',
  'Guitar Pinch',
  // 72-79: Distortion Guitar / Bass
  'DistortionGt',
  'Gt Feedback1',
  'Dist.Rhy Gt',
  'Gt Harmonics',
  'Gt Feedback2',
  'AcousticBass', // pos 77 — DUPLICATE OF SN Other "AcousticBass" (6-0-4)
  'FingeredBass',
  'Finger Slap',
  // 80-87: Bass
  'Picked Bass',
  'FretlessBass',
  'Slap Bass 1',
  'Slap Bass 2',
  'Synth Bass 1',
  'WarmSyn.Bass',
  'Synth Bass 3',
  'Clav.Bass',
  // 88-95: Bass / Strings
  'Hammer Bass',
  'Synth Bass 2',
  'Synth Bass 4',
  'RubberSyn.Bs',
  'Attack Pulse',
  'Violin',
  'Slow Violin',
  'Viola',
  // 96-103: Strings
  'Cello',
  'Contrabass',
  'Tremolo Str.',
  'PizzicatoStr',
  'Harp',
  'Yang Qin',
  'Timpani',
  'Strings',
  // 104-111: Strings / Ensemble
  'Orchestra',
  "60's Strings",
  'Slow Strings',
  'Syn.Strings1',
  'Syn.Strings3',
  'Syn.Strings2',
  'Choir 1',
  'Choir 2',
  // 112-119: Voice / Hits / Brass
  'Voice',
  'Humming',
  'Synth Voice',
  'Analog Voice',
  'OrchestraHit',
  'Bass Hit',
  '6th Hit',
  'Euro Hit',
  // 120-127: Brass
  'Trumpet',
  'Dark Trumpet',
  'Trombone 1',
  'Trombone 2',
  'Bright Tb',
  'Tuba',
  'MuteTrumpet1',
  'MuteTrumpet2',
  // 128-135: Brass / Woodwind
  'French Horn1',
  'French Horn2',
  'Brass 1',
  'Brass 2',
  'Synth Brass1',
  'Synth Brass3',
  'AnalogBrass1',
  'Jump Brass',
  // 136-143: Brass / Sax
  'Synth Brass2',
  'Synth Brass4',
  'AnalogBrass2',
  'Soprano Sax',
  'Alto Sax',
  'Tenor Sax',
  'Baritone Sax',
  'Oboe',
  // 144-151: Woodwind
  'English Horn',
  'Bassoon',
  'Clarinet',
  'Piccolo',
  'Flute',
  'Recorder',
  'Pan Flute',
  'Bottle Blow',
  // 152-159: Woodwind / Synth Lead
  'Shakuhachi',
  'Whistle',
  'Ocarina',
  'Square Lead1',
  'Square Lead2',
  'Sine Lead',
  'Saw Lead 1',
  'Saw Lead 2',
  // 160-167: Synth Lead
  'Doctor Solo',
  'Natural Lead',
  'SequencedSaw',
  'Syn.Calliope',
  'Chiffer Lead',
  'Charang',
  'Wire Lead',
  'Solo Vox',
  // 168-175: Synth Lead / Pad
  '5th Saw Lead',
  'Bass+Lead',
  'Delayed Lead',
  'Fantasia',
  'Warm Pad',
  'Sine Pad',
  'Polysynth',
  'Space Voice',
  // 176-183: Synth Pad
  'Itopia',
  'Bowed Glass',
  'Metallic Pad',
  'Halo Pad',
  'Sweep Pad',
  'Ice Rain',
  'Soundtrack',
  'Crystal',
  // 184-191: Synth Effects
  'Synth Mallet',
  'Atmosphere',
  'Brightness',
  'Goblins',
  'Echo Drops',
  'Echo Bell',
  'Echo Pan',
  'Star Theme',
  // 192-199: Ethnic
  'Sitar 1',
  'Sitar 2',
  'Banjo',
  'Shamisen',
  'Koto',
  'Taisho Koto',
  'Kalimba',
  'Bagpipe',
  // 200-207: Ethnic / Percussion
  'Fiddle',
  'Shanai',
  'Tinkle Bell',
  'Agogo',
  'Steel Drums',
  'Woodblock',
  'Castanets',
  'Taiko',
  // 208-215: Percussion / Drums
  'Concert BD',
  'Melodic Tom1',
  'Melodic Tom2',
  'Synth Drum',
  'TR-808 Tom',
  'Elec.Perc.',
  'Reverse Cym.',
  'Gt FretNoise',
  // 216-223: Sound Effects
  'Gt Cut Noise',
  'BsStringSlap',
  'Breath Noise',
  'Fl.Key Click',
  'Seashore',
  'Rain',
  'Thunder',
  'Wind',
  // 224-231: Sound Effects
  'Stream',
  'Bubble',
  'Bird 1',
  'Dog',
  'Horse Gallop',
  'Bird 2',
  'Telephone 1',
  'Telephone 2',
  // 232-239: Sound Effects
  'DoorCreaking',
  'Door',
  'Scratch',
  'Wind Chimes',
  'Helicopter',
  'Car Engine',
  'Car Stop',
  'Car Pass',
  // 240-247: Sound Effects
  'Car Crash',
  'Siren',
  'Train',
  'Jetplane',
  'Starship',
  'Burst Noise',
  'Applause',
  'Laughing',
  // 248-255: Sound Effects
  'Screaming',
  'Punch',
  'Heart Beat',
  'Footsteps',
  'Gun Shot',
  'Machine Gun',
  'Laser Gun',
  'Explosion',
];

/**
 * GM2 positions whose sound is already exposed under the SuperNATURAL
 * catalog. Each shares Bank MSB 121 / LSB / PC with its SN twin (see
 * docs/roland-sysex-discovery.md §7 & §8). Hidden from the UI catalog
 * so the same sound doesn't appear twice in the picker.
 *
 *   pos 22  Clav.        → SN E.Piano "Clav."        (1-0-4)
 *   pos 24  Celesta      → SN E.Piano "Celesta"      (1-0-6)
 *   pos 27  Vibraphone   → SN E.Piano "Vibraphone"   (1-0-5)
 *   pos 49  Accordion 1  → SN Organ   "Accordion"    (2-0-12)
 *   pos 53  Nylon-str.Gt → SN Other   "Nylon-str.Gt" (6-0-2)
 *   pos 57  Steel-str.Gt → SN Other   "Steel-str.Gt" (6-0-3)
 *   pos 77  AcousticBass → SN Other   "AcousticBass" (6-0-4)
 */
const GM2_DUPLICATE_OF_SN_POSITIONS: ReadonlySet<number> = new Set([
  22, 24, 27, 49, 53, 57, 77,
]);

/** Category 0x08 — GM2 (249 tones; 7 SN duplicates hidden). */
export const GM2_TONES: Tone[] = GM2_TONE_NAMES.map((name, position) =>
  tone(0x08, 'GM2', position, name),
).filter(t => !GM2_DUPLICATE_OF_SN_POSITIONS.has(t.position));

// ─── Category Arrays ─────────────────────────────────────────

/** All SuperNATURAL categories with their tones. */
export const SN_CATEGORIES: ToneCategory[] = [
  {id: 0x00, name: 'Piano', tones: SN_PIANO},
  {id: 0x01, name: 'E.Piano', tones: SN_EPIANO},
  {id: 0x02, name: 'Organ', tones: SN_ORGAN},
  {id: 0x03, name: 'Strings', tones: SN_STRINGS},
  {id: 0x04, name: 'Pad', tones: SN_PAD},
  {id: 0x05, name: 'Synth', tones: SN_SYNTH},
  {id: 0x06, name: 'Other', tones: SN_OTHER},
  {id: 0x07, name: 'Drums', tones: SN_DRUMS},
];

/** GM2 category. */
export const GM2_CATEGORY: ToneCategory = {
  id: 0x08,
  name: 'GM2',
  tones: GM2_TONES,
};

/** All 9 categories (8 SN + 1 GM2). */
export const ALL_CATEGORIES: ToneCategory[] = [...SN_CATEGORIES, GM2_CATEGORY];

// ─── Catalog Factory ─────────────────────────────────────────

function createFP30XToneCatalog(): ToneCatalog {
  const categories = ALL_CATEGORIES;

  // Build lookup maps for O(1) access
  const dt1Map = new Map<string, Tone>();
  const idMap = new Map<string, Tone>();

  for (const cat of categories) {
    for (const t of cat.tones) {
      dt1Map.set(`${t.category}-${t.indexHigh}-${t.indexLow}`, t);
      idMap.set(t.id, t);
    }
  }

  const totalCount = categories.reduce((sum, cat) => sum + cat.tones.length, 0);

  return {
    categories,
    totalCount,

    findByDT1(
      category: number,
      indexHigh: number,
      indexLow: number,
    ): Tone | undefined {
      return dt1Map.get(`${category}-${indexHigh}-${indexLow}`);
    },

    findById(id: string): Tone | undefined {
      return idMap.get(id);
    },

    searchByName(query: string): Tone[] {
      const lower = query.toLowerCase();
      const results: Tone[] = [];
      for (const cat of categories) {
        for (const t of cat.tones) {
          if (t.name.toLowerCase().includes(lower)) {
            results.push(t);
          }
        }
      }
      return results;
    },

    getToneAtPosition(categoryId: number, position: number): Tone | undefined {
      const cat = categories.find(c => c.id === categoryId);
      if (!cat) return undefined;
      return cat.tones[position];
    },
  };
}

// ─── Singleton Export ────────────────────────────────────────

/** FP-30X tone catalog singleton. 65 SuperNATURAL + 249 GM2 = 314 tones
 *  surfaced to the UI (7 GM2 positions hidden as SN duplicates). */
export const fp30xToneCatalog: ToneCatalog = createFP30XToneCatalog();
