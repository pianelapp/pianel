/**
 * T040 — ProfileService lifecycle tests (US2).
 *
 * Covers:
 *  - ensureDefaultProfile: no-op when profiles exist, creates "Default" when
 *    empty (R7), and rebinds activeProfileId to MRU when it dangles.
 *  - createProfile: trim + uniqueness (R6) + auto-activates new profile.
 *  - updateProfile: re-captures all FR-011 fields.
 *  - renameProfile: changes only name (per SC-009).
 *  - deleteProfile: MRU fallback; auto-recreates Default when none remain.
 */

import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore, useAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {DuplicateProfileNameError, ProfileNotFoundError} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  deviceName: string | null = null;
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(): Promise<void> {}
}

const fakePicker: FilePickerAdapter = {
  async openProfileJson() {
    return null;
  },
  async saveProfileJson() {
    return false;
  },
};

function newProfileService(): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return new ProfileService(pianoService, fakePicker, presetService);
}

beforeAll(() => {
  createProfilesStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useProfilesStore.setState({profiles: [], activeProfileId: ''});
});

// ─── ensureDefaultProfile ───────────────────────────────────────

describe('ProfileService.ensureDefaultProfile', () => {
  it('creates "Default" when no profiles exist (R7)', async () => {
    const service = newProfileService();
    const profile = await service.ensureDefaultProfile();
    expect(profile.name).toBe('Default');
    expect(useProfilesStore.getState().activeProfileId).toBe(profile.id);
  });

  it('is a no-op when at least one profile already exists', async () => {
    const service = newProfileService();
    const a = await service.ensureDefaultProfile();
    const b = await service.ensureDefaultProfile();
    expect(a.id).toBe(b.id);
    expect(useProfilesStore.getState().profiles).toHaveLength(1);
  });

  it('rebinds activeProfileId to MRU when it dangles', async () => {
    const service = newProfileService();
    await service.ensureDefaultProfile();
    // Simulate corruption: activeProfileId points to nothing.
    useProfilesStore.getState().setActiveProfileId('non-existent');
    const active = await service.ensureDefaultProfile();
    expect(useProfilesStore.getState().activeProfileId).toBe(active.id);
  });
});

// ─── createProfile ──────────────────────────────────────────────

describe('ProfileService.createProfile', () => {
  it('throws DuplicateProfileNameError on name collision (R6)', async () => {
    const service = newProfileService();
    await service.createProfile('Alpha');
    await expect(service.createProfile('Alpha')).rejects.toBeInstanceOf(
      DuplicateProfileNameError,
    );
  });

  it('trims surrounding whitespace before validating', async () => {
    const service = newProfileService();
    await service.createProfile('Alpha');
    await expect(service.createProfile('  Alpha  ')).rejects.toBeInstanceOf(
      DuplicateProfileNameError,
    );
  });

  it('rejects empty / whitespace name', async () => {
    const service = newProfileService();
    await expect(service.createProfile('   ')).rejects.toThrow();
  });

  it('auto-activates the new profile (FR-012)', async () => {
    const service = newProfileService();
    const profile = await service.createProfile('Alpha');
    expect(useProfilesStore.getState().activeProfileId).toBe(profile.id);
  });
});

// ─── updateProfile ──────────────────────────────────────────────

describe('ProfileService.updateProfile', () => {
  it('re-captures defaultState from current app state', async () => {
    const service = newProfileService();
    const profile = await service.createProfile('Alpha');
    useAppSettingsStore.getState().setThemePreference('dark');
    const updated = await service.updateProfile(profile.id);
    expect(updated.theme).toBe('dark');
  });

  it('throws DuplicateProfileNameError when renamed to existing other name', async () => {
    const service = newProfileService();
    const a = await service.createProfile('Alpha');
    await service.createProfile('Beta');
    await expect(
      service.updateProfile(a.id, {name: 'Beta'}),
    ).rejects.toBeInstanceOf(DuplicateProfileNameError);
  });

  it('throws ProfileNotFoundError on unknown id', async () => {
    const service = newProfileService();
    await expect(service.updateProfile('ghost')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});

// ─── renameProfile (SC-009: only name changes) ──────────────────

describe('ProfileService.renameProfile', () => {
  it('changes only name + updatedAt (snapshot untouched)', async () => {
    const service = newProfileService();
    const profile = await service.createProfile('Alpha');
    useAppSettingsStore.getState().setThemePreference('dark');

    const renamed = await service.renameProfile(profile.id, 'AlphaPrime');
    expect(renamed.name).toBe('AlphaPrime');
    // theme is whatever was captured at creation, NOT recaptured.
    expect(renamed.theme).toBe(profile.theme);
  });

  it('uniqueness check excludes self', async () => {
    const service = newProfileService();
    const profile = await service.createProfile('Alpha');
    // Renaming to the same name should succeed (excluded from check).
    const renamed = await service.renameProfile(profile.id, 'Alpha');
    expect(renamed.name).toBe('Alpha');
  });

  it('rejects empty / whitespace name', async () => {
    const service = newProfileService();
    const profile = await service.createProfile('Alpha');
    await expect(service.renameProfile(profile.id, '   ')).rejects.toThrow();
  });
});

// ─── deleteProfile ──────────────────────────────────────────────

describe('ProfileService.deleteProfile', () => {
  it('falls back to most-recently-updated remaining profile when active is deleted', async () => {
    const service = newProfileService();
    const a = await service.createProfile('Alpha');
    const b = await service.createProfile('Beta'); // newer
    expect(useProfilesStore.getState().activeProfileId).toBe(b.id);
    // Make `a` more-recently updated than `b`.
    await service.updateProfile(a.id);
    const result = await service.deleteProfile(b.id);
    expect(result.newActiveProfileId).toBe(a.id);
  });

  it('auto-creates Default when deleting the only profile', async () => {
    const service = newProfileService();
    const a = await service.createProfile('Alpha');
    const {newActiveProfileId} = await service.deleteProfile(a.id);
    const active = service.getActiveProfile()!;
    expect(active.id).toBe(newActiveProfileId);
    expect(active.name).toBe('Default');
  });

  it('throws ProfileNotFoundError on unknown id', async () => {
    const service = newProfileService();
    await expect(service.deleteProfile('ghost')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});

// ─── listProfiles ───────────────────────────────────────────────

describe('ProfileService.listProfiles', () => {
  it('returns profiles ordered by updatedAt desc', async () => {
    const service = newProfileService();
    const a = await service.createProfile('Alpha');
    // Force time gap so updatedAt comparisons are stable.
    await new Promise(r => setTimeout(r, 5));
    const b = await service.createProfile('Beta');
    const list = service.listProfiles();
    expect(list.map(p => p.id)).toEqual([b.id, a.id]);
  });
});
