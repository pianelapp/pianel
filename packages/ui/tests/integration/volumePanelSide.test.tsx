import * as React from 'react';
import {act} from 'react';
import {PianoService} from '@pianel/core/services/PianoService';
import {getDefaultEngine} from '@pianel/core/engine/registry';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PERFORMANCE_SNAPSHOT,
} from '@pianel/core/store';
import type {Profile} from '@pianel/core/store';
import type {Transport} from '@pianel/core/transport/types';
import {
  useAppSettingsStore,
  useConnectionStore,
  useProfilesStore,
} from '../../src/store';
import {click, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, type Wired} from '../fixtures/setlists';
import {setPianoService} from '../../src/hooks/usePiano';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {StatusBar} from '../../src/screens/display/StatusBar';
import {AppearanceSettings} from '../../src/components/settings/AppearanceSettings';

function silentTransport(): Transport {
  return {
    status: 'connected',
    scan: async () => {},
    stopScan: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    send: async () => {},
    subscribe: () => () => {},
  } as unknown as Transport;
}

function profile(id: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id,
    name: id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function Screen() {
  return (
    <>
      <AppearanceSettings isLightMode />
      <StatusBar isLightMode />
    </>
  );
}

function panel(): HTMLElement | null {
  return document.querySelector(
    '[role="dialog"][aria-label="Master Volume"]',
  ) as HTMLElement | null;
}

function volumeButton(container: HTMLElement): HTMLButtonElement {
  return Array.from(container.querySelectorAll('button')).find(
    b => b.getAttribute('aria-label') === 'Master Volume',
  ) as HTMLButtonElement;
}

function openedSide(container: HTMLElement): string | null {
  click(volumeButton(container));
  const side = panel()?.getAttribute('data-master-volume-side') ?? null;
  click(volumeButton(container));
  return side;
}

function activeProfile(): Profile {
  const {profiles, activeProfileId} = useProfilesStore.getState();
  return profiles.find(p => p.id === activeProfileId)!;
}

let piano: PianoService;
let wired: Wired;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  piano = new PianoService(silentTransport());
  piano.setEngine(getDefaultEngine());
  setPianoService(piano);
  wired = wire();
  act(() => {
    useConnectionStore.setState({status: 'connected'});
    useAppSettingsStore.getState().setMasterVolumeSide('right');
    useProfilesStore.setState({
      profiles: [
        profile('prof-church0000', {masterVolumeSide: 'left'}),
        profile('prof-band000000'),
      ],
      activeProfileId: 'prof-band000000',
    });
  });
});

afterEach(() => {
  piano.handleLinkClosed();
  resetProfileService();
  act(() => {
    useConnectionStore.setState({status: 'disconnected'});
  });
});

describe('Volume panel side across Appearance, the StatusBar and profiles', () => {
  it('opens on the right by default', () => {
    const {container, unmount} = render(<Screen />);
    expect(openedSide(container)).toBe('right');
    unmount();
  });

  it('opens on the left once Left is chosen in Appearance, and saves it to the active profile', () => {
    const {container, unmount} = render(<Screen />);
    click(container.querySelector('[data-volume-side="left"]')!);
    expect(openedSide(container)).toBe('left');
    expect(activeProfile().masterVolumeSide).toBe('left');
    unmount();
  });

  it('follows the side saved in each profile when profiles are switched', async () => {
    const {container, unmount} = render(<Screen />);

    await act(() => wired.profile.loadProfile('prof-church0000'));
    expect(openedSide(container)).toBe('left');
    expect(
      container
        .querySelector('[data-volume-side="left"]')!
        .getAttribute('aria-pressed'),
    ).toBe('true');

    await act(() => wired.profile.loadProfile('prof-band000000'));
    expect(openedSide(container)).toBe('right');
    unmount();
  });
});
