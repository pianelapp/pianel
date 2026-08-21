import * as React from 'react';
import {act} from 'react';
import {click, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import type {QuickToneSlot} from '@pianel/core/types/quickToneSlot';
import type {PianoService} from '@pianel/core/services/PianoService';
import {QuickToneSlots} from '../../src/screens/display/QuickToneSlots';
import {setPianoService} from '../../src/hooks/usePiano';

beforeAll(() => {
  initTestStores();
});

const FILLED: QuickToneSlot = {
  voiceMode: 'single',
  rightToneId: 'tone-1',
  leftToneId: null,
  dualTone2Id: null,
};

function stubPiano(applied: QuickToneSlot[]): PianoService {
  return {
    getToneCatalog: () => ({findById: () => undefined, categories: []}),
    applyQuickToneSlot: async (slot: QuickToneSlot) => {
      applied.push(slot);
    },
  } as unknown as PianoService;
}

beforeEach(() => {
  act(() => {
    useAppSettingsStore.getState().setQuickToneSlot(0, FILLED);
    useAppSettingsStore.getState().setQuickToneSlot(1, null);
    useAppSettingsStore.getState().setQuickToneSlot(2, null);
  });
});

describe('QuickToneSlots apply path', () => {
  it('sends a filled slot to the piano through the usePiano hook', async () => {
    const applied: QuickToneSlot[] = [];
    setPianoService(stubPiano(applied));

    const {container, unmount} = render(<QuickToneSlots isLightMode />);
    const slots = Array.from(container.querySelectorAll('button'));
    click(slots[0]);
    await act(async () => {});

    expect(applied).toHaveLength(1);
    expect(applied[0].rightToneId).toBe('tone-1');
    unmount();
  });

  it('does not call the piano for an empty slot', async () => {
    const applied: QuickToneSlot[] = [];
    setPianoService(stubPiano(applied));

    const {container, unmount} = render(<QuickToneSlots isLightMode />);
    const slots = Array.from(container.querySelectorAll('button'));
    click(slots[1]);
    await act(async () => {});

    expect(applied).toHaveLength(0);
    unmount();
  });
});
