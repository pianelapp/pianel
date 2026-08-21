import {act} from 'react';
import {installViewport, type FakeViewport} from '../utils/matchMedia';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderScreen} from '../fixtures/setlistsUi';
import {click} from '../utils/render';

const TIER_WIDTH = {mobile: 400, tablet: 900, desktop: 1400} as const;

let viewport: FakeViewport;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
  viewport = installViewport(TIER_WIDTH.desktop);
});

afterEach(() => {
  viewport.restore();
});

function setViewport(tier: keyof typeof TIER_WIDTH): void {
  act(() => viewport.setWidth(TIER_WIDTH[tier]));
}

function seedSong(): void {
  const {songs} = wire();
  const songId = songs.createSong('Vida Cega').id;
  songs.captureScene(songId, 'Intro');
}

function seedSetlist(): void {
  const {songs, setlists} = wire();
  const songId = songs.createSong('Vida Cega').id;
  songs.captureScene(songId, 'Intro');
  const listId = setlists.createSetlist('Ensaio da Poli').id;
  setlists.addSong(listId, songId);
}

describe('SetlistsScreen drill-down on mobile', () => {
  it('shows the list and no detail placeholder until a song is picked', () => {
    seedSong();
    setViewport('mobile');
    const {container} = renderScreen();

    expect(container.textContent).toContain('Vida Cega');
    expect(container.textContent).not.toContain('Select a song to see its scenes.');
    expect(container.querySelector('[data-detail-back]')).toBeNull();
  });

  it('replaces the list with the detail once a song is picked', () => {
    seedSong();
    setViewport('mobile');
    const {container} = renderScreen();

    click(byText(container, 'Vida Cega'));

    expect(container.textContent).toContain('Intro');
    expect(container.querySelector('[data-detail-back]')).not.toBeNull();
    expect(byText(container, 'Songs').closest('[data-detail-back]')).not.toBeNull();
  });

  it('goes back to the list from the detail', () => {
    seedSong();
    setViewport('mobile');
    const {container} = renderScreen();

    click(byText(container, 'Vida Cega'));
    click(container.querySelector('[data-detail-back]')!);

    expect(container.querySelector('[data-detail-back]')).toBeNull();
    expect(container.textContent).toContain('Vida Cega');
    expect(container.textContent).not.toContain('Intro');
  });

  it('drills into a setlist the same way', () => {
    seedSetlist();
    setViewport('mobile');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'Ensaio da Poli'));

    expect(container.querySelector('[data-detail-back]')).not.toBeNull();
    expect(container.textContent).toContain('Add Song');
  });

  it.each(['tablet', 'desktop'] as const)(
    'keeps both panes visible on %s',
    tier => {
      seedSong();
      setViewport(tier);
      const {container} = renderScreen();

      expect(container.textContent).toContain('Vida Cega');
      expect(container.textContent).toContain('Select a song to see its scenes.');

      click(byText(container, 'Vida Cega'));
      expect(container.textContent).toContain('Intro');
      expect(container.textContent).toContain('Vida Cega');
      expect(container.querySelector('[data-detail-back]')).toBeNull();
    },
  );

  it('clears a stale selection in the pane being opened on mobile', () => {
    seedSetlist();
    setViewport('desktop');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'Ensaio da Poli'));
    click(byText(container, 'Songs'));

    setViewport('mobile');
    click(byText(container, 'Setlists'));

    expect(container.querySelector('[data-detail-back]')).toBeNull();
    expect(container.textContent).toContain('Ensaio da Poli');
  });

  it('lands on the list, not a stale detail, when switching panes', () => {
    seedSetlist();
    setViewport('mobile');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'Ensaio da Poli'));
    click(container.querySelector('[data-detail-back]')!);
    click(byText(container, 'Songs'));
    click(byText(container, 'Setlists'));

    expect(container.querySelector('[data-detail-back]')).toBeNull();
    expect(container.textContent).toContain('Ensaio da Poli');
  });
});
