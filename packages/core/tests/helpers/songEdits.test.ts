/**
 * Task 7b — pure Song/Scene transform helpers.
 *
 * These are the same rules `SongService` used to enforce inline (index
 * clamping, `SceneNotFoundError`, deep-copy on pad import, auto-labeling).
 * They now live here so `SetlistService.editOverride` can reuse them for
 * per-gig overrides without SongService widening its addressing model.
 */

import {
  buildScene,
  sceneFromPad,
  autoSceneLabel,
  appendScene,
  patchScene,
  moveSceneInSong,
  removeScene,
} from '../../src/helpers/songEdits';
import {SceneNotFoundError} from '../../src/types/setlist';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import type {Song, Scene} from '../../src/types/setlist';
import type {Preset} from '../../src/types/profile';

function makeSong(scenes: Scene[] = []): Song {
  const now = new Date().toISOString();
  return {
    id: '1-aaaaaaaa',
    name: 'Test Song',
    notes: '',
    scenes,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Builds a fixture scene with its own nested snapshot objects rather than a
 * shallow spread of `DEFAULT_PERFORMANCE_SNAPSHOT` — a shallow spread shares
 * `voiceModeSnapshot`/`quickToneSlots` by reference with the module singleton,
 * so mutating them here would pollute every later test in the file.
 */
function makeScene(overrides: Partial<Scene> = {}): Scene {
  const now = new Date().toISOString();
  return {
    id: `scene-${Math.random().toString(36).slice(2)}`,
    label: 'Scene',
    notes: '',
    snapshot: {
      ...DEFAULT_PERFORMANCE_SNAPSHOT,
      voiceModeSnapshot: {...DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot},
      quickToneSlots: [null, null, null],
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePad(): Preset {
  return {
    id: 'pad-original',
    label: 'My Rhodes',
    tilePosition: 2,
    snapshot: {
      ...DEFAULT_PERFORMANCE_SNAPSHOT,
      tempo: 77,
      // Populate nested structures so mutating them post-copy can prove the
      // copy is deep, not just top-level primitives.
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
}

describe('songEdits', () => {
  describe('buildScene', () => {
    it('mints an id matching the shared pattern, defaults notes to empty, and stamps createdAt === updatedAt', () => {
      const scene = buildScene('Intro', DEFAULT_PERFORMANCE_SNAPSHOT);
      expect(scene.id).toMatch(/^\d+-[a-z0-9]{8,}$/);
      expect(scene.label).toBe('Intro');
      expect(scene.notes).toBe('');
      expect(scene.createdAt).toBe(scene.updatedAt);
      expect(scene.snapshot).toBe(DEFAULT_PERFORMANCE_SNAPSHOT);
    });

    it('accepts an explicit notes value', () => {
      const scene = buildScene('Intro', DEFAULT_PERFORMANCE_SNAPSHOT, 'hold the pad');
      expect(scene.notes).toBe('hold the pad');
    });
  });

  describe('sceneFromPad', () => {
    it('gives a fresh id, carries the label, defaults notes to empty, and drops tilePosition', () => {
      const pad = makePad();
      const scene = sceneFromPad(pad);
      expect(scene.id).not.toBe('pad-original');
      expect(scene.id).toMatch(/^\d+-[a-z0-9]{8,}$/);
      expect(scene.label).toBe('My Rhodes');
      expect(scene.notes).toBe('');
      expect(scene).not.toHaveProperty('tilePosition');
    });

    it('deep-copies the snapshot: mutating the pad after the call leaves the scene unaffected', () => {
      const pad = makePad();
      const scene = sceneFromPad(pad);

      // Mutate the pad, including at depth, after the copy was made.
      pad.snapshot.tempo = 999;
      pad.snapshot.voiceModeSnapshot.rightToneId = 'mutated-right';
      pad.snapshot.quickToneSlots[0]!.rightToneId = 'mutated-slot';

      expect(scene.snapshot.tempo).toBe(77);
      expect(scene.snapshot.voiceModeSnapshot.rightToneId).toBe('tone-right');
      expect(scene.snapshot.quickToneSlots[0]?.rightToneId).toBe('slot-0-tone');
    });
  });

  describe('appendScene', () => {
    it('returns a new song with the scene appended last, without mutating the input', () => {
      const existing = makeScene({id: 'existing'});
      const song = makeSong([existing]);
      const added = makeScene({id: 'added'});

      const next = appendScene(song, added);

      expect(next.scenes.map(s => s.id)).toEqual(['existing', 'added']);
      expect(song.scenes).toEqual([existing]);
      expect(next).not.toBe(song);
    });
  });

  describe('patchScene', () => {
    it('applies the patch and stamps only the scene updatedAt, leaving the song updatedAt alone', () => {
      const scene = makeScene({
        id: 'a',
        label: 'Old',
        updatedAt: '2020-01-01T00:00:00.000Z',
      });
      const song = makeSong([scene]);
      const songUpdatedAt = song.updatedAt;

      const next = patchScene(song, 'a', s => ({...s, label: 'New'}));

      expect(next.scenes[0].label).toBe('New');
      expect(next.scenes[0].updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
      expect(next.updatedAt).toBe(songUpdatedAt);
    });

    it('throws SceneNotFoundError for an unknown id', () => {
      const song = makeSong([makeScene({id: 'a'})]);
      expect(() => patchScene(song, 'nope', s => s)).toThrow(SceneNotFoundError);
    });
  });

  describe('moveSceneInSong', () => {
    it('reorders scenes by array position', () => {
      const a = makeScene({id: 'a', label: 'A'});
      const b = makeScene({id: 'b', label: 'B'});
      const c = makeScene({id: 'c', label: 'C'});
      const song = makeSong([a, b, c]);

      const next = moveSceneInSong(song, 2, 0);
      expect(next.scenes.map(s => s.id)).toEqual(['c', 'a', 'b']);
    });

    it('clamps a past-the-end destination to the last index', () => {
      const a = makeScene({id: 'a'});
      const b = makeScene({id: 'b'});
      const c = makeScene({id: 'c'});
      const song = makeSong([a, b, c]);

      const next = moveSceneInSong(song, 0, 99);
      expect(next.scenes.map(s => s.id)).toEqual(['b', 'c', 'a']);
    });

    it('no-ops (returns the same song reference) when from and to are equal', () => {
      const a = makeScene({id: 'a'});
      const b = makeScene({id: 'b'});
      const song = makeSong([a, b]);

      expect(moveSceneInSong(song, 1, 1)).toBe(song);
    });

    it('no-ops on a single-scene song', () => {
      const song = makeSong([makeScene({id: 'a'})]);
      expect(moveSceneInSong(song, 0, 5)).toBe(song);
    });

    it('no-ops without throwing on a song with zero scenes', () => {
      const song = makeSong([]);
      expect(() => moveSceneInSong(song, 0, 0)).not.toThrow();
      expect(moveSceneInSong(song, 0, 0)).toBe(song);
    });
  });

  describe('removeScene', () => {
    it('removes the scene by id and preserves the order of the rest', () => {
      const a = makeScene({id: 'a'});
      const b = makeScene({id: 'b'});
      const c = makeScene({id: 'c'});
      const song = makeSong([a, b, c]);

      const next = removeScene(song, 'b');
      expect(next.scenes.map(s => s.id)).toEqual(['a', 'c']);
    });

    it('throws SceneNotFoundError for an unknown id', () => {
      const song = makeSong([makeScene({id: 'a'})]);
      expect(() => removeScene(song, 'nope')).toThrow(SceneNotFoundError);
    });
  });

  describe('autoSceneLabel', () => {
    it('returns "Scene 1" for an empty song', () => {
      expect(autoSceneLabel(makeSong([]))).toBe('Scene 1');
    });

    it('returns "Scene 4" for a three-scene song', () => {
      const song = makeSong([makeScene(), makeScene(), makeScene()]);
      expect(autoSceneLabel(song)).toBe('Scene 4');
    });
  });
});
