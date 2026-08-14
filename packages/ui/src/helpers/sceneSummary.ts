import type { PerformanceSnapshot } from '@pianel/core/types/performanceSnapshot';
import type { VoicingMode } from '@pianel/core/types/voicingMode';

export interface ToneLine {
  role: 'upper' | 'lower' | 'single';
  glyph: string;
  name: string;
}

export interface SceneSummary {
  modeLabel: 'SINGLE' | 'DUAL' | 'SPLIT' | 'TWIN';
  tones: ToneLine[];
  splitPoint: string | null;
  tempo: number;
  volume: number;
}

const MODE_LABELS: Record<VoicingMode, SceneSummary['modeLabel']> = {
  single: 'SINGLE',
  dual: 'DUAL',
  split: 'SPLIT',
  twin: 'TWIN',
};

const PITCH_CLASSES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

const UNKNOWN = '—';
const UPPER_GLYPH = '▸';
const LOWER_GLYPH = '◂';

export function noteName(midiNote: number): string {
  const pitch = PITCH_CLASSES[((midiNote % 12) + 12) % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${pitch}${octave}`;
}

export function summariseScene(
  snapshot: PerformanceSnapshot,
  toneNameById: (id: string) => string | undefined,
): SceneSummary {
  const slot = snapshot.voiceModeSnapshot;
  const name = (id: string | null | undefined): string =>
    (id ? toneNameById(id) : undefined) ?? UNKNOWN;

  let tones: ToneLine[];
  switch (slot.voiceMode) {
    case 'split':
      tones = [
        { role: 'upper', glyph: UPPER_GLYPH, name: name(slot.rightToneId) },
        { role: 'lower', glyph: LOWER_GLYPH, name: name(slot.leftToneId) },
      ];
      break;
    case 'dual':
      tones = [
        { role: 'upper', glyph: UPPER_GLYPH, name: name(slot.rightToneId) },
        { role: 'upper', glyph: UPPER_GLYPH, name: name(slot.dualTone2Id) },
      ];
      break;
    default:
      tones = [{ role: 'single', glyph: '', name: name(slot.rightToneId) }];
  }

  return {
    modeLabel: MODE_LABELS[slot.voiceMode],
    tones,
    splitPoint:
      slot.voiceMode === 'split' && typeof slot.splitPoint === 'number'
        ? noteName(slot.splitPoint)
        : null,
    tempo: snapshot.tempo,
    volume: snapshot.volume,
  };
}
