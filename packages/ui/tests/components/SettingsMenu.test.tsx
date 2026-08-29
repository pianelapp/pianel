import { act } from 'react';
import { render, click, type RenderResult } from '../utils/render';
import { SettingsMenu } from '../../src/components/settings/SettingsMenu';
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from '../../src/components/settings/categories';

let mounted: RenderResult | null = null;

function renderMenu(
  handlers: {
    onSelect?: (id: SettingsCategoryId) => void;
    onClose?: () => void;
  } = {},
): void {
  mounted = render(
    <SettingsMenu
      isLightMode={false}
      onSelect={handlers.onSelect ?? (() => {})}
      onClose={handlers.onClose ?? (() => {})}
    />,
  );
}

function menu(): HTMLElement {
  const found = document.body.querySelectorAll('[data-settings-menu]');
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function rows(): HTMLElement[] {
  return Array.from(menu().querySelectorAll('[data-settings-category]'));
}

function pressEscape(): void {
  const target = menu();
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  });
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('SettingsMenu', () => {
  it('lists every registered category, in registry order', () => {
    renderMenu();
    expect(rows().map(r => r.getAttribute('data-settings-category'))).toEqual(
      SETTINGS_CATEGORIES.map(c => c.id),
    );
    expect(rows().map(r => (r.textContent ?? '').trim())).toEqual(
      SETTINGS_CATEGORIES.map(c => c.label),
    );
  });

  it.each(SETTINGS_CATEGORIES.map(c => c.id))(
    'reports %s when that row is clicked',
    id => {
      const onSelect = jest.fn();
      renderMenu({ onSelect });
      click(menu().querySelector(`[data-settings-category="${id}"]`)!);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(id);
    },
  );

  it('closes once, not twice, from the close button', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    click(menu().querySelector('[data-settings-menu-close]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives every category row a touch-sized hit area', () => {
    renderMenu();
    expect(rows()).toHaveLength(SETTINGS_CATEGORIES.length);
    for (const row of rows()) {
      expect(row.className.split(/\s+/)).toContain('tap-target');
    }
  });
});
