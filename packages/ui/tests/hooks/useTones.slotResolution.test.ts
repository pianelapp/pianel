/**
 * BUG — Display tab shows the stale Split-Lower tone after a Single-mode
 * scene recall.
 *
 * `appSettingsStore.activeToneSlot` carries the invariant "Single/Twin always
 * force 'right'", but it is only enforced by `PianoService.changeVoiceMode`
 * and `applyQuickToneSlot`. A scene/preset recall goes through
 * `PresetService.applySnapshot`, and a hardware panel change arrives as an
 * inbound `voiceMode` notification — both write `performanceStore.voiceMode`
 * without collapsing the slot. The slot is persisted, so it also survives a
 * relaunch.
 *
 * With the slot left at 'left', `useTones()` resolves `activeTone` to
 * `leftTone` (the stale Split Lower tone) while the piano is sounding
 * `activeTone`, so the tone panel and the Library sidebar disagree with the
 * instrument.
 */
import {renderHook, actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {usePerformanceStore, useAppSettingsStore} from '../../src/store';
import {useTones} from '../../src/hooks/useTones';
import {useVoicingMode} from '../../src/hooks/useVoicingMode';
import {VOICING_MODE_TO_BYTE} from '@pianel/core/helpers/voicingMode';
import type {Tone} from '@pianel/core/types/types';

const UPPER: Tone = {
  id: 'tone-upper',
  name: 'Ballad Piano',
  category: 0,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 1,
  position: 1,
  isGM2: false,
};

const LOWER: Tone = {
  id: 'tone-lower',
  name: 'A.Bass+Cymbl',
  category: 7,
  categoryName: 'Other',
  indexHigh: 0,
  indexLow: 5,
  position: 5,
  isGM2: false,
};

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  actSync(() => {
    const perf = usePerformanceStore.getState();
    perf.setVoiceMode(VOICING_MODE_TO_BYTE.split);
    perf.setActiveTone(UPPER);
    perf.setLeftTone(LOWER);
    useAppSettingsStore.getState().setActiveToneSlot('left');
  });
});

describe('tone-slot resolution follows the voicing mode', () => {
  it('resolves to the right slot in Single mode even when the stored slot is left', () => {
    const hook = renderHook(() => useTones());

    actSync(() => {
      usePerformanceStore.getState().setVoiceMode(VOICING_MODE_TO_BYTE.single);
    });

    expect(hook.current.slot).toBe('right');
    expect(hook.current.activeTone).toEqual(UPPER);
    hook.unmount();
  });

  it('resolves to the right slot in Twin mode even when the stored slot is left', () => {
    const hook = renderHook(() => useTones());

    actSync(() => {
      usePerformanceStore.getState().setVoiceMode(VOICING_MODE_TO_BYTE.twin);
    });

    expect(hook.current.slot).toBe('right');
    expect(hook.current.activeTone).toEqual(UPPER);
    hook.unmount();
  });

  it('keeps honouring the stored left slot in Split mode', () => {
    const hook = renderHook(() => useTones());

    expect(hook.current.slot).toBe('left');
    expect(hook.current.activeTone).toEqual(LOWER);
    hook.unmount();
  });

  it('reports the right slot from useVoicingMode in Single mode', () => {
    const hook = renderHook(() => useVoicingMode());

    actSync(() => {
      usePerformanceStore.getState().setVoiceMode(VOICING_MODE_TO_BYTE.single);
    });

    expect(hook.current.activeSlot).toBe('right');
    hook.unmount();
  });
});
