import {act} from 'react';
import {click, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {
  byText,
  openContextMenu,
  renderDetail,
  stubPianoWithTones,
  typeInto,
} from '../fixtures/setlistsUi';
import {SceneRow} from '../../src/screens/setlists/SceneRow';
import {DEFAULT_PERFORMANCE_SNAPSHOT, type Scene} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('SongDetail scene actions', () => {
  it('numbers scenes and shows each scene sound', () => {
    const {songs} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Clav');

    const {container} = renderDetail(songId);
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('Intro');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('Clav');
    expect(container.textContent).toContain('SINGLE');
  });

  it('renames a scene', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'Old');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'Old');
    click(byText(container, 'Rename'));
    typeInto(container, 'New');
    click(byText(container, 'Save'));

    expect(songs.getSong(songId)!.scenes[0].label).toBe('New');
  });

  it('moves a scene down and renumbers', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });

  it('hides Move up on the first scene and Move down on the last', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    expect(container.textContent).not.toContain('Move up');
    expect(container.textContent).toContain('Move down');
  });

  it('re-captures a scene from the live piano state', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Re-capture'));

    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).not.toBe(before);
    expect(songs.getSong(songId)!.scenes[0].label).toBe('A');
  });

  it('deletes a scene after confirmation', async () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Delete'));
    click(byText(container, 'Delete'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B']);
  });

  it('stores scene notes', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Notes'));
    typeInto(container, 'capo 2, half-time feel');
    click(byText(container, 'Save'));

    expect(songs.getSong(songId)!.scenes[0].notes).toBe('capo 2, half-time feel');
  });
});

describe('SceneRow compact width', () => {
  function makeScene(): Scene {
    return {
      id: 'sc1',
      label: 'Verse',
      notes: '',
      snapshot: {
        ...DEFAULT_PERFORMANCE_SNAPSHOT,
        voiceModeSnapshot: {
          voiceMode: 'single',
          rightToneId: 'rhodes',
          leftToneId: null,
          dualTone2Id: null,
        },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('shows the tone name when not compact', () => {
    stubPianoWithTones([{id: 'rhodes', name: 'Rhodes'}]);
    const {container, unmount} = render(
      <SceneRow
        scene={makeScene()}
        index={0}
        total={1}
        compact={false}
        isLightMode={false}
        onAction={() => {}}
      />,
    );

    expect(container.textContent).toContain('Rhodes');
    expect(container.textContent).toContain('SINGLE');
    unmount();
  });

  it('hides the tone name but keeps the badge when compact', () => {
    stubPianoWithTones([{id: 'rhodes', name: 'Rhodes'}]);
    const {container, unmount} = render(
      <SceneRow
        scene={makeScene()}
        index={0}
        total={1}
        compact={true}
        isLightMode={false}
        onAction={() => {}}
      />,
    );

    expect(container.textContent).not.toContain('Rhodes');
    expect(container.textContent).toContain('SINGLE');
    unmount();
  });
});

describe('SceneRow dual tones', () => {
  function dualScene(): Scene {
    return {
      id: 'sc-dual',
      label: 'Intro',
      notes: '',
      snapshot: {
        ...DEFAULT_PERFORMANCE_SNAPSHOT,
        voiceModeSnapshot: {
          voiceMode: 'dual',
          rightToneId: 'pad',
          leftToneId: null,
          dualTone2Id: 'mellow',
        },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('puts each tone on its own line instead of one overflowing line', () => {
    stubPianoWithTones([
      {id: 'pad', name: 'Soft Pad'},
      {id: 'mellow', name: 'Mellow Piano'},
    ]);
    const {container, unmount} = render(
      <SceneRow
        scene={dualScene()}
        index={0}
        total={1}
        compact={false}
        isLightMode={false}
        onAction={() => {}}
      />,
    );

    const lines = [...container.querySelectorAll('span')].filter(el =>
      /^[^A-Za-z]*(Soft Pad|Mellow Piano)$/.test((el.textContent ?? '').trim()),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].parentElement).toBe(lines[1].parentElement);
    expect(lines[0].parentElement!.className).toContain('flex-col');
    unmount();
  });
});
