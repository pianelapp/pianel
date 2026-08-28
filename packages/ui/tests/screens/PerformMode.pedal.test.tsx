import { act } from 'react';
import { initTestStores } from '../utils/stores';
import { resetSetlistWorld, setPianoConnected } from '../fixtures/setlists';
import { renderPerforming, stubPianoWithTones } from '../fixtures/setlistsUi';
import {
  useControlBindingsStore,
  useControlSurfaceStore,
} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
  stubPianoWithTones([{ id: 'a', name: 'Concert Piano' }]);
  setPianoConnected(true);
  useControlBindingsStore.getState().clearAll();
  useControlSurfaceStore.getState().setAttached(false, null);
});

function rememberPedal(): void {
  useControlBindingsStore
    .getState()
    .setDevice({ id: 'in-pedal', name: 'FootCtrlPlus Bluetooth' });
}

describe('the pedal-lost line', () => {
  it('is absent when no footswitch was ever set up', async () => {
    const { container } = await renderPerforming(['A', 'B']);
    expect(container.querySelector('[data-pedal-banner]')).toBeNull();
  });

  it('is absent while the footswitch is attached', async () => {
    rememberPedal();
    useControlSurfaceStore
      .getState()
      .setAttached(true, 'FootCtrlPlus Bluetooth');

    const { container } = await renderPerforming(['A', 'B']);
    expect(container.querySelector('[data-pedal-banner]')).toBeNull();
  });

  it('appears when a set-up footswitch is not attached', async () => {
    rememberPedal();

    const { container } = await renderPerforming(['A', 'B']);
    const banner = container.querySelector('[data-pedal-banner]');

    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('FOOTSWITCH LOST');
  });

  it('announces itself rather than relying on the player noticing', async () => {
    rememberPedal();

    const { container } = await renderPerforming(['A', 'B']);
    const banner = container.querySelector('[data-pedal-banner]')!;

    expect(banner.getAttribute('role')).toBe('status');
  });

  it('appears and disappears live as the pedal drops and wakes', async () => {
    rememberPedal();
    useControlSurfaceStore
      .getState()
      .setAttached(true, 'FootCtrlPlus Bluetooth');

    const { container } = await renderPerforming(['A', 'B']);
    expect(container.querySelector('[data-pedal-banner]')).toBeNull();

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setAttached(false, 'FootCtrlPlus Bluetooth');
    });
    expect(container.querySelector('[data-pedal-banner]')).not.toBeNull();

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setAttached(true, 'FootCtrlPlus Bluetooth');
    });
    expect(container.querySelector('[data-pedal-banner]')).toBeNull();
  });

  it('sits below the piano banner rather than replacing it', async () => {
    rememberPedal();
    setPianoConnected(false);

    const { container } = await renderPerforming(['A', 'B']);
    const piano = container.querySelector('[data-connection-banner]');
    const pedal = container.querySelector('[data-pedal-banner]');

    expect(piano).not.toBeNull();
    expect(pedal).not.toBeNull();
    expect(
      piano!.compareDocumentPosition(pedal!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('uses white on an amber that clears 4.5:1', async () => {
    rememberPedal();

    const { container } = await renderPerforming(['A', 'B']);
    const banner = container.querySelector('[data-pedal-banner]')!;

    expect(banner.className).toContain('bg-amber-700');
    expect(banner.className).toContain('text-white');
    expect(banner.className).not.toContain('bg-amber-500');
    expect(banner.className).not.toContain('bg-amber-600');
  });
});
