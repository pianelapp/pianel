import {act} from 'react';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {mountControlSurface, stubPianoWithMetronome, type ControlHarness} from '../fixtures/controlSurface';
import {getControlActionRegistry} from '@pianel/core/services/control/registry';
import {useCursorStore} from '../../src/store';

let harness: ControlHarness;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

afterEach(async () => {
  await harness.teardown();
});

async function performing(sceneLabels: string[]): Promise<void> {
  const {songs, cursor} = wire();
  const songId = songs.createSong('Song').id;
  for (const label of sceneLabels) songs.captureScene(songId, label);
  harness = mountControlSurface();
  await act(async () => {
    await cursor.enterPerform({songId});
  });
}

describe('the registered catalog', () => {
  it('lists every action the app offers, grouped', async () => {
    wire();
    stubPianoWithMetronome();
    harness = mountControlSurface();

    const catalog = getControlActionRegistry().snapshot();
    expect(catalog.map(a => a.id)).toEqual([
      'perform.nextScene',
      'perform.prevScene',
      'perform.nextSong',
      'perform.prevSong',
      'perform.exit',
      'piano.toggleMetronome',
    ]);
    expect(catalog.map(a => a.group)).toEqual([
      'Perform',
      'Perform',
      'Perform',
      'Perform',
      'Perform',
      'Piano',
    ]);
  });

  it('offers peek only where a revert is meaningful', async () => {
    wire();
    stubPianoWithMetronome();
    harness = mountControlSurface();
    const byId = new Map(getControlActionRegistry().snapshot().map(a => [a.id, a]));

    expect(byId.get('perform.nextScene')!.behaviours).toEqual(['press', 'release', 'peek']);
    expect(byId.get('perform.prevScene')!.behaviours).toEqual(['press', 'release', 'peek']);
    expect(byId.get('perform.nextSong')!.behaviours).toEqual(['press', 'release']);
    expect(byId.get('perform.prevSong')!.behaviours).toEqual(['press', 'release']);
    expect(byId.get('perform.exit')!.behaviours).toEqual(['press']);
    expect(byId.get('piano.toggleMetronome')!.behaviours).toEqual(['press']);
  });

  it('registers exactly once however many times the components re-render', async () => {
    wire();
    stubPianoWithMetronome();
    harness = mountControlSurface();

    harness.rerender();
    harness.rerender();

    expect(getControlActionRegistry().snapshot()).toHaveLength(6);
  });
});

describe('a footswitch driving Perform', () => {
  it('advances a scene on release', async () => {
    await performing(['A', 'B', 'C']);
    harness.bind('perform.nextScene', 'release');

    await harness.press();
    expect(useCursorStore.getState().sceneIndex).toBe(0);

    await harness.release();
    expect(useCursorStore.getState().sceneIndex).toBe(1);
  });

  it('peeks forward while held and snaps back on release', async () => {
    await performing(['A', 'B', 'C']);
    harness.bind('perform.nextScene', 'peek');

    await harness.press();
    expect(useCursorStore.getState().sceneIndex).toBe(1);
    expect(useCursorStore.getState().anchor).toEqual({entryIndex: 0, sceneIndex: 0});

    await harness.release();
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    expect(useCursorStore.getState().anchor).toBeNull();
  });

  it('runs release-fire and peek from two different switches at once', async () => {
    await performing(['A', 'B', 'C']);
    harness.bind('perform.nextScene', 'release', 20);
    harness.bind('perform.nextScene', 'peek', 22);

    await harness.press(22);
    expect(useCursorStore.getState().sceneIndex).toBe(1);
    await harness.release(22);
    expect(useCursorStore.getState().sceneIndex).toBe(0);

    harness.tick(500);
    await harness.press(20);
    await harness.release(20);
    expect(useCursorStore.getState().sceneIndex).toBe(1);
  });

  it('exits perform from a bound switch', async () => {
    await performing(['A', 'B']);
    harness.bind('perform.exit', 'press');

    await harness.press();

    expect(useCursorStore.getState().isPerforming).toBe(false);
  });
});

describe('an action that works outside Perform', () => {
  it('toggles the metronome with nothing being performed', async () => {
    wire();
    const {toggleMetronome} = stubPianoWithMetronome();
    harness = mountControlSurface();
    harness.bind('piano.toggleMetronome', 'press');

    await harness.press();

    expect(toggleMetronome).toHaveBeenCalledTimes(1);
    expect(useCursorStore.getState().isPerforming).toBe(false);
  });

  it('does nothing and surfaces nothing when a perform action fires outside Perform', async () => {
    wire();
    stubPianoWithMetronome();
    harness = mountControlSurface();
    harness.bind('perform.nextScene', 'release');

    await harness.press();
    await harness.release();

    expect(useCursorStore.getState().isPerforming).toBe(false);
  });
});
