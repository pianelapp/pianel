import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '../../../src/engine/fp30x/tones';
import {bankProgramForTone} from '../../../src/engine/fp30x/bankProgram';
import {
  ALL_MIDI_CHANNELS,
  DRUM_CHANNEL,
  KEYBOARD_CHANNEL,
  type MidiChannel,
} from '../../../src/types/midiChannelStrip';
import type {Tone} from '../../../src/types/types';

const engine = new FP30XEngine();

const allTones: Tone[] = fp30xToneCatalog.categories.flatMap(c => c.tones);
const rhythmSets = allTones.filter(t => t.category === 0x07);
const melodicTones = allTones.filter(t => t.category !== 0x07);

const ordinaryChannels = ALL_MIDI_CHANNELS.filter(
  c => c !== KEYBOARD_CHANNEL && c !== DRUM_CHANNEL,
);

const unmappedTone: Tone = {
  id: 'synthetic-unmapped',
  name: 'Synthetic Unmapped',
  category: 0x00,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 0,
  position: 999,
  isGM2: false,
};

describe('FP30XEngine.planChannelToneChange — channel 4', () => {
  it('refuses every melodic tone with the keyboard reason', () => {
    const reasons = new Set(
      melodicTones.map(t => {
        const plan = engine.planChannelToneChange(KEYBOARD_CHANNEL, t);
        return plan.eligible ? 'eligible' : plan.reason;
      }),
    );
    expect([...reasons]).toEqual(['keyboard-channel']);
  });

  it('refuses rhythm sets too', () => {
    for (const kit of rhythmSets) {
      const plan = engine.planChannelToneChange(KEYBOARD_CHANNEL, kit);
      expect(plan).toEqual({eligible: false, reason: 'keyboard-channel'});
    }
  });
});

describe('FP30XEngine.planChannelToneChange — channel 10', () => {
  it('refuses every melodic tone with the drum-kit reason', () => {
    const reasons = new Set(
      melodicTones.map(t => {
        const plan = engine.planChannelToneChange(DRUM_CHANNEL, t);
        return plan.eligible ? 'eligible' : plan.reason;
      }),
    );
    expect([...reasons]).toEqual(['requires-drum-kit']);
  });

  it('accepts all nine rhythm sets', () => {
    expect(rhythmSets).toHaveLength(9);
    for (const kit of rhythmSets) {
      const plan = engine.planChannelToneChange(DRUM_CHANNEL, kit);
      expect(plan.eligible).toBe(true);
    }
  });
});

describe('FP30XEngine.planChannelToneChange — ordinary channels', () => {
  it('accepts every catalog tone with the bytes its mapping dictates', () => {
    expect(ordinaryChannels).toEqual([
      1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16,
    ]);

    const refused: string[] = [];
    const wrongBytes: string[] = [];
    for (const channel of ordinaryChannels) {
      for (const tone of allTones) {
        const plan = engine.planChannelToneChange(channel, tone);
        if (!plan.eligible) {
          refused.push(`ch${channel}/${tone.id}`);
          continue;
        }
        const bp = bankProgramForTone(tone)!;
        const n = channel - 1;
        const expected = [
          [0xb0 | n, 0x00, bp.msb],
          [0xb0 | n, 0x20, bp.lsb],
          [0xc0 | n, bp.pc - 1],
        ];
        if (JSON.stringify(plan.messages) !== JSON.stringify(expected)) {
          wrongBytes.push(`ch${channel}/${tone.id}`);
        }
      }
    }
    expect(refused).toEqual([]);
    expect(wrongBytes).toEqual([]);
  });
});

describe('FP30XEngine.planChannelToneChange — refusals', () => {
  it('refuses a tone with no mapping and yields no messages', () => {
    expect(bankProgramForTone(unmappedTone)).toBeNull();
    const plan = engine.planChannelToneChange(5, unmappedTone);
    expect(plan).toEqual({eligible: false, reason: 'tone-not-assignable'});
    expect(plan.eligible ? plan.messages : []).toEqual([]);
  });

  it('refuses a channel outside 1-16 rather than throwing', () => {
    const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
    for (const bad of [0, 17, -1, 1.5, Number.NaN]) {
      expect(
        engine.planChannelToneChange(bad as MidiChannel, concertPiano),
      ).toEqual({eligible: false, reason: 'channel-out-of-range'});
    }
  });
});

describe('FP30XEngine.planChannelToneChange — eligible plan shape', () => {
  const concertPiano = fp30xToneCatalog.findById('0-0-0')!;

  it('emits bank MSB, bank LSB then program change with the channel nibble', () => {
    const plan = engine.planChannelToneChange(5, concertPiano);
    expect(plan).toEqual({
      eligible: true,
      messages: [
        [0xb4, 0x00, 0],
        [0xb4, 0x20, 68],
        [0xc4, 0],
      ],
    });
  });
});
