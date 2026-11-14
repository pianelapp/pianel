import * as React from 'react';
import { render, click } from '../utils/render';
import { actSync } from '../utils/renderHook';
import { initTestStores } from '../utils/stores';
import { useAppSettingsStore } from '../../src/store';
import { resetProfileService } from '../../src/hooks/useProfiles';
import { AppearanceSettings } from '../../src/components/settings/AppearanceSettings';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetProfileService();
  actSync(() => {
    useAppSettingsStore.getState().setThemePreference('light');
    useAppSettingsStore.getState().setAccidentalPreference('sharps');
    useAppSettingsStore.getState().setMasterVolumeSide('right');
  });
});

function query(container: HTMLElement, selector: string): HTMLElement {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`No element matching "${selector}"`);
  return el as HTMLElement;
}

describe('AppearanceSettings', () => {
  it('renders both cards inside a single appearance wrapper', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    const wrapper = query(container, '[data-appearance]');
    expect(wrapper.className).toContain('space-y-3');
    expect(wrapper.textContent).toContain('UI Theme');
    expect(wrapper.textContent).toContain('Accidentals');
    unmount();
  });

  it('flips the stored theme preference from light to dark and back', () => {
    const { container, rerender, unmount } = render(
      <AppearanceSettings isLightMode />,
    );
    click(query(container, '[data-theme-toggle]'));
    expect(useAppSettingsStore.getState().themePreference).toBe('dark');

    rerender(<AppearanceSettings isLightMode={false} />);
    click(query(container, '[data-theme-toggle]'));
    expect(useAppSettingsStore.getState().themePreference).toBe('light');
    unmount();
  });

  it('sets the preference to system when the System checkbox is tapped', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    const system = query(container, '[data-theme-system]');
    expect(system.getAttribute('aria-checked')).toBe('false');

    click(system);
    expect(useAppSettingsStore.getState().themePreference).toBe('system');
    expect(
      query(container, '[data-theme-system]').getAttribute('aria-checked'),
    ).toBe('true');
    unmount();
  });

  it('returns to an explicit light preference when System is tapped again', () => {
    actSync(() => useAppSettingsStore.getState().setThemePreference('system'));
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    click(query(container, '[data-theme-system]'));
    expect(useAppSettingsStore.getState().themePreference).toBe('light');
    unmount();
  });

  it('returns to an explicit dark preference when System is tapped again in dark', () => {
    actSync(() => useAppSettingsStore.getState().setThemePreference('system'));
    const { container, unmount } = render(
      <AppearanceSettings isLightMode={false} />,
    );
    click(query(container, '[data-theme-system]'));
    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    unmount();
  });

  it('disables the day/night toggle while the preference is system', () => {
    actSync(() => useAppSettingsStore.getState().setThemePreference('system'));
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    const toggle = query(container, '[data-theme-toggle]');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);

    click(toggle);
    expect(useAppSettingsStore.getState().themePreference).toBe('system');
    unmount();
  });

  it('stores the accidental preference chosen from the segmented control', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    click(query(container, '[data-accidental="flats"]'));
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');

    click(query(container, '[data-accidental="sharps"]'));
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('sharps');
    unmount();
  });

  it('marks only the selected accidental button as pressed', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    expect(
      query(container, '[data-accidental="sharps"]').getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    expect(
      query(container, '[data-accidental="flats"]').getAttribute(
        'aria-pressed',
      ),
    ).toBe('false');

    click(query(container, '[data-accidental="flats"]'));
    expect(
      query(container, '[data-accidental="sharps"]').getAttribute(
        'aria-pressed',
      ),
    ).toBe('false');
    expect(
      query(container, '[data-accidental="flats"]').getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    unmount();
  });

  it('offers a Left / Right choice for the volume panel, Right by default', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    const wrapper = query(container, '[data-appearance]');
    expect(wrapper.textContent).toContain('Volume Panel');
    const group = query(container, '[role="group"][aria-label="Volume panel side"]');
    const options = Array.from(group.querySelectorAll('button'));
    expect(options.map(b => b.getAttribute('data-volume-side'))).toEqual([
      'left',
      'right',
    ]);
    expect(options.map(b => b.textContent)).toEqual(['Left', 'Right']);
    expect(
      query(container, '[data-volume-side="right"]').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      query(container, '[data-volume-side="left"]').getAttribute('aria-pressed'),
    ).toBe('false');
    unmount();
  });

  it('stores the volume panel side chosen from its segmented control', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    click(query(container, '[data-volume-side="left"]'));
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('left');
    expect(
      query(container, '[data-volume-side="left"]').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      query(container, '[data-volume-side="right"]').getAttribute('aria-pressed'),
    ).toBe('false');

    click(query(container, '[data-volume-side="right"]'));
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('right');
    unmount();
  });

  it('keeps the accessibility contract of the original markup', () => {
    const { container, unmount } = render(<AppearanceSettings isLightMode />);
    expect(
      query(container, '[data-theme-toggle]').getAttribute('aria-label'),
    ).toBe('Toggle light or dark theme');
    expect(
      query(container, '[data-theme-toggle]').getAttribute('aria-pressed'),
    ).toBe('false');
    expect(query(container, '[data-theme-system]').getAttribute('role')).toBe(
      'checkbox',
    );
    const group = query(container, '[role="group"]');
    expect(group.getAttribute('aria-label')).toBe('Accidental spelling');
    unmount();
  });
});
