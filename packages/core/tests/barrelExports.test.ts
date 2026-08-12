import * as storeBarrel from '../src/store/index';
import * as rootBarrel from '../src/index';

describe('barrel exports', () => {
  it('store barrel exposes the cursor store and setlist errors', () => {
    expect(typeof storeBarrel.useCursorStore).toBe('function');
    expect(typeof storeBarrel.CURRENT_SCHEMA_VERSION).toBe('number');
    expect(typeof storeBarrel.SongNotFoundError).toBe('function');
    expect(typeof storeBarrel.SceneNotFoundError).toBe('function');
    expect(typeof storeBarrel.SetlistNotFoundError).toBe('function');
    expect(typeof storeBarrel.EmptySongError).toBe('function');
    expect(typeof storeBarrel.EmptySetlistError).toBe('function');
    expect(typeof storeBarrel.MissingSongError).toBe('function');
    expect(typeof storeBarrel.normalizeProfile).toBe('function');
  });

  it('root barrel exposes the three new services', () => {
    expect(typeof rootBarrel.SongService).toBe('function');
    expect(typeof rootBarrel.SetlistService).toBe('function');
    expect(typeof rootBarrel.SetlistCursorService).toBe('function');
  });
});
