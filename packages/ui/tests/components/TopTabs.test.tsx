/**
 * responsive-breakpoints — TopTabs.
 *
 * The collapse decision is `tier.viewport === 'mobile'`:
 *  - desktop / tablet: the full three-tab row renders as visible buttons
 *  - mobile: only the active tab shows in the trigger; tapping it opens a
 *    dropdown listing exactly the other two tabs; selecting one calls onChange
 *    and closes; Escape closes without changing the active tab
 */
import * as React from 'react';
import {render, click} from '../utils/render';
import {actSync} from '../utils/renderHook';
import {TopTabs, type Tab} from '../../src/components/TopTabs';
import type {Breakpoint} from '../../src/constants/breakpoints';

const TABS = ['PRESETS', 'DISPLAY', 'PROFILES'] as const satisfies readonly Tab[];

function tier(viewport: Breakpoint['viewport']): Breakpoint {
  // sidebar is irrelevant to TopTabs (it only reads tier.viewport).
  return {viewport, sidebar: viewport};
}

function visibleTabButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function dropdownItems(): HTMLButtonElement[] {
  const wrapper = document.querySelector('[data-radix-popper-content-wrapper]');
  if (!wrapper) return [];
  return Array.from(wrapper.querySelectorAll('button'));
}

function textOf(buttons: HTMLButtonElement[]): string[] {
  return buttons.map(b => (b.textContent ?? '').trim());
}

function escapeOnDocument(): void {
  actSync(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
    );
  });
}

describe('TopTabs', () => {
  it('desktop: renders all three tabs as buttons in the visible row', () => {
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={() => {}}
        tier={tier('desktop')}
      />,
    );
    expect(textOf(visibleTabButtons(container))).toEqual([
      'PRESETS',
      'DISPLAY',
      'PROFILES',
    ]);
    unmount();
  });

  it('tablet: renders the full three-tab row (never collapses)', () => {
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={() => {}}
        tier={tier('tablet')}
      />,
    );
    expect(textOf(visibleTabButtons(container))).toEqual([
      'PRESETS',
      'DISPLAY',
      'PROFILES',
    ]);
    unmount();
  });

  it('mobile: shows only the active tab in the collapsed trigger', () => {
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={() => {}}
        tier={tier('mobile')}
      />,
    );
    const visible = visibleTabButtons(container);
    expect(visible).toHaveLength(1);
    expect(visible[0].textContent).toContain('DISPLAY');
    expect(dropdownItems()).toHaveLength(0);
    unmount();
  });

  it('mobile: tapping the trigger opens a dropdown with exactly the other two tabs', () => {
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={() => {}}
        tier={tier('mobile')}
      />,
    );
    click(visibleTabButtons(container)[0]);
    expect(textOf(dropdownItems()).sort()).toEqual(['PRESETS', 'PROFILES']);
    unmount();
  });

  it('mobile: selecting a dropdown tab calls onChange and closes', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={onChange}
        tier={tier('mobile')}
      />,
    );
    click(visibleTabButtons(container)[0]);
    const presets = dropdownItems().find(b => b.textContent?.trim() === 'PRESETS');
    click(presets as Element);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('PRESETS');
    expect(dropdownItems()).toHaveLength(0);
    unmount();
  });

  it('mobile: Escape closes the dropdown without changing the active tab', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <TopTabs
        isLightMode
        tabs={TABS}
        activeTab="DISPLAY"
        onChange={onChange}
        tier={tier('mobile')}
      />,
    );
    click(visibleTabButtons(container)[0]);
    expect(dropdownItems().length).toBeGreaterThan(0);
    escapeOnDocument();
    expect(dropdownItems()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });
});
