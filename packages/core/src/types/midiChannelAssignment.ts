import type {MidiChannel} from './midiChannelStrip';

export type ChannelToneIneligibility =
  | 'keyboard-channel'
  | 'requires-drum-kit'
  | 'tone-not-assignable'
  | 'channel-out-of-range';

export type ChannelToneChangePlan =
  | {eligible: true; messages: number[][]}
  | {eligible: false; reason: ChannelToneIneligibility};

export type ChannelToneAssignmentRefusal =
  | ChannelToneIneligibility
  | 'not-connected'
  | 'send-failed';

export type ChannelToneAssignmentResult =
  | {status: 'applied'; channel: MidiChannel; toneId: string}
  | {
      status: 'refused';
      channel: MidiChannel;
      reason: ChannelToneAssignmentRefusal;
    };

export interface ChannelToneTarget {
  channel: MidiChannel;
  eligible: boolean;
  reason: ChannelToneIneligibility | null;
}
