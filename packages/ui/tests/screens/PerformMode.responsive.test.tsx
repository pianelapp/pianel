import {act} from 'react';
import {installViewport, type FakeViewport} from '../utils/matchMedia';
import {initTestStores} from '../utils/stores';
import {resetSetlistWorld} from '../fixtures/setlists';
import {renderPerforming, renderPerformingSetlist} from '../fixtures/setlistsUi';
import {useConnectionStore} from '../../src/store';
import {PerformMode} from '../../src/screens/perform/PerformMode';

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

describe('PerformMode layouts', () => {
  it('renders two columns on tablet', async () => {
    setViewport('tablet');
    const {container} = await renderPerforming(['A', 'B']);
    expect(container.querySelector('[data-layout]')!.getAttribute('data-layout'))
      .toBe('columns');
  });

  it('stacks on mobile', async () => {
    setViewport('mobile');
    const {container} = await renderPerforming(['A', 'B']);
    expect(container.querySelector('[data-layout]')!.getAttribute('data-layout'))
      .toBe('stacked');
  });

  it('keeps the StatusBar in both layouts', async () => {
    for (const v of ['tablet', 'mobile'] as const) {
      setViewport(v);
      const {container} = await renderPerforming(['A']);
      expect(container.querySelector('[data-statusbar]')).not.toBeNull();
    }
  });

  it('pins the advance button outside the scrolling region when stacked', async () => {
    setViewport('mobile');
    const {container} = await renderPerforming(['A', 'B', 'C']);
    const primary = container.querySelector('[data-perform-primary]')!;
    expect(primary.closest('[data-scrolls]')).toBeNull();
  });

  it.each(['tablet', 'mobile'] as const)(
    'has no song arrows and a tappable title on %s',
    async viewport => {
      setViewport(viewport);
      const {container} = await renderPerformingSetlist(['One', 'Two']);
      expect(container.querySelector('[data-song-next]')).toBeNull();
      expect(container.querySelector('[data-song-prev]')).toBeNull();
      expect(container.querySelector('[data-song-title]')!.tagName).toBe('BUTTON');
    },
  );

  it.each(['disconnected', 'stale', 'idle'] as const)(
    'shows the banner when the connection is %s',
    async status => {
      for (const v of ['tablet', 'mobile'] as const) {
        setViewport(v);
        act(() => {
          useConnectionStore.setState({status});
        });
        const {container} = await renderPerforming(['A']);
        expect(container.textContent).toContain('PIANO DISCONNECTED');
      }
    },
  );

  it('hides the banner once connected', async () => {
    for (const v of ['tablet', 'mobile'] as const) {
      setViewport(v);
      act(() => {
        useConnectionStore.setState({status: 'disconnected'});
      });
      const {container, rerender} = await renderPerforming(['A']);
      expect(container.textContent).toContain('PIANO DISCONNECTED');

      act(() => {
        useConnectionStore.setState({status: 'connected'});
      });
      rerender(<PerformMode isLightMode={false} />);
      expect(container.textContent).not.toContain('PIANO DISCONNECTED');
    }
  });
});
