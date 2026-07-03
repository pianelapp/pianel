/**
 * 009-settings-preferences Task 4 — host bootstrap chord-service sync.
 *
 * Requirements 6.4, 7.1, 7.3:
 *  - After bootstrap resolves, the chord service reflects the restored
 *    accidental preference (flats → not-sharps).
 *  - A subsequent store-driven accidental change (e.g. a profile switch through
 *    `loadProfile`) re-syncs the live chord spelling via a single subscription.
 */
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import {getChordService} from '@pianel/core/services/ChordService';
import {
  syncChordAccidentalsFromStore,
  subscribeChordAccidentals,
} from '../../src/host/chordAccidentalSync';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  useAppSettingsStore.getState().setAccidentalPreference('sharps');
  getChordService().setUseSharps(true);
});

describe('syncChordAccidentalsFromStore (boot restore)', () => {
  it('applies flats spelling when the restored preference is flats', () => {
    useAppSettingsStore.getState().setAccidentalPreference('flats');
    syncChordAccidentalsFromStore();
    expect(getChordService().getUseSharps()).toBe(false);
  });

  it('applies sharps spelling when the restored preference is sharps', () => {
    useAppSettingsStore.getState().setAccidentalPreference('sharps');
    syncChordAccidentalsFromStore();
    expect(getChordService().getUseSharps()).toBe(true);
  });
});

describe('subscribeChordAccidentals (profile-switch re-sync)', () => {
  it('re-syncs the chord service when the store accidental preference changes', () => {
    const unsub = subscribeChordAccidentals();
    // Simulate a profile switch that updates the store to flats.
    useAppSettingsStore.getState().setAccidentalPreference('flats');
    expect(getChordService().getUseSharps()).toBe(false);
    // And back to sharps.
    useAppSettingsStore.getState().setAccidentalPreference('sharps');
    expect(getChordService().getUseSharps()).toBe(true);
    unsub();
  });

  it('stops re-syncing after unsubscribe', () => {
    const unsub = subscribeChordAccidentals();
    unsub();
    getChordService().setUseSharps(true);
    useAppSettingsStore.getState().setAccidentalPreference('flats');
    // No subscription → chord service unchanged.
    expect(getChordService().getUseSharps()).toBe(true);
  });
});
