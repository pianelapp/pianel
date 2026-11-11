import {Fader} from '../../src/components/audio-ui/fader';
import {render} from '../utils/render';

describe('vendored audio-ui registry fader', () => {
  it('renders the real primitive with a native range thumb', () => {
    const {container, unmount} = render(
      <Fader
        aria-label="Registry fader"
        className="pianel-fader dark"
        min={0}
        max={100}
        step={1}
        largeStep={10}
        value={40}
        valueLabel="hidden"
        marks={[{value: 0, label: '0'}, 25, 50, 75, {value: 100, label: '100'}]}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pianel-fader');
    expect(root.className).toContain('dark');
    const input = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Registry fader');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.value).toBe('40');
    expect(
      container.querySelectorAll('[data-slot="fader-thumb-inner"] > div'),
    ).toHaveLength(3);
    expect(container.querySelector('[data-slot="fader-value"]')).toBeNull();
    unmount();
  });
});
