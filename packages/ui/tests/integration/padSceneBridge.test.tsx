import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld, makeProfile} from '../fixtures/setlists';
import {byText, openContextMenu, renderPresets, renderDetail, renderList} from '../fixtures/setlistsUi';
import {useProfilesStore, DEFAULT_PERFORMANCE_SNAPSHOT, type Preset} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

const GRAND_PIANO_PRESET: Preset = {
  id: 'preset-grand-piano',
  label: 'Grand Piano',
  tilePosition: 0,
  snapshot: DEFAULT_PERFORMANCE_SNAPSHOT,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  resetSetlistWorld(makeProfile({presets: [GRAND_PIANO_PRESET]}));
});

describe('pad <-> scene bridge', () => {
  it('adds a pad to a song as a new scene, carrying the label', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Target').id;
    const {container} = renderPresets();

    openContextMenu(container, 'Grand Piano');
    click(byText(container, 'Add pad as scene'));
    click(byText(container, 'Target'));
    await act(async () => {});

    const scenes = songs.getSong(songId)!.scenes;
    expect(scenes).toHaveLength(1);
    expect(scenes[0].label).toBe('Grand Piano');
  });

  it('copies rather than links: editing the scene leaves the pad alone', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Target').id;
    const {container} = renderPresets();

    openContextMenu(container, 'Grand Piano');
    click(byText(container, 'Add pad as scene'));
    click(byText(container, 'Target'));
    await act(async () => {});

    const scene = songs.getSong(songId)!.scenes[0];
    act(() => {
      songs.renameScene(songId, scene.id, 'Renamed');
    });

    const pad = useProfilesStore.getState().profiles[0].presets[0];
    expect(pad.label).toBe('Grand Piano');
    expect(scene.id).not.toBe(pad.id);
    expect(scene.snapshot).not.toBe(pad.snapshot);
  });

  it('offers no target picker when the library is empty', () => {
    wire();
    const {container} = renderPresets();
    openContextMenu(container, 'Grand Piano');
    click(byText(container, 'Add pad as scene'));
    expect(container.textContent).toContain('No songs yet');
  });

  it('saves a scene onto the first free pad tile after confirming the audible apply', async () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'Clav');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'Clav');
    click(byText(container, 'Save scene as pad'));
    await act(async () => {});

    expect(container.textContent).toContain(
      'This will load the scene onto the piano, then save it to pad 2.',
    );
    click(byText(container, 'Save'));
    await act(async () => {});

    const presets = useProfilesStore.getState().profiles[0].presets;
    expect(presets.some(p => p.label === 'Clav')).toBe(true);
  });

  it('saves a scene embedded in a setlist entry onto a pad too', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'Clav');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, songId);
    const {container} = renderList(listId);

    click(byText(container, 'S'));
    openContextMenu(container, 'Clav');
    click(byText(container, 'Save scene as pad'));
    await act(async () => {});
    click(byText(container, 'Save'));
    await act(async () => {});

    const presets = useProfilesStore.getState().profiles[0].presets;
    expect(presets.some(p => p.label === 'Clav')).toBe(true);
  });

  it('warns and does not save when every pad tile is full', async () => {
    const fullPresets: Preset[] = Array.from({length: 8}, (_, i) => ({
      ...GRAND_PIANO_PRESET,
      id: `preset-${i}`,
      tilePosition: i,
    }));
    resetSetlistWorld(makeProfile({presets: fullPresets}));
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'Clav');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'Clav');
    click(byText(container, 'Save scene as pad'));
    await act(async () => {});

    expect(container.textContent).toContain('No free pad');
    const presets = useProfilesStore.getState().profiles[0].presets;
    expect(presets.some(p => p.label === 'Clav')).toBe(false);
    expect(presets).toHaveLength(8);
  });
});
