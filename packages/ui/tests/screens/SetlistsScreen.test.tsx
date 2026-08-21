import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderScreen} from '../fixtures/setlistsUi';
import {useCursorStore} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('SetlistsScreen', () => {
  it('opens on the Songs pane with an empty-library message', () => {
    const {container, unmount} = renderScreen();
    expect(container.textContent).toContain('Songs');
    expect(container.textContent).toContain('No songs yet');
    unmount();
  });

  it('switches to the Setlists pane', () => {
    const {container, unmount} = renderScreen();
    click(byText(container, 'Setlists'));
    expect(container.textContent).toContain('No setlists yet');
    unmount();
  });

  it('lists library songs with their scene counts', () => {
    const {songs} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Verse');

    const {container, unmount} = renderScreen();
    expect(container.textContent).toContain('Superstition');
    expect(container.textContent).toContain('2 scenes');
    unmount();
  });

  it('selects a song and shows its scenes in the detail pane', () => {
    const {songs} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');

    const {container, unmount} = renderScreen();
    click(byText(container, 'Superstition'));
    expect(container.textContent).toContain('Intro');
    unmount();
  });

  it('renders a singular scene count', () => {
    const {songs} = wire();
    songs.captureScene(songs.createSong('Interlude').id, 'Only');
    const {container, unmount} = renderScreen();
    expect(container.textContent).toContain('1 scene');
    expect(container.textContent).not.toContain('1 scenes');
    unmount();
  });

  it('disables PERFORM SONG for a song with no scenes', () => {
    const {songs} = wire();
    songs.createSong('Superstition');

    const {container, unmount} = renderScreen();
    click(byText(container, 'Superstition'));
    const performButton = byText(container, 'PERFORM SONG') as HTMLButtonElement;
    expect(performButton.disabled).toBe(true);
    unmount();
  });

  it('enables PERFORM SONG once a scene is captured', () => {
    const {songs} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');

    const {container, unmount} = renderScreen();
    click(byText(container, 'Superstition'));
    const performButton = byText(container, 'PERFORM SONG') as HTMLButtonElement;
    expect(performButton.disabled).toBe(false);
    unmount();
  });

  it('clicking PERFORM SONG enters perform mode', () => {
    const {songs} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');

    const {container, unmount} = renderScreen();
    click(byText(container, 'Superstition'));
    click(byText(container, 'PERFORM SONG'));
    expect(useCursorStore.getState().isPerforming).toBe(true);
    unmount();
  });

  it('disables PERFORM for a setlist with no playable song', () => {
    const {setlists} = wire();
    setlists.createSetlist('Bar Gig');

    const {container, unmount} = renderScreen();
    click(byText(container, 'Setlists'));
    click(byText(container, 'Bar Gig'));
    const performButton = [...container.querySelectorAll('button')].find(
      b => b.textContent?.trim() === 'PERFORM',
    ) as HTMLButtonElement;
    expect(performButton.disabled).toBe(true);
    unmount();
  });
});
