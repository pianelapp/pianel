import { act } from 'react';
import { render, click } from '../utils/render';
import { initTestStores } from '../utils/stores';
import { wire, resetSetlistWorld } from '../fixtures/setlists';
import {
  mountControlSurface,
  stubPianoWithMetronome,
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
  resetSetlistWorld();
  wire();
  stubPianoWithMetronome();
  harness = mountControlSurface();
});

afterEach(async () => {
  await harness.teardown();
});

function renderSection() {
  return render(<HandsFreeSection isLightMode={false} />);
}

function addBindingFor(container: HTMLElement, actionId: string): void {
  const row = [...container.querySelectorAll('[data-hf-action]')].find(
    el => el.getAttribute('data-hf-action') === actionId,
  )!;
  click(row.querySelector('[data-hf-add]')!);
}

describe('the learn dialog', () => {
  it('stays hidden until learn is armed', () => {
    const { container, unmount } = renderSection();
    expect(container.querySelector('[data-hf-learn]')).toBeNull();
    unmount();
  });

  it('asks for the switch by the action name', () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    const dialog = container.querySelector('[data-hf-learn]')!;
    expect(dialog.textContent).toContain(
      'Press the switch you want for Next scene',
    );
    unmount();
  });

  it('shows what it captured and offers all three behaviours for a momentary switch', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();

    const dialog = container.querySelector('[data-hf-learn]')!;
    expect(dialog.textContent).toContain('CC 20 CH 1');
    const choices = [...dialog.querySelectorAll('[data-hf-behaviour]')].map(b =>
      b.getAttribute('data-hf-behaviour'),
    );
    expect(choices).toEqual(['press', 'release', 'peek']);
    unmount();
  });

  it('offers press only, with an explanation, when the switch sends no release', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await act(async () => {
      harness.transport.emit([0xc0, 0x05]);
      await harness.service.whenIdle();
    });

    const dialog = container.querySelector('[data-hf-learn]')!;
    const choices = [...dialog.querySelectorAll('[data-hf-behaviour]')].map(b =>
      b.getAttribute('data-hf-behaviour'),
    );
    expect(choices).toEqual(['press']);
    expect(dialog.textContent).toContain('carries no release');
    unmount();
  });

  it('says only that the switch reported no release, naming no hardware', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setLearnDetecting(
          { type: 'cc', channel: 1, id: 20, value: 127 },
          5_000,
        );
      useControlSurfaceStore.getState().setLearnConfirming(['press']);
    });

    const note = container.querySelector('[data-hf-press-only]')!;
    expect(note.textContent).toBe(
      'This switch did not report a release, so only press is available.',
    );
    expect(note.textContent).not.toContain('carries no release');
    unmount();
  });

  it('does not blame the switch when the action is what only takes press', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.exit');

    await harness.press();
    await harness.release();

    const dialog = container.querySelector('[data-hf-learn]')!;
    const choices = [...dialog.querySelectorAll('[data-hf-behaviour]')].map(b =>
      b.getAttribute('data-hf-behaviour'),
    );
    expect(choices).toEqual(['press']);
    expect(dialog.querySelector('[data-hf-press-only]')).toBeNull();
    unmount();
  });

  it('counts the release window down while it waits', async () => {
    jest.useFakeTimers();
    try {
      const { container, unmount } = renderSection();
      addBindingFor(container, 'perform.nextScene');

      await harness.press();

      const countdown = () =>
        container.querySelector('[data-hf-countdown]')?.textContent ?? '';
      expect(countdown()).toContain('5s');

      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      expect(countdown()).toContain('3s');

      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops the countdown the moment a release lands', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    expect(container.querySelector('[data-hf-countdown]')).not.toBeNull();

    await harness.release();
    expect(container.querySelector('[data-hf-countdown]')).toBeNull();
    unmount();
  });

  it('saves the binding the user picked and closes', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();
    await act(async () => {
      click(
        container.querySelector('[data-hf-learn] [data-hf-behaviour="peek"]')!,
      );
    });

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      actionId: 'perform.nextScene',
      behaviour: 'peek',
      match: { type: 'cc', channel: 1, id: 20 },
    });
    expect(container.querySelector('[data-hf-learn]')).toBeNull();
    unmount();
  });

  it('closes without saving on cancel', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();
    await act(async () => {
      click(container.querySelector('[data-hf-learn] [data-hf-cancel]')!);
    });

    expect(useControlBindingsStore.getState().bindings).toEqual([]);
    expect(container.querySelector('[data-hf-learn]')).toBeNull();
    unmount();
  });

  it('offers a retry when nothing arrived in time', async () => {
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await act(async () => {
      useControlSurfaceStore.getState().setLearnTimeout();
    });

    const dialog = container.querySelector('[data-hf-learn]')!;
    expect(dialog.textContent).toContain('No message received');

    await act(async () => {
      click(dialog.querySelector('[data-hf-retry]')!);
    });
    expect(useControlSurfaceStore.getState().learn.phase).toBe('armed');
    unmount();
  });
});

describe('a switch that is already bound', () => {
  it('names the action it is bound to instead of stealing it', async () => {
    harness.bind('perform.prevScene', 'release', 20);
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();

    const dialog = container.querySelector('[data-hf-learn]')!;
    expect(dialog.textContent).toContain('already bound to Previous scene');
    expect(useControlBindingsStore.getState().bindings).toHaveLength(1);
    expect(useControlBindingsStore.getState().bindings[0].actionId).toBe(
      'perform.prevScene',
    );
    unmount();
  });

  it('reassigns after the user confirms and picks a behaviour', async () => {
    harness.bind('perform.prevScene', 'release', 20);
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();
    await act(async () => {
      click(container.querySelector('[data-hf-learn] [data-hf-reassign]')!);
    });
    await act(async () => {
      click(
        container.querySelector(
          '[data-hf-learn] [data-hf-behaviour="release"]',
        )!,
      );
    });

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.nextScene');
    unmount();
  });

  it('leaves the original alone when the user backs out', async () => {
    harness.bind('perform.prevScene', 'release', 20);
    const { container, unmount } = renderSection();
    addBindingFor(container, 'perform.nextScene');

    await harness.press();
    await harness.release();
    await act(async () => {
      click(container.querySelector('[data-hf-learn] [data-hf-cancel]')!);
    });

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.prevScene');
    unmount();
  });
});
