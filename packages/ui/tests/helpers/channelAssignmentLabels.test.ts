import {
  ASSIGN_ACTION_DISCONNECTED_LABEL,
  ASSIGN_ACTION_LABEL,
  ASSIGNMENTS_ACTION_LABEL,
  CHANNEL_INELIGIBILITY_LABELS,
  CHANNEL_REFUSAL_ALERTS,
  assignmentSentMessage,
  channelRowLabel,
} from '../../src/helpers/channelAssignmentLabels';
import type {MidiChannel} from '../../src/store';

describe('channelAssignmentLabels', () => {
  it('covers every ineligibility reason with non-empty copy', () => {
    const keys = Object.keys(CHANNEL_INELIGIBILITY_LABELS).sort();
    expect(keys).toEqual([
      'channel-out-of-range',
      'keyboard-channel',
      'requires-drum-kit',
      'tone-not-assignable',
    ]);
    for (const copy of Object.values(CHANNEL_INELIGIBILITY_LABELS)) {
      expect(copy.length).toBeGreaterThan(0);
    }
  });

  it('covers every refusal reason with an alert', () => {
    const keys = Object.keys(CHANNEL_REFUSAL_ALERTS).sort();
    expect(keys).toEqual([
      'channel-out-of-range',
      'keyboard-channel',
      'not-connected',
      'requires-drum-kit',
      'send-failed',
      'tone-not-assignable',
    ]);
    for (const alert of Object.values(CHANNEL_REFUSAL_ALERTS)) {
      expect(alert.title.length).toBeGreaterThan(0);
      expect(alert.message(5).length).toBeGreaterThan(0);
      expect(['warning', 'error']).toContain(alert.variant);
    }
  });

  it('states that the channel still holds what it had on a failed send', () => {
    expect(CHANNEL_REFUSAL_ALERTS['send-failed'].message(5)).toBe(
      'Assignment did not complete. Channel 5 still has whatever it had before.',
    );
    expect(CHANNEL_REFUSAL_ALERTS['send-failed'].variant).toBe('error');
  });

  it('names the keyboard and drum restrictions in the row copy', () => {
    expect(CHANNEL_INELIGIBILITY_LABELS['keyboard-channel']).toBe(
      'Follows the tone selected on the piano',
    );
    expect(CHANNEL_INELIGIBILITY_LABELS['requires-drum-kit']).toBe(
      'Drum kits only',
    );
  });

  it('carries the disconnected reason inside the action label', () => {
    expect(ASSIGN_ACTION_LABEL).toBe('Assign to MIDI channel');
    expect(ASSIGN_ACTION_DISCONNECTED_LABEL).toContain(ASSIGN_ACTION_LABEL);
    expect(ASSIGN_ACTION_DISCONNECTED_LABEL).toContain('not connected');
    expect(CHANNEL_REFUSAL_ALERTS['not-connected'].message(5)).toBe(
      'Connect your piano to assign tones to MIDI channels.',
    );
  });

  it('names the read-only assignments view without implying a send', () => {
    expect(ASSIGNMENTS_ACTION_LABEL).toBe('MIDI Channel Assignments');
    expect(ASSIGNMENTS_ACTION_LABEL).not.toContain('Assign to');
  });

  it('formats channel rows and the sent confirmation', () => {
    expect(channelRowLabel(5)).toBe('Ch. 5');
    expect(channelRowLabel(16 as MidiChannel)).toBe('Ch. 16');
    expect(assignmentSentMessage('Concert Piano', 5)).toBe(
      'Concert Piano sent to channel 5',
    );
  });
});
