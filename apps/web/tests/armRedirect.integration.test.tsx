import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '@pianel/ui/App';
import { PianoService } from '@pianel/core/services/PianoService';
import { PresetService } from '@pianel/core/services/presets/PresetService';
import { SongService } from '@pianel/core/services/songs/SongService';
import { SetlistService } from '@pianel/core/services/setlists/SetlistService';
import { getDefaultEngine } from '@pianel/core/engine/registry';
import type { Transport } from '@pianel/core/transport/types';
import { setPianoService } from '@pianel/ui/hooks/usePiano';
import { setSongService } from '@pianel/ui/hooks/useSongs';
import { setSetlistService } from '@pianel/ui/hooks/useSetlists';
import {
  initStores,
  webStorage,
  useProfilesStore,
  useConnectionStore,
  DEFAULT_PERFORMANCE_SNAPSHOT,
} from '../src/store';
import { CURRENT_SCHEMA_VERSION } from '@pianel/core/store';

const stubTransport = {
  status: 'idle',
  scan: async () => {},
  stopScan: async () => {},
  connect: async () => {},
  disconnect: async () => {},
  send: async () => {},
  subscribe: () => () => {},
} as unknown as Transport;

let songs: SongService;

beforeAll(() => {
  initStores(webStorage);
  const pianoService = new PianoService(stubTransport);
  pianoService.setEngine(getDefaultEngine());
  setPianoService(pianoService);

  const presetService = new PresetService(pianoService);
  songs = new SongService(presetService);
  setSongService(songs);
  setSetlistService(new SetlistService(songs));
});

beforeEach(() => {
  useProfilesStore.setState({
    profiles: [
      {
        id: 'p1',
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
      },
    ],
    activeProfileId: 'p1',
  });
  useConnectionStore.setState({ status: 'connected' });
});

async function armFirstSong() {
  fireEvent.click(screen.getByRole('button', { name: 'SETLISTS' }));
  fireEvent.click(screen.getByText('Riff'));
  fireEvent.click(screen.getByRole('button', { name: 'ARM FOR CAPTURE' }));
  await act(async () => {});
}

describe('arming a song for capture', () => {
  it('lands the user on DISPLAY with the capture bar showing that song', async () => {
    act(() => {
      songs.createSong('Riff');
    });
    render(<App />);

    expect(screen.queryByText('BUILDING')).toBeNull();
    await armFirstSong();

    expect(screen.getByText('BUILDING')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CAPTURE SCENE' })).toBeTruthy();
  });

  it('stays on DISPLAY and clears the bar when capture is stopped from there', async () => {
    act(() => {
      songs.createSong('Riff');
    });
    render(<App />);
    await armFirstSong();

    fireEvent.click(screen.getByRole('button', { name: 'DONE' }));
    await act(async () => {});

    expect(screen.queryByText('BUILDING')).toBeNull();
    expect(screen.queryByRole('button', { name: 'CAPTURE SCENE' })).toBeNull();
  });
});
