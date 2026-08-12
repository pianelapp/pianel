/**
 * Task 7b — service-level coverage for `moveScene`'s no-write no-op path.
 *
 * `songEdits.test.ts` already pins the pure helper's identity-return
 * behaviour (`moveSceneInSong` returns the exact same `Song` reference when
 * `from`/`to` clamp to the same index). What it can't see is whether
 * `SongService.moveScene` actually honors that signal by skipping the write,
 * since `_patchSong` unconditionally stamps `updatedAt` whenever it runs. A
 * regression that always called `_patchSong` (even on a no-op) would still
 * satisfy every "scene order unchanged" assertion in `SongService.scenes.test.ts`
 * while silently bumping `updatedAt` on every no-op call — this file is the
 * one place that would catch it.
 *
 * Deliberately a separate file: `SongService.crud.test.ts` and
 * `SongService.scenes.test.ts` must stay unmodified as proof the Task 7b
 * refactor changed no behaviour.
 */

import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile} from '../../../src/types/profile';
import type {PresetService} from '../../../src/services/presets/PresetService';

function makeProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: '1-aaaaaaaa',
    name: 'Workspace',
    schemaVersion: 2,
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

function fakePresetService(): PresetService {
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT}),
  } as unknown as PresetService;
}

describe('SongService.moveScene no-op write behaviour', () => {
  let service: SongService;
  let songId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);
    service = new SongService(fakePresetService());
    songId = service.createSong('Isn\'t She Lovely').id;
  });

  it('does not bump updatedAt when from and to clamp to the same index', () => {
    service.captureScene(songId, 'A');
    service.captureScene(songId, 'B');
    service.captureScene(songId, 'C');

    const before = service.getSong(songId)!.updatedAt;
    const result = service.moveScene(songId, 1, 1);

    expect(result.updatedAt).toBe(before);
    expect(service.getSong(songId)!.updatedAt).toBe(before);
  });
});
