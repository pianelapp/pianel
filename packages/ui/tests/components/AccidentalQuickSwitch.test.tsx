/**
 * 009-settings-preferences Task 6.1 — AccidentalQuickSwitch modal.
 *
 * Requirements 8.3-8.9:
 *  - indicates the current accidental selection
 *  - selecting Sharps/Flats calls the shared preferences hook's setAccidentals
 *  - dismissal via Escape, backdrop click, and the close button all close it
 */
import * as React from 'react';
import {render, click, keydown} from '../utils/render';
import {actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {getChordService} from '@pianel/core/services/ChordService';
import {AccidentalQuickSwitch} from '../../src/components/modals/AccidentalQuickSwitch';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetProfileService();
  actSync(() => useAppSettingsStore.getState().setAccidentalPreference('sharps'));
});

function getByLabel(container: HTMLElement, label: string): HTMLElement {
  const el = Array.from(container.querySelectorAll('button')).find(b =>
    (b.textContent ?? '').toLowerCase().includes(label),
  );
  if (!el) throw new Error(`No button matching "${label}"`);
  return el as HTMLElement;
}

describe('AccidentalQuickSwitch', () => {
  it('renders nothing when closed', () => {
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open={false} onClose={() => {}} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  it('indicates the current accidental selection', () => {
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={() => {}} />,
    );
    const sharps = getByLabel(container, 'sharps');
    expect(sharps.getAttribute('aria-pressed')).toBe('true');
    unmount();
  });

  it('selecting Flats calls setAccidentals (store + chord service)', () => {
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={() => {}} />,
    );
    click(getByLabel(container, 'flats'));
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
    expect(getChordService().getUseSharps()).toBe(false);
    unmount();
  });

  it('closes via the Escape key', () => {
    const onClose = jest.fn();
    const {unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={onClose} />,
    );
    keydown('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('closes via backdrop click', () => {
    const onClose = jest.fn();
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={onClose} />,
    );
    const backdrop = container.querySelector('[data-testid="quick-switch-backdrop"]');
    expect(backdrop).not.toBeNull();
    click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('closes via the close button', () => {
    const onClose = jest.fn();
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={onClose} />,
    );
    const closeBtn = container.querySelector('[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    click(closeBtn as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
