/**
 * Channel-strip message builders.
 *
 * Turns a (possibly sparse) `ChannelStrip` into the exact byte sequences the
 * FP-30X needs, filling every omitted field with its neutral value so that
 * applying a scene is deterministic regardless of what ran before it.
 */

import type {ToneCatalog} from '../../types/types';
import type {
  MidiChannel,
  MidiChannelSnapshot,
  ShapingStrip,
} from '../../types/midiChannelStrip';
import {
  DRUM_CHANNEL,
  KEYBOARD_CHANNEL,
  NEUTRAL_STRIP,
} from '../../types/midiChannelStrip';
import {buildChannelToneChange, isDrumKit} from './bankProgram';

/** Control change numbers used by a strip. */
export const CC = {
  BANK_MSB: 0x00,
  BANK_LSB: 0x20,
  VOLUME: 0x07,
  PAN: 0x0a,
  DATA_ENTRY_MSB: 0x06,
  RELEASE: 0x48,
  ATTACK: 0x49,
  CUTOFF: 0x4a,
  DECAY: 0x4b,
  REVERB_SEND: 0x5b,
  CHORUS_SEND: 0x5d,
  RPN_LSB: 0x64,
  RPN_MSB: 0x65,
} as const;

const clamp7 = (v: number) => Math.max(0, Math.min(127, Math.round(v)));

function cc(channel: MidiChannel, controller: number, value: number): number[] {
  return [0xb0 | (channel - 1), controller, clamp7(value)];
}

/**
 * RPN 00 02H Master Coarse Tuning, in semitones (-24..+24 per the doc).
 *
 * Five messages: select the RPN (LSB then MSB, matching the ordering in the
 * doc's worked example), send the data-entry MSB, then set RPN null so a
 * stray Data Entry later can't land on this parameter. The data-entry LSB is
 * documented as ignored for coarse tuning, so it is not sent.
 */
export function buildCoarseTune(
  channel: MidiChannel,
  semitones: number,
): number[][] {
  const st = Math.max(-24, Math.min(24, Math.round(semitones)));
  return [
    cc(channel, CC.RPN_LSB, 0x02),
    cc(channel, CC.RPN_MSB, 0x00),
    cc(channel, CC.DATA_ENTRY_MSB, 0x40 + st),
    cc(channel, CC.RPN_LSB, 0x7f),
    cc(channel, CC.RPN_MSB, 0x7f),
  ];
}

/** The four mixer + four shaping controls, always in a stable order. */
const SHAPING_ORDER: Array<[keyof Required<ShapingStrip>, number]> = [
  ['volume', CC.VOLUME],
  ['pan', CC.PAN],
  ['reverbSend', CC.REVERB_SEND],
  ['chorusSend', CC.CHORUS_SEND],
  ['cutoff', CC.CUTOFF],
  ['attack', CC.ATTACK],
  ['decay', CC.DECAY],
  ['release', CC.RELEASE],
];

/** Shape accepted by the builder — the union of every per-channel strip. */
type AnyStrip = ShapingStrip & {toneId?: string; coarseTune?: number};

/**
 * Full message list for one channel, with neutrals filled in.
 *
 * Order: tone (CC0, CC32, PC) first so the shaping controls land on the voice
 * that will actually sound, then the eight shaping CCs, then coarse tune.
 *
 * Channel rules enforced here rather than at the call site:
 *  - ch.4 never receives a program change (DT1/panel owns the keyboard tone)
 *    or a coarse tune (would stack with DT1 TRANSPOSE)
 *  - ch.10 accepts rhythm sets only; any other tone is skipped
 */
export function buildStripMessages(
  channel: MidiChannel,
  strip: AnyStrip,
  catalog: ToneCatalog,
): number[][] {
  const out: number[][] = [];

  if (strip.toneId && channel !== KEYBOARD_CHANNEL) {
    const tone = catalog.findById(strip.toneId);
    if (tone && (channel !== DRUM_CHANNEL || isDrumKit(tone))) {
      out.push(...buildChannelToneChange(channel, tone));
    }
  }

  for (const [field, controller] of SHAPING_ORDER) {
    out.push(cc(channel, controller, strip[field] ?? NEUTRAL_STRIP[field]));
  }

  if (channel !== KEYBOARD_CHANNEL) {
    out.push(
      ...buildCoarseTune(channel, strip.coarseTune ?? NEUTRAL_STRIP.coarseTune),
    );
  }

  return out;
}

/**
 * Every message needed to apply a `MidiChannelSnapshot`.
 *
 * Only declared channels are touched — an undeclared channel keeps whatever it
 * was doing, which is what lets a scene reshape one layer without silencing
 * the others. Channels are emitted in ascending order so a capture/apply round
 * trip is byte-stable and diffable in tests.
 */
export function buildSnapshotMessages(
  snapshot: MidiChannelSnapshot,
  catalog: ToneCatalog,
): number[][] {
  const out: number[][] = [];
  const channels = Object.keys(snapshot.strips)
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 16)
    .sort((a, b) => a - b) as MidiChannel[];

  for (const ch of channels) {
    const strip = snapshot.strips[ch];
    if (strip) out.push(...buildStripMessages(ch, strip, catalog));
  }
  return out;
}

/** Message count for a snapshot, without building it — for BLE budgeting. */
export function countSnapshotMessages(
  snapshot: MidiChannelSnapshot,
  catalog: ToneCatalog,
): number {
  return buildSnapshotMessages(snapshot, catalog).length;
}
