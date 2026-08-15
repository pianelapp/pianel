import {
  useProfilesStore,
  useCursorStore,
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type Profile,
} from '../../src/store';
import {CURRENT_SCHEMA_VERSION} from '@pianel/core/store';
import {SongService} from '@pianel/core/services/songs/SongService';
import {SetlistService} from '@pianel/core/services/setlists/SetlistService';
import {SetlistCursorService} from '@pianel/core/services/cursor/SetlistCursorService';
import {ProfileService} from '@pianel/core/services/profiles/ProfileService';
import type {PresetService} from '@pianel/core/services/presets/PresetService';
import type {PianoService} from '@pianel/core/services/PianoService';
import type {FilePickerAdapter} from '@pianel/core/services/profiles/FilePickerAdapter';
import {setSongService, resetSongService} from '../../src/hooks/useSongs';
import {setSetlistService, resetSetlistService} from '../../src/hooks/useSetlists';
import {setCursorService, resetCursorService} from '../../src/hooks/usePerformCursor';
import {setProfileService, resetProfileService} from '../../src/hooks/useProfiles';

export const PROFILE_ID = 'p1';

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: PROFILE_ID,
    name: 'Gig',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: DEFAULT_PERFORMANCE_SNAPSHOT,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function stubPresetService(): PresetService {
  let tempo = 100;
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
    applySnapshot: async () => {},
  } as unknown as PresetService;
}

export interface Wired {
  songs: SongService;
  setlists: SetlistService;
  cursor: SetlistCursorService;
  preset: PresetService;
  profile: ProfileService;
}

export function wire(): Wired {
  const preset = stubPresetService();
  const songs = new SongService(preset);
  const setlists = new SetlistService(songs);
  const cursor = new SetlistCursorService(songs, setlists, preset);
  const profile = new ProfileService(
    {} as unknown as PianoService,
    {} as unknown as FilePickerAdapter,
    preset,
  );
  setSongService(songs);
  setSetlistService(setlists);
  setCursorService(cursor);
  setProfileService(profile);
  return {songs, setlists, cursor, preset, profile};
}

export function resetSetlistWorld(profile: Profile = makeProfile()): void {
  resetSongService();
  resetSetlistService();
  resetCursorService();
  resetProfileService();
  useCursorStore.getState().exit();
  useProfilesStore.setState({profiles: [profile], activeProfileId: profile.id});
}
