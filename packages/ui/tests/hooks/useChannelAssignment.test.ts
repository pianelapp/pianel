import {act} from 'react';
import {renderHook} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {
  useConnectionStore,
  useMidiChannelStore,
  type MidiChannel,
} from '../../src/store';
import {setPianoService} from '../../src/hooks/usePiano';
import {useChannelAssignment} from '../../src/hooks/useChannelAssignment';
import {PianoService} from '@pianel/core/services/PianoService';
import {FP30XEngine} from '@pianel/core/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '@pianel/core/engine/fp30x/tones';
import type {Transport} from '@pianel/core/transport/types';

jest.mock('../../src/components/Toast', () => ({
  showToast: jest.fn(),
  TOAST_DURATION_MS: 5000,
  Toast: () => null,
}));
jest.mock('../../src/components/modals/AlertModal', () => ({
  showAlert: jest.fn().mockResolvedValue(true),
  AlertModal: () => null,
}));

import {showToast} from '../../src/components/Toast';
import {showAlert} from '../../src/components/modals/AlertModal';

beforeAll(() => {
  initTestStores();
});

const DEVICE = 'piano-a';
const MARK = '2026-09-04T00:00:00.000Z';

const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
const standardSet = fp30xToneCatalog.categories.find(c => c.id === 0x07)!
  .tones[0];

function makeService(
  send: jest.Mock = jest.fn().mockResolvedValue(undefined),
): PianoService {
  const transport = {
    status: 'connected',
    send,
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  } as unknown as Transport;
  const service = new PianoService(transport);
  service.setEngine(new FP30XEngine());
  return service;
}

function connect(deviceId = DEVICE, mark = MARK): void {
  act(() => {
    useConnectionStore.setState({
      status: 'connected',
      deviceId,
      lastConnectedAt: mark,
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  act(() => useMidiChannelStore.getState().reset());
  setPianoService(makeService());
  connect();
});

describe('useChannelAssignment — rows', () => {
  it('produces sixteen rows in ascending order for a tone', () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    expect(hook.current.rows.map(r => r.channel)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    hook.unmount();
  });

  it('yields no rows and a no-op commit for a null tone', async () => {
    const hook = renderHook(() => useChannelAssignment(null));
    expect(hook.current.rows).toEqual([]);
    await act(async () => {
      await hook.current.assign(5);
    });
    expect(showToast).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('marks every channel as never assigned on a fresh session', () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    expect(hook.current.rows.every(r => r.assignedToneName === null)).toBe(true);
    expect(hook.current.anyStale).toBe(false);
    hook.unmount();
  });

  it('resolves recorded tone names through the catalog', async () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    await act(async () => {
      await hook.current.assign(5);
    });
    hook.rerender();
    const row = hook.current.rows.find(r => r.channel === 5)!;
    expect(row.assignedToneName).toBe(concertPiano.name);
    hook.unmount();
  });

  it('carries the engine eligibility and reason onto the rows', () => {
    const melodic = renderHook(() => useChannelAssignment(concertPiano));
    const ch4 = melodic.current.rows.find(r => r.channel === 4)!;
    const ch10 = melodic.current.rows.find(r => r.channel === 10)!;
    expect(ch4).toMatchObject({eligible: false, reason: 'keyboard-channel'});
    expect(ch10).toMatchObject({eligible: false, reason: 'requires-drum-kit'});
    melodic.unmount();

    const kit = renderHook(() => useChannelAssignment(standardSet));
    expect(kit.current.rows.find(r => r.channel === 10)).toMatchObject({
      eligible: true,
      reason: null,
    });
    kit.unmount();
  });

  it('empties the record set immediately when a different piano connects', async () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    await act(async () => {
      await hook.current.assign(5);
    });
    hook.rerender();
    expect(hook.current.rows[4].assignedToneName).toBe(concertPiano.name);

    connect('piano-b');
    hook.rerender();

    expect(hook.current.rows.every(r => r.assignedToneName === null)).toBe(true);
    expect(hook.current.anyStale).toBe(false);
    hook.unmount();
  });

  it('flags records that predate a reconnect and not ones made after it', async () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    await act(async () => {
      await hook.current.assign(5);
    });

    connect(DEVICE, '2026-09-04T02:00:00.000Z');
    hook.rerender();
    expect(hook.current.anyStale).toBe(true);
    expect(hook.current.rows.find(r => r.channel === 5)!.mayBeStale).toBe(true);

    await act(async () => {
      await hook.current.assign(6);
    });
    hook.rerender();
    expect(hook.current.rows.find(r => r.channel === 5)!.mayBeStale).toBe(true);
    expect(hook.current.rows.find(r => r.channel === 6)!.mayBeStale).toBe(false);
    expect(hook.current.anyStale).toBe(true);
    hook.unmount();
  });
});

describe('useChannelAssignment — feedback routing', () => {
  it('confirms a successful assignment on the non-dismissing path', async () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));
    await act(async () => {
      await hook.current.assign(5);
    });
    expect(showToast).toHaveBeenCalledWith('Concert Piano sent to channel 5');
    expect(showAlert).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('routes a failed send to the blocking alert and records nothing', async () => {
    setPianoService(makeService(jest.fn().mockRejectedValue(new Error('gone'))));
    const hook = renderHook(() => useChannelAssignment(concertPiano));

    await act(async () => {
      await hook.current.assign(5);
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message:
          'Assignment did not complete. Channel 5 still has whatever it had before.',
      }),
    );
    expect(useMidiChannelStore.getState().assignments).toEqual({});
    hook.unmount();
  });

  it('routes a disconnected commit to the blocking alert', async () => {
    act(() => useConnectionStore.setState({status: 'disconnected'}));
    const hook = renderHook(() => useChannelAssignment(concertPiano));

    await act(async () => {
      await hook.current.assign(5);
    });

    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({variant: 'warning'}),
    );
    expect(showToast).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('routes an ineligible channel to the blocking alert', async () => {
    const hook = renderHook(() => useChannelAssignment(concertPiano));

    await act(async () => {
      await hook.current.assign(4 as MidiChannel);
    });

    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({variant: 'error'}),
    );
    expect(showToast).not.toHaveBeenCalled();
    expect(useMidiChannelStore.getState().assignments).toEqual({});
    hook.unmount();
  });
});
