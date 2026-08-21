import {
  SongNotFoundError,
  SceneNotFoundError,
  SetlistNotFoundError,
  EmptySongError,
  MissingSongError,
} from '../../src/types/setlist';

describe('setlist types', () => {
  it('SongNotFoundError carries a code and the id', () => {
    const err = new SongNotFoundError('123-abcdefgh');
    expect(err.code).toBe('song_not_found');
    expect(err.message).toContain('123-abcdefgh');
    expect(err).toBeInstanceOf(Error);
  });

  it('SceneNotFoundError carries a code and the id', () => {
    const err = new SceneNotFoundError('456-abcdefgh');
    expect(err.code).toBe('scene_not_found');
    expect(err.message).toContain('456-abcdefgh');
  });

  it('SetlistNotFoundError carries a code and the id', () => {
    const err = new SetlistNotFoundError('789-abcdefgh');
    expect(err.code).toBe('setlist_not_found');
    expect(err.message).toContain('789-abcdefgh');
  });

  it('EmptySongError names the song', () => {
    const err = new EmptySongError('Isn\'t She Lovely');
    expect(err.code).toBe('empty_song');
    expect(err.message).toContain("Isn't She Lovely");
  });

  it('MissingSongError names the dangling id', () => {
    const err = new MissingSongError('999-abcdefgh');
    expect(err.code).toBe('missing_song');
    expect(err.message).toContain('999-abcdefgh');
  });
});
