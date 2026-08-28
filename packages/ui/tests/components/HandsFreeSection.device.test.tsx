import { act } from 'react';
import { render, click } from '../utils/render';
import { initTestStores } from '../utils/stores';
import {
  mountControlSurface,
  type ControlHarness,
} from '../fixtures/controlSurface';
import { HandsFreeSection } from '../../src/components/settings/HandsFreeSection';
import {
  useControlBindingsStore,
  useControlSurfaceStore,
} from '../../src/store';

let harness: ControlHarness;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  harness = mountControlSurface();
});

afterEach(async () => {
  await harness.teardown();
});

function renderSection() {
  return render(<HandsFreeSection isLightMode={false} />);
}

describe('the footswitch device row', () => {
  it('says no footswitch is set up when none is', () => {
    const { container, unmount } = renderSection();
    expect(container.querySelector('[data-hf-device]')!.textContent).toContain(
      'No footswitch',
    );
    unmount();
  });

  it('lists the available inputs when asked to choose', async () => {
    const { container, unmount } = renderSection();

    await act(async () => {
      click(container.querySelector('[data-hf-choose]')!);
    });

    const options = [...container.querySelectorAll('[data-hf-device-option]')];
    expect(options.map(o => o.textContent)).toEqual(['FootCtrlPlus Bluetooth']);
    unmount();
  });

  it('attaches the chosen input and remembers it', async () => {
    const { container, unmount } = renderSection();

    await act(async () => {
      click(container.querySelector('[data-hf-choose]')!);
    });
    await act(async () => {
      click(container.querySelector('[data-hf-device-option]')!);
    });

    expect(useControlBindingsStore.getState().device).toEqual({
      id: 'in-pedal',
      name: 'FootCtrlPlus Bluetooth',
    });
    expect(container.querySelector('[data-hf-device]')!.textContent).toContain(
      'FootCtrlPlus Bluetooth',
    );
    expect(
      container.querySelector('[data-hf-device-status]')!.textContent,
    ).toContain('Connected');
    unmount();
  });

  it('says it is waiting when the pedal is remembered but asleep', async () => {
    const { container, unmount } = renderSection();
    await act(async () => {
      useControlBindingsStore
        .getState()
        .setDevice({ id: 'in-pedal', name: 'FootCtrlPlus Bluetooth' });
      useControlSurfaceStore
        .getState()
        .setAttached(false, 'FootCtrlPlus Bluetooth');
    });

    expect(
      container.querySelector('[data-hf-device-status]')!.textContent,
    ).toContain('Waiting');
    unmount();
  });

  it('forgets the device on request', async () => {
    const { container, unmount } = renderSection();
    await act(async () => {
      click(container.querySelector('[data-hf-choose]')!);
    });
    await act(async () => {
      click(container.querySelector('[data-hf-device-option]')!);
    });

    await act(async () => {
      click(container.querySelector('[data-hf-forget]')!);
    });

    expect(useControlBindingsStore.getState().device).toBeNull();
    expect(container.querySelector('[data-hf-device]')!.textContent).toContain(
      'No footswitch',
    );
    unmount();
  });

  it('tells the user when the browser offered no inputs at all', async () => {
    harness.transport.devices = [];
    const { container, unmount } = renderSection();

    await act(async () => {
      click(container.querySelector('[data-hf-choose]')!);
    });

    expect(container.textContent).toContain('No MIDI inputs found');
    unmount();
  });
});

describe('the last-message monitor', () => {
  it('shows nothing until a message arrives', () => {
    const { container, unmount } = renderSection();
    expect(container.querySelector('[data-hf-monitor]')!.textContent).toContain(
      'No messages yet',
    );
    unmount();
  });

  it('shows the most recent message with its value', async () => {
    const { container, unmount } = renderSection();

    await harness.press();

    expect(container.querySelector('[data-hf-monitor]')!.textContent).toContain(
      'CC 20 ch1 val 127',
    );
    unmount();
  });

  it('updates as further messages arrive', async () => {
    const { container, unmount } = renderSection();

    await harness.press();
    await harness.release();

    expect(container.querySelector('[data-hf-monitor]')!.textContent).toContain(
      'CC 20 ch1 val 0',
    );
    unmount();
  });
});

describe('the clock behind the monitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function noteNow(): void {
    useControlSurfaceStore
      .getState()
      .noteMessage({ type: 'cc', channel: 1, id: 20, value: 127 }, Date.now());
  }

  it('starts no polling while there is nothing to age', () => {
    const spy = jest.spyOn(globalThis, 'setInterval');
    const { unmount } = renderSection();

    expect(spy).not.toHaveBeenCalled();
    unmount();
  });

  it('polls no faster than the label can change', async () => {
    const spy = jest.spyOn(globalThis, 'setInterval');
    const { unmount } = renderSection();

    await act(async () => {
      noteNow();
    });

    expect(spy).toHaveBeenCalled();
    for (const [, delay] of spy.mock.calls) {
      expect(delay).toBeGreaterThanOrEqual(30_000);
    }
    unmount();
  });

  it('ages the line once a message has arrived', async () => {
    const { container, unmount } = renderSection();
    await act(async () => {
      noteNow();
    });

    expect(container.querySelector('[data-hf-monitor]')!.textContent).toContain(
      'a few seconds ago',
    );

    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });

    expect(container.querySelector('[data-hf-monitor]')!.textContent).toContain(
      '1m ago',
    );
    unmount();
  });

  it('stops polling when the section goes away', async () => {
    const spy = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderSection();
    await act(async () => {
      noteNow();
    });

    unmount();

    expect(spy).toHaveBeenCalled();
  });
});
