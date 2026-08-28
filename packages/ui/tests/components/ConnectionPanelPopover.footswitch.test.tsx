import {act} from 'react';
import {render, click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {ConnectionPanelPopover} from '../../src/components/ConnectionPanelPopover';
import {useConnectionStore, useControlSurfaceStore} from '../../src/store';

const PEDAL = 'FootCtrlPlus Bluetooth';
const PIANO = 'Roland Digital Piano';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  useConnectionStore.getState().clearDiscoveredDevices();
  useControlSurfaceStore.getState().setAttached(false, null);
  useConnectionStore.getState().addDiscoveredDevice({id: 'out-piano', name: PIANO});
  useConnectionStore.getState().addDiscoveredDevice({id: 'out-pedal', name: PEDAL});
});

function openPanel() {
  const rendered = render(
    <ConnectionPanelPopover isLightMode={false}>
      <button data-open>Connect</button>
    </ConnectionPanelPopover>,
  );
  click(rendered.container.querySelector('[data-open]')!);
  return rendered;
}

describe('the piano chooser', () => {
  it('lists every discovered output while no footswitch is claimed', () => {
    const {unmount} = openPanel();

    expect(document.body.textContent).toContain(PIANO);
    expect(document.body.textContent).toContain(PEDAL);
    unmount();
  });

  it('hides the output that shares its name with the claimed footswitch', async () => {
    await act(async () => {
      useControlSurfaceStore.getState().setAttached(true, PEDAL);
    });
    const {unmount} = openPanel();

    expect(document.body.textContent).toContain(PIANO);
    expect(document.body.textContent).not.toContain(PEDAL);
    unmount();
  });

  it('keeps hiding it while the pedal is remembered but asleep', async () => {
    await act(async () => {
      useControlSurfaceStore.getState().setAttached(false, PEDAL);
    });
    const {unmount} = openPanel();

    expect(document.body.textContent).not.toContain(PEDAL);
    unmount();
  });
});
