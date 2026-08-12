import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SceneNotFoundError} from '../../../src/types/setlist';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile, Preset} from '../../../src/types/profile';
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

/** Returns a distinguishable snapshot each call so copies can be told apart. */
function fakePresetService(): PresetService {
  let tempo = 100;
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
  } as unknown as PresetService;
}

describe('SongService scenes', () => {
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

  it('captureScene appends in order with an auto label', () => {
    const a = service.captureScene(songId);
    const b = service.captureScene(songId);
    expect(a.label).toBe('Scene 1');
    expect(b.label).toBe('Scene 2');
    expect(service.getSong(songId)?.scenes.map(s => s.id)).toEqual([a.id, b.id]);
  });

  it('captureScene accepts an explicit label and defaults notes to empty', () => {
    const scene = service.captureScene(songId, 'Chorus');
    expect(scene.label).toBe('Chorus');
    expect(scene.notes).toBe('');
  });

  it('captureScene stores the captured snapshot', () => {
    const first = service.captureScene(songId);
    const second = service.captureScene(songId);
    expect(second.snapshot.tempo).not.toBe(first.snapshot.tempo);
  });

  it('recaptureScene replaces the snapshot but keeps id, label and notes', () => {
    const scene = service.captureScene(songId, 'Verse');
    service.setSceneNotes(songId, scene.id, 'hold the pad');
    const updated = service.recaptureScene(songId, scene.id);
    expect(updated.id).toBe(scene.id);
    expect(updated.label).toBe('Verse');
    expect(updated.notes).toBe('hold the pad');
    expect(updated.snapshot.tempo).not.toBe(scene.snapshot.tempo);
  });

  it('captureScene rejects a whitespace-only explicit label', () => {
    expect(() => service.captureScene(songId, '   ')).toThrow(
      'Scene label cannot be empty.',
    );
  });

  it('renameScene rejects an empty label', () => {
    const scene = service.captureScene(songId);
    expect(() => service.renameScene(songId, scene.id, '  ')).toThrow(
      'Scene label cannot be empty.',
    );
  });

  it('scene mutators throw SceneNotFoundError for an unknown id', () => {
    expect(() => service.renameScene(songId, 'nope', 'X')).toThrow(SceneNotFoundError);
    expect(() => service.deleteScene(songId, 'nope')).toThrow(SceneNotFoundError);
  });

  it('moveScene reorders by array position', () => {
    const a = service.captureScene(songId, 'A');
    const b = service.captureScene(songId, 'B');
    const c = service.captureScene(songId, 'C');
    service.moveScene(songId, 2, 0);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['C', 'A', 'B']);
    expect(service.getSong(songId)?.scenes.map(s => s.id)).toEqual([c.id, a.id, b.id]);
  });

  it('moveScene clamps out-of-range indices instead of throwing', () => {
    service.captureScene(songId, 'A');
    service.captureScene(songId, 'B');
    service.moveScene(songId, 0, 99);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });

  it('moveScene is a no-op when from and to are the same index', () => {
    service.captureScene(songId, 'A');
    service.captureScene(songId, 'B');
    service.captureScene(songId, 'C');
    service.moveScene(songId, 1, 1);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['A', 'B', 'C']);
  });

  it('moveScene clamps a destination past the end to the last index', () => {
    service.captureScene(songId, 'A');
    service.captureScene(songId, 'B');
    service.captureScene(songId, 'C');
    service.moveScene(songId, 0, 10);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['B', 'C', 'A']);
  });

  it('moveScene on a single-scene song is always a no-op', () => {
    service.captureScene(songId, 'A');
    service.moveScene(songId, 0, 5);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['A']);
  });

  it('moveScene on an empty song does not throw', () => {
    expect(() => service.moveScene(songId, 0, 0)).not.toThrow();
    expect(service.getSong(songId)?.scenes).toEqual([]);
  });

  it('deleteScene removes it and leaves the rest in order', () => {
    service.captureScene(songId, 'A');
    const b = service.captureScene(songId, 'B');
    service.captureScene(songId, 'C');
    service.deleteScene(songId, b.id);
    expect(service.getSong(songId)?.scenes.map(s => s.label)).toEqual(['A', 'C']);
  });

  it('addPadAsScene copies the pad with a fresh id', () => {
    const pad: Preset = {
      id: 'pad-original',
      label: 'My Rhodes',
      tilePosition: 2,
      snapshot: {
        ...DEFAULT_PERFORMANCE_SNAPSHOT,
        tempo: 77,
        // Populate nested structures so mutating them post-copy can prove
        // the copy is deep, not just top-level primitives.
        voiceModeSnapshot: {
          voiceMode: 'split',
          rightToneId: 'tone-right',
          leftToneId: 'tone-left',
          dualTone2Id: null,
          splitPoint: 60,
        },
        quickToneSlots: [
          {voiceMode: 'single', rightToneId: 'slot-0-tone', leftToneId: null, dualTone2Id: null},
          null,
          null,
        ],
      },
      createdAt: 'x',
      updatedAt: 'x',
    };
    const scene = service.addPadAsScene(songId, pad);
    expect(scene.id).not.toBe('pad-original');
    expect(scene.label).toBe('My Rhodes');
    expect(scene.snapshot.tempo).toBe(77);
    expect(scene.notes).toBe('');

    // Copy, not link — mutating the pad, including at depth, must not touch
    // the scene. A shallow `{...pad.snapshot}` would share the nested
    // `voiceModeSnapshot` object and `quickToneSlots` entries by reference,
    // so these mutations only stay isolated under a genuine deep copy.
    pad.snapshot.tempo = 999;
    pad.snapshot.voiceModeSnapshot.rightToneId = 'mutated-right';
    pad.snapshot.quickToneSlots[0]!.rightToneId = 'mutated-slot';

    const stored = service.getSong(songId)?.scenes[0];
    expect(stored?.snapshot.tempo).toBe(77);
    expect(stored?.snapshot.voiceModeSnapshot.rightToneId).toBe('tone-right');
    expect(stored?.snapshot.quickToneSlots[0]?.rightToneId).toBe('slot-0-tone');
  });
});
