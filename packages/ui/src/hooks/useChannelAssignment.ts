import { useCallback, useMemo } from 'react';
import type { Tone } from '@pianel/core/types/types';
import {
  selectAssignmentsMayBeStale,
  selectChannelAssignments,
  useConnectionStore,
  useMidiChannelStore,
  type ChannelToneIneligibility,
  type MidiChannel,
} from '../store';
import { getPianoService } from './usePiano';
import { useTones } from './useTones';
import { showAlert } from '../components/modals/AlertModal';
import { showToast } from '../components/Toast';
import {
  CHANNEL_REFUSAL_ALERTS,
  assignmentSentMessage,
} from '../helpers/channelAssignmentLabels';
import type { ChannelToneTarget } from '../store';

export interface ChannelPickerRow {
  channel: MidiChannel;
  eligible: boolean;
  reason: ChannelToneIneligibility | null;
  assignedToneName: string | null;
  mayBeStale: boolean;
}

export interface UseChannelAssignment {
  rows: ChannelPickerRow[];
  anyStale: boolean;
  assign: (channel: MidiChannel) => Promise<void>;
}

const NO_TARGETS: ChannelToneTarget[] = [];
const NO_ROWS: ChannelPickerRow[] = [];

export function useChannelAssignment(tone: Tone | null): UseChannelAssignment {
  const deviceId = useConnectionStore(s => s.deviceId);
  const connectionMark = useConnectionStore(s => s.lastConnectedAt);
  const assignments = useMidiChannelStore(s => s.assignments);
  const recordDeviceId = useMidiChannelStore(s => s.deviceId);
  const { findToneById } = useTones();

  const records = useMemo(
    () =>
      selectChannelAssignments(
        { assignments, deviceId: recordDeviceId },
        deviceId,
      ),
    [assignments, recordDeviceId, deviceId],
  );

  const anyStale = useMemo(
    () =>
      selectAssignmentsMayBeStale(
        { assignments, deviceId: recordDeviceId },
        deviceId,
        connectionMark,
      ),
    [assignments, recordDeviceId, deviceId, connectionMark],
  );

  const targets = useMemo(
    () =>
      tone
        ? (getPianoService()?.getChannelToneTargets(tone) ?? NO_TARGETS)
        : NO_TARGETS,
    // `deviceId` is a dependency because the resolved engine changes with the
    // connected piano, and eligibility is the engine's answer.
    [tone, deviceId],
  );

  const rows = useMemo(() => {
    if (!tone) return NO_ROWS;
    return targets.map(target => {
      const record = records[target.channel];
      return {
        channel: target.channel,
        eligible: target.eligible,
        reason: target.reason,
        assignedToneName: record
          ? (findToneById(record.toneId)?.name ?? null)
          : null,
        mayBeStale: record ? record.connectionMark !== connectionMark : false,
      };
    });
  }, [tone, targets, records, connectionMark, findToneById]);

  const assign = useCallback(
    async (channel: MidiChannel) => {
      if (!tone) return;
      const service = getPianoService();
      const result = service
        ? await service.assignChannelTone(channel, tone)
        : ({ status: 'refused', channel, reason: 'not-connected' } as const);

      if (result.status === 'applied') {
        showToast(assignmentSentMessage(tone.name, channel));
        return;
      }
      const alert = CHANNEL_REFUSAL_ALERTS[result.reason];
      showAlert({
        variant: alert.variant,
        title: alert.title,
        message: alert.message(channel),
      });
    },
    [tone],
  );

  return { rows, anyStale, assign };
}
