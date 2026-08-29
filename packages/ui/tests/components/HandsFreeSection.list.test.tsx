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

function rowFor(container: HTMLElement, label: string): HTMLElement {
  const row = [...container.querySelectorAll('[data-hf-action]')].find(
    el => el.getAttribute('data-hf-action') === label,
  );
  if (!row) throw new Error(`no action row for ${label}`);
  return row as HTMLElement;
}

describe('the action list', () => {
  it('lists every registered action, grouped, in catalog order', () => {
    const { container, unmount } = renderSection();

    const groups = [...container.querySelectorAll('[data-hf-group]')].map(g =>
      g.getAttribute('data-hf-group'),
    );
    expect(groups).toEqual(['Perform', 'Piano']);

    const rows = [...container.querySelectorAll('[data-hf-action]')].map(r =>
      r.getAttribute('data-hf-action'),
    );
    expect(rows).toEqual([
      'perform.nextScene',
      'perform.prevScene',
      'perform.nextSong',
      'perform.prevSong',
      'perform.exit',
      'piano.toggleMetronome',
    ]);
    unmount();
  });

  it('lists an action with no bindings as unassigned', () => {
    const { container, unmount } = renderSection();
    expect(rowFor(container, 'perform.exit').textContent).toContain(
      'Unassigned',
    );
    unmount();
  });

  it('shows every binding an action holds, with its behaviour', () => {
    harness.bind('perform.nextScene', 'release', 20);
    harness.bind('perform.nextScene', 'peek', 22);

    const { container, unmount } = renderSection();
    const row = rowFor(container, 'perform.nextScene');
    const labels = [...row.querySelectorAll('[data-hf-binding]')].map(
      b => b.textContent,
    );

    expect(labels[0]).toContain('CC 20 CH 1 · On Release');
    expect(labels[1]).toContain('CC 22 CH 1 · Peek');
    unmount();
  });

  it('shows the human label, not the action id', () => {
    const { container, unmount } = renderSection();
    expect(rowFor(container, 'perform.nextScene').textContent).toContain(
      'Next scene',
    );
    expect(rowFor(container, 'piano.toggleMetronome').textContent).toContain(
      'Toggle metronome',
    );
    unmount();
  });

  it('removes one binding without touching its neighbour', () => {
    harness.bind('perform.nextScene', 'release', 20);
    harness.bind('perform.nextScene', 'peek', 22);

    const { container, unmount } = renderSection();
    const row = rowFor(container, 'perform.nextScene');
    click(row.querySelectorAll('[data-hf-remove]')[0]);

    const remaining = useControlBindingsStore.getState().bindings;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].behaviour).toBe('peek');
    unmount();
  });

  it('arms learn mode for the action whose add button was tapped', () => {
    const { container, unmount } = renderSection();
    click(
      rowFor(container, 'perform.prevScene').querySelector('[data-hf-add]')!,
    );

    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('armed');
    expect(learn.actionId).toBe('perform.prevScene');
    unmount();
  });

  it('gives every interactive control the 44px tap floor', () => {
    harness.bind('perform.nextScene', 'release', 20);
    const { container, unmount } = renderSection();

    for (const el of container.querySelectorAll(
      '[data-hf-add], [data-hf-remove]',
    )) {
      expect(el.className).toContain('tap-target');
    }
    unmount();
  });
});

describe('bindings for actions nobody registered', () => {
  it('lists an orphan rather than dropping it silently', () => {
    useControlBindingsStore.getState().addBinding({
      match: { type: 'cc', channel: 1, id: 30 },
      actionId: 'perform.someRenamedThing',
      behaviour: 'press',
    });

    const { container, unmount } = renderSection();
    const orphan = container.querySelector('[data-hf-orphan]');

    expect(orphan).not.toBeNull();
    expect(orphan!.textContent).toContain('unrecognised');
    expect(orphan!.textContent).toContain('perform.someRenamedThing');
    expect(orphan!.textContent).toContain('CC 30 CH 1');
    unmount();
  });

  it('lets an orphan be removed', () => {
    useControlBindingsStore.getState().addBinding({
      match: { type: 'cc', channel: 1, id: 30 },
      actionId: 'perform.someRenamedThing',
      behaviour: 'press',
    });

    const { container, unmount } = renderSection();
    click(container.querySelector('[data-hf-orphan] [data-hf-remove]')!);

    expect(useControlBindingsStore.getState().bindings).toEqual([]);
    unmount();
  });

  it('shows no orphan section when every binding resolves', () => {
    harness.bind('perform.nextScene', 'release', 20);
    const { container, unmount } = renderSection();
    expect(container.querySelector('[data-hf-orphan]')).toBeNull();
    unmount();
  });
});
