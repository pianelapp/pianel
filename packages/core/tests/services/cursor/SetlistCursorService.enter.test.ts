import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {SetlistCursorService} from '../../../src/services/cursor/SetlistCursorService';
import {useCursorStore} from '../../../src/store/cursorStore';
import {
  EmptySetlistError,
  EmptySongError,
  SetlistNotFoundError,
} from '../../../src/types/setlist';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile} from '../../../src/types/profile';
import type {PerformanceSnapshot} from '../../../src/types/performanceSnapshot';
import type {PresetService} from '../../../src/services/presets/PresetService';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';

function makeProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: '1-aaaaaaaa',
    name: 'Workspace',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: now,
    updatedAt: now,
  };
}

function recordingPresetService() {
  const applied: PerformanceSnapshot[] = [];
  let tempo = 100;
  const service = {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
    applySnapshot: async (snapshot: PerformanceSnapshot) => {
      applied.push(snapshot);
    },
  } as unknown as PresetService;
  return {service, applied};
}

describe('SetlistCursorService enter/exit/jump', () => {
  let songs: SongService;
  let setlists: SetlistService;
  let cursor: SetlistCursorService;
  let applied: PerformanceSnapshot[];
  let songId: string;
  let listId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);

    const rec = recordingPresetService();
    applied = rec.applied;
    songs = new SongService(rec.service);
    setlists = new SetlistService(songs);
    cursor = new SetlistCursorService(songs, setlists, rec.service);

    songId = songs.createSong('Isn\'t She Lovely').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Verse');
    songs.captureScene(songId, 'Chorus');

    listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    useCursorStore.getState().exit();
  });

  it('enterPerform(setlist) starts at entry 0, scene 0 and applies it', async () => {
    await cursor.enterPerform({setlistId: listId});
    const s = useCursorStore.getState();
    expect(s.isPerforming).toBe(true);
    expect(s.setlistId).toBe(listId);
    expect(s.entryIndex).toBe(0);
    expect(s.sceneIndex).toBe(0);
    expect(applied).toHaveLength(1);
  });

  it('enterPerform(song) uses the single-song path with a null setlistId', async () => {
    await cursor.enterPerform({songId});
    const s = useCursorStore.getState();
    expect(s.setlistId).toBeNull();
    expect(s.songId).toBe(songId);
    expect(s.entryIndex).toBe(0);
  });

  it('enterPerform throws EmptySongError for a song with no scenes, and sends nothing', async () => {
    const empty = songs.createSong('Empty').id;
    await expect(cursor.enterPerform({songId: empty})).rejects.toThrow(EmptySongError);
    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('enterPerform throws SetlistNotFoundError for an unknown setlist id, and sends nothing', async () => {
    await expect(
      cursor.enterPerform({setlistId: 'no-such-setlist'}),
    ).rejects.toThrow(SetlistNotFoundError);
    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('enterPerform throws EmptySetlistError for a setlist with no entries, and sends nothing', async () => {
    const barren = setlists.createSetlist('Empty Gig').id;
    await expect(cursor.enterPerform({setlistId: barren})).rejects.toThrow(
      EmptySetlistError,
    );
    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('enterPerform throws EmptySetlistError when the only entry is dangling, and sends nothing', async () => {
    const doomed = songs.createSong('Doomed').id;
    songs.captureScene(doomed, 'X');
    const gig = setlists.createSetlist('Ghost Gig').id;
    setlists.addSong(gig, doomed);
    songs.deleteSong(doomed);

    await expect(cursor.enterPerform({setlistId: gig})).rejects.toThrow(
      EmptySetlistError,
    );
    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('enterPerform throws EmptySetlistError when the only entry has no scenes, and sends nothing', async () => {
    const bare = songs.createSong('No Scenes Yet').id;
    const gig = setlists.createSetlist('Rehearsal Gig').id;
    setlists.addSong(gig, bare);

    await expect(cursor.enterPerform({setlistId: gig})).rejects.toThrow(
      EmptySetlistError,
    );
    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('enterPerform skips a dangling entry 0 and lands on the first playable entry', async () => {
    const doomed = songs.createSong('Doomed').id;
    songs.captureScene(doomed, 'X');
    const gig = setlists.createSetlist('Skip Gig').id;
    setlists.addSong(gig, doomed);
    songs.deleteSong(doomed);
    setlists.addSong(gig, songId);

    await cursor.enterPerform({setlistId: gig});
    const s = useCursorStore.getState();
    expect(s.entryIndex).toBe(1);
    expect(s.songId).toBe(songId);
    expect(cursor.getCurrentScene()?.label).toBe('Intro');
    expect(applied).toHaveLength(1);
  });

  it('enterPerform skips a zero-scene entry 0 and lands on the first playable entry', async () => {
    const bare = songs.createSong('No Scenes Yet').id;
    const gig = setlists.createSetlist('Skip Gig 2').id;
    setlists.addSong(gig, bare);
    setlists.addSong(gig, songId);

    await cursor.enterPerform({setlistId: gig});
    const s = useCursorStore.getState();
    expect(s.entryIndex).toBe(1);
    expect(s.songId).toBe(songId);
    expect(cursor.getCurrentScene()?.label).toBe('Intro');
    expect(applied).toHaveLength(1);
  });

  it('getCurrentSong and getCurrentScene reflect the cursor', async () => {
    await cursor.enterPerform({setlistId: listId});
    expect(cursor.getCurrentSong()?.id).toBe(songId);
    expect(cursor.getCurrentScene()?.label).toBe('Intro');
  });

  it('getCurrentSong and getCurrentScene work through the single-song path', async () => {
    await cursor.enterPerform({songId});
    expect(cursor.getCurrentSong()?.id).toBe(songId);
    expect(cursor.getCurrentScene()?.label).toBe('Intro');
  });

  it("getCurrentSong returns a customized entry's override, not the library song", async () => {
    setlists.customizeEntry(listId, 0);
    setlists.editOverride(listId, 0, song => ({...song, name: 'Gig-Only Version'}));

    await cursor.enterPerform({setlistId: listId});
    expect(cursor.getCurrentSong()?.name).toBe('Gig-Only Version');
    expect(songs.getSong(songId)?.name).toBe("Isn't She Lovely");
  });

  it('jumpToScene moves and applies', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.jumpToScene(2);
    expect(useCursorStore.getState().sceneIndex).toBe(2);
    expect(cursor.getCurrentScene()?.label).toBe('Chorus');
    expect(applied).toHaveLength(2);
  });

  it('jumpToScene ignores an out-of-range index without applying', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.jumpToScene(99);
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    expect(applied).toHaveLength(1);
  });

  it('jumpToSong moves to another entry at scene 0 and applies', async () => {
    const second = songs.createSong('Superstition').id;
    songs.captureScene(second, 'Head');
    setlists.addSong(listId, second);

    await cursor.enterPerform({setlistId: listId});
    await cursor.jumpToSong(1);
    const s = useCursorStore.getState();
    expect(s.entryIndex).toBe(1);
    expect(s.songId).toBe(second);
    expect(s.sceneIndex).toBe(0);
    expect(applied).toHaveLength(2);
  });

  it('jumpToSong ignores a dangling entry, leaving the cursor untouched and sending nothing', async () => {
    const doomed = songs.createSong('Doomed').id;
    songs.captureScene(doomed, 'X');
    setlists.addSong(listId, doomed);
    songs.deleteSong(doomed);

    await cursor.enterPerform({setlistId: listId});
    const before = useCursorStore.getState();
    await cursor.jumpToSong(1);
    const after = useCursorStore.getState();
    expect(after.entryIndex).toBe(before.entryIndex);
    expect(after.songId).toBe(before.songId);
    expect(after.sceneIndex).toBe(before.sceneIndex);
    expect(applied).toHaveLength(1);
  });

  it('exitPerform clears the cursor', async () => {
    await cursor.enterPerform({setlistId: listId});
    cursor.exitPerform();
    expect(useCursorStore.getState().isPerforming).toBe(false);
  });
});
