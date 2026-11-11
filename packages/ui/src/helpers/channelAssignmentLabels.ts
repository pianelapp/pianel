import type {
  ChannelToneAssignmentRefusal,
  ChannelToneIneligibility,
  MidiChannel,
} from '../store';

export const ASSIGN_ACTION_LABEL = 'Assign to MIDI channel';

export const ASSIGN_ACTION_DISCONNECTED_LABEL =
  'Assign to MIDI channel (piano not connected)';

export const ASSIGNMENTS_ACTION_LABEL = 'MIDI Channel Assignments';

export const CHANNEL_INELIGIBILITY_LABELS: Record<
  ChannelToneIneligibility,
  string
> = {
  'keyboard-channel': 'Follows the tone selected on the piano',
  'requires-drum-kit': 'Drum kits only',
  'tone-not-assignable': 'No MIDI channel equivalent',
  'channel-out-of-range': 'Not a MIDI channel on this piano',
};

export interface RefusalAlert {
  variant: 'warning' | 'error';
  title: string;
  message: (channel: MidiChannel) => string;
}

export const CHANNEL_REFUSAL_ALERTS: Record<
  ChannelToneAssignmentRefusal,
  RefusalAlert
> = {
  'not-connected': {
    variant: 'warning',
    title: 'Piano not connected',
    message: () => 'Connect your piano to assign tones to MIDI channels.',
  },
  'send-failed': {
    variant: 'error',
    title: 'Assignment did not complete',
    message: channel =>
      `Assignment did not complete. Channel ${channel} still has whatever it had before.`,
  },
  'keyboard-channel': {
    variant: 'error',
    title: 'Channel not available',
    message: channel =>
      `Channel ${channel} follows the tone selected on the piano, so Pianel cannot assign to it.`,
  },
  'requires-drum-kit': {
    variant: 'error',
    title: 'Channel not available',
    message: channel => `Channel ${channel} accepts drum kits only.`,
  },
  'tone-not-assignable': {
    variant: 'error',
    title: 'Tone not assignable',
    message: () => 'This tone has no MIDI channel equivalent.',
  },
  'channel-out-of-range': {
    variant: 'error',
    title: 'Channel not available',
    message: channel => `Channel ${channel} is not a MIDI channel on this piano.`,
  },
};

export function channelRowLabel(channel: MidiChannel): string {
  return `Ch. ${channel}`;
}

export function assignmentSentMessage(
  toneName: string,
  channel: MidiChannel,
): string {
  return `${toneName} sent to channel ${channel}`;
}
