/**
 * Characterization tests for the ToneSlotTabs render guard.
 *
 * The tab row exists only for modes that address a second tone slot. Pinned
 * here so routing that decision through the shared `hasLeftToneSlot` helper
 * is provably behaviour-preserving.
 */
import React from 'react';
import {render} from '../utils/render';
import {ToneSlotTabs} from '../../src/screens/display/ToneSlotTabs';

function renderTabs(mode: 'single' | 'twin' | 'split' | 'dual') {
  return render(
    <ToneSlotTabs
      mode={mode}
      activeSlot="right"
      onChangeSlot={() => {}}
      onOpenOptions={() => {}}
      isLightMode={false}
    />,
  );
}

describe('ToneSlotTabs', () => {
  it.each(['single', 'twin'] as const)('renders nothing in %s mode', mode => {
    const {container, unmount} = renderTabs(mode);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    unmount();
  });

  // Split puts LOWER first so the tabs mirror the keyboard: lower voice on
  // the left, upper on the right. Dual has no such spatial meaning.
  it('renders Lower/Upper plus the options button in split mode', () => {
    const {container, unmount} = renderTabs('split');
    const labels = Array.from(container.querySelectorAll('button')).map(b =>
      b.textContent,
    );
    expect(labels).toEqual(['LOWER', 'UPPER', '']);
    unmount();
  });

  it('renders Tone 1/Tone 2 plus the options button in dual mode', () => {
    const {container, unmount} = renderTabs('dual');
    const labels = Array.from(container.querySelectorAll('button')).map(b =>
      b.textContent,
    );
    expect(labels).toEqual(['TONE 1', 'TONE 2', '']);
    unmount();
  });
});
