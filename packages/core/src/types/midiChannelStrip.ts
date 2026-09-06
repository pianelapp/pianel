/**
 * Per-MIDI-channel strip — the app-authoritative half of a performance snapshot.
 *
 * These parameters have NO read-back path. The FP-30X answers RQ1 only for the
 * DT1 performance block (keyboard part); nothing in the MIDI Implementation
 * exposes the state of channels 1-16. That makes this the one place in the app
 * where Constitution II ("hardware state wins") does not apply — there is no
 * hardware state to lose to. Writes are fire-and-forget and this store is the
 * only record of what was sent.
 *
 * WHY NEUTRALS MATTER: control changes survive both Program Change and CC121
 * Reset All Controllers (MIDI Implementation, Receive Data §Control Change:
 * "The value specified by a Control Change message will not be reset even by a
 * Program Change"). A sparse scene would therefore INHERIT whatever the
 * previous scene left behind, making recall order-dependent. Apply closes that
 * hole by writing `NEUTRAL_STRIP` for every field a scene leaves undefined —
 * but only on channels the scene actually declares, so untouched layers keep
 * sounding.
 */

/** MIDI channel in human numbering. Wire nibble is `channel - 1`. */
export type MidiChannel =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/** The channel the FP-30X keyboard/panel part occupies. */
export const KEYBOARD_CHANNEL = 4 as const;

/** The GM2 percussion channel — accepts rhythm sets (bank 120) only. */
export const DRUM_CHANNEL = 10 as const;

/** Shaping + mixer fields common to every channel. All optional; absent ⇒
 *  apply writes the neutral value. */
export interface ShapingStrip {
  /** CC7 — 0-127. Doc initial 100. */
  volume?: number;
  /** CC10 — 0-127, 64 = centre. */
  pan?: number;
  /** CC91 — 0-127. Doc initial 40. Send into the (global) reverb unit. */
  reverbSend?: number;
  /** CC93 — 0-127. Doc initial 0. Send into the (global) chorus unit. */
  chorusSend?: number;
  /** CC74 — relative, 0-127 maps to -64..+63. 64 = no change. */
  cutoff?: number;
  /** CC73 — relative, 64 = no change. */
  attack?: number;
  /** CC75 — relative, 64 = no change. */
  decay?: number;
  /** CC72 — relative, 64 = no change. */
  release?: number;
}

/** A channel that can host a tone of its own (everything except the keyboard). */
export interface ChannelStrip extends ShapingStrip {
  /** Catalog tone id. Applied as CC0 + CC32 + Program Change. */
  toneId?: string;
  /**
   * RPN 00 02H Master Coarse Tuning, in semitones (-24..+24).
   *
   * Transposes the SOUND only — the note numbers on the wire are unchanged
   * (verified on hardware), so ChordService and the note display keep seeing
   * what was actually played. This is what makes an octave-apart layer
   * possible when rebuilding Dual across two channels.
   */
  coarseTune?: number;
}

/**
 * Channel 4 — the keyboard part. Shaping only.
 *
 * No `toneId`: Bank Select + PC here fights the DT1 tone register that the
 * panel owns and that RQ1 echoes back, so tone selection stays on the DT1 path.
 * No `coarseTune`: it would stack with DT1 TRANSPOSE (01 00 03 07), giving two
 * live transpositions with the app aware of only one. Octave shifts for the
 * native Split/Dual layers already exist as the DT1 shift registers.
 *
 * What this DOES unlock is filter and envelope control over the sound actually
 * played from the keys — the FP-30X panel exposes no such parameter at all.
 */
export type KeyboardStrip = ShapingStrip;

/** Channel 10 — percussion. `toneId` must resolve to one of the nine kits. */
export interface DrumStrip extends ShapingStrip {
  /** Catalog id of a rhythm set (DT1 category 0x07). */
  toneId?: string;
}

/** Picks the strip shape a given channel is allowed to carry. */
export type StripFor<C extends MidiChannel> = C extends typeof KEYBOARD_CHANNEL
  ? KeyboardStrip
  : C extends typeof DRUM_CHANNEL
    ? DrumStrip
    : ChannelStrip;

/** Sparse per-channel map. Absent channel ⇒ apply leaves it completely alone. */
export type MidiChannelStrips = {[C in MidiChannel]?: StripFor<C>};

/**
 * Neutral value for every shaping field, from the MIDI Implementation's
 * documented initial values. Apply writes these for fields a scene omits.
 *
 * `toneId` is deliberately absent: there is no "no program" message. A scene
 * that omits the tone leaves whatever program is loaded, which is the right
 * behaviour — it lets a scene reshape a layer without respecifying its sound.
 */
export const NEUTRAL_STRIP: Required<ShapingStrip> & {coarseTune: number} = {
  volume: 100, // 64H
  pan: 64, // 40H, centre
  reverbSend: 40, // 28H
  chorusSend: 0, // 00H
  cutoff: 64, // 40H, no change
  attack: 64,
  decay: 64,
  release: 64,
  coarseTune: 0, // RPN 40H, ±0 semitones
};

/** Global effect units. Shared by all 16 channels — the FP-30X has exactly one
 *  reverb and one chorus, so per-channel control is limited to the sends.
 *  Stored alongside the strips because a send level is meaningless without
 *  knowing which reverb it feeds. */
export interface GlobalFxSnapshot {
  /** 0=Room1 1=Room2 2=Room3 3=Hall1 4=Hall2 8=Plate. */
  reverbType?: number;
  /** 0-127. */
  reverbTime?: number;
  /** 0=Chorus1..3=Chorus4, 4=FB Chorus, 5=Flanger. */
  chorusType?: number;
  /** 0-127 — chorus output routed on into the reverb. */
  chorusSendToReverb?: number;
}

/** The MIDI-channel half of a performance snapshot. Sparse by design. */
export interface MidiChannelSnapshot {
  strips: MidiChannelStrips;
  globalFx?: GlobalFxSnapshot;
}

/** Empty snapshot — apply is a no-op, nothing on the piano is touched. */
export const EMPTY_MIDI_CHANNEL_SNAPSHOT: MidiChannelSnapshot = {strips: {}};

/** All sixteen channels, in apply order. */
export const ALL_MIDI_CHANNELS: readonly MidiChannel[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
];
