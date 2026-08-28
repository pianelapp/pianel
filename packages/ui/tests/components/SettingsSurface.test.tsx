import { render, click, type RenderResult } from '../utils/render';
import { initTestStores } from '../utils/stores';
import {
  SettingsSurface,
  type SettingsView,
} from '../../src/components/settings/SettingsSurface';
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from '../../src/components/settings/categories';

beforeAll(() => {
  initTestStores();
});

const onSelect = jest.fn();
const onClose = jest.fn();
let mounted: RenderResult | null = null;

beforeEach(() => {
  onSelect.mockClear();
  onClose.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function renderSurface(view: SettingsView): void {
  mounted = render(
    <SettingsSurface
      view={view}
      isLightMode={false}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
}

function only(selector: string): Element {
  const found = document.body.querySelectorAll(selector);
  expect(found).toHaveLength(1);
  return found[0];
}

function absent(selector: string): void {
  expect(document.body.querySelectorAll(selector)).toHaveLength(0);
}

describe('the settings surface', () => {
  it('shows nothing at all when closed', () => {
    renderSurface(null);

    absent('[data-settings-menu]');
    absent('[data-settings-panel]');
  });

  it('shows the menu, and only the menu, for the menu view', () => {
    renderSurface({ kind: 'menu' });

    only('[data-settings-menu]');
    absent('[data-settings-panel]');
  });

  it('reports which category the user picked', () => {
    renderSurface({ kind: 'menu' });

    click(only('[data-settings-category="handsfree"]'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('handsfree');
  });

  it('swaps the menu for a panel once a category is chosen', () => {
    renderSurface({ kind: 'category', id: 'handsfree' });

    absent('[data-settings-menu]');
    only('[data-settings-panel]');
  });
});

describe('each category panel', () => {
  it.each(SETTINGS_CATEGORIES.map(c => [c.id, c.label, c.widthClass] as const))(
    'titles %s "%s" and sizes it %s',
    (id, label, widthClass) => {
      renderSurface({ kind: 'category', id });
      const panel = only('[data-settings-panel]');

      expect(panel.textContent).toContain(label);
      expect(panel.className).toContain(widthClass);
    },
  );

  it('puts the appearance controls behind the appearance entry', () => {
    renderSurface({ kind: 'category', id: 'appearance' });

    only('[data-appearance]');
    absent('[data-hf-device]');
  });

  it('puts the footswitch controls behind the hands-free entry', () => {
    renderSurface({ kind: 'category', id: 'handsfree' });

    only('[data-hf-device]');
    absent('[data-appearance]');
  });

  it('closes from the panel exactly once per press', () => {
    renderSurface({ kind: 'category', id: 'appearance' });

    click(only('[data-panel-close]'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a category the registry does not know', () => {
    renderSurface({
      kind: 'category',
      id: 'nope' as SettingsCategoryId,
    });

    absent('[data-settings-panel]');
  });
});
