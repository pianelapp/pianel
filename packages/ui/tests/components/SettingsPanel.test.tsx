import { act, useEffect } from 'react';
import { render, click, type RenderResult } from '../utils/render';
import { installViewport, type FakeViewport } from '../utils/matchMedia';
import { SettingsPanel } from '../../src/components/settings/SettingsPanel';

const WIDTH_CLASS = 'w-[680px]';

let viewport: FakeViewport | undefined;
let mounted: RenderResult | undefined;
let mounts = 0;

function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <p data-probe>Bindings live here</p>;
}

function renderPanel(onClose: () => void = () => {}): void {
  mounted = render(
    <SettingsPanel
      title="Hands-free"
      widthClass={WIDTH_CLASS}
      isLightMode={false}
      onClose={onClose}>
      <Probe />
    </SettingsPanel>,
  );
}

function panel(): HTMLElement {
  const found = document.body.querySelectorAll('[data-settings-panel]');
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function setWidth(px: number): void {
  act(() => viewport!.setWidth(px));
}

function pressEscape(): void {
  act(() => {
    panel().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  });
}

beforeEach(() => {
  mounts = 0;
});

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  viewport?.restore();
  viewport = undefined;
});

describe('SettingsPanel', () => {
  it('renders the title and its children', () => {
    viewport = installViewport(1280);
    renderPanel();

    expect(panel().textContent).toContain('Hands-free');
    expect(panel().querySelector('[data-probe]')!.textContent).toBe(
      'Bindings live here',
    );
  });

  it('closes when the close button is pressed', () => {
    viewport = installViewport(1280);
    const onClose = jest.fn();
    renderPanel(onClose);

    const close = panel().querySelector('[data-panel-close]')!;
    expect(close.getAttribute('aria-label')).toBe('Close');
    click(close);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    viewport = installViewport(1280);
    const onClose = jest.fn();
    renderPanel(onClose);

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('floats with the caller width above the mobile breakpoint', () => {
    viewport = installViewport(1280);
    renderPanel();

    const className = panel().className;
    expect(panel().getAttribute('data-panel-mode')).toBe('floating');
    expect(className).toContain(WIDTH_CLASS);
    expect(className).toContain('max-w-[calc(100vw-2rem)]');
    expect(className).toContain('max-h-[85vh]');
  });

  it('fills the viewport as a sheet below the mobile breakpoint', () => {
    viewport = installViewport(599);
    renderPanel();

    const className = panel().className;
    expect(panel().getAttribute('data-panel-mode')).toBe('sheet');
    expect(className).not.toContain(WIDTH_CLASS);
    expect(className).not.toContain('max-h-[85vh]');
    expect(className).not.toContain('max-w-[calc(100vw-2rem)]');
    expect(className).toContain('fixed inset-0');
  });

  it('flips between floating and sheet live without remounting its children', () => {
    viewport = installViewport(1280);
    renderPanel();

    expect(panel().getAttribute('data-panel-mode')).toBe('floating');
    expect(mounts).toBe(1);
    const probe = panel().querySelector('[data-probe]');

    setWidth(599);

    expect(panel().getAttribute('data-panel-mode')).toBe('sheet');
    expect(panel().className).not.toContain(WIDTH_CLASS);
    expect(panel().querySelector('[data-probe]')).toBe(probe);
    expect(mounts).toBe(1);

    setWidth(1280);

    expect(panel().getAttribute('data-panel-mode')).toBe('floating');
    expect(panel().className).toContain(WIDTH_CLASS);
    expect(panel().querySelector('[data-probe]')).toBe(probe);
    expect(mounts).toBe(1);
  });

  it('keeps the header pinned and the body scrollable in both modes', () => {
    viewport = installViewport(1280);
    renderPanel();

    const header = panel().firstElementChild!;
    const body = panel().lastElementChild!;
    expect(header.className).toContain('shrink-0');
    expect(header.className).toContain('border-b');
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('custom-scrollbar');

    setWidth(599);

    expect(panel().firstElementChild!.className).toContain('shrink-0');
    expect(panel().lastElementChild!.className).toContain('custom-scrollbar');
  });
});
