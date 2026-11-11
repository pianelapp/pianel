import {Fader} from '@audio-ui/react/fader';
import {render} from '@testing-library/react';

describe('audio-ui fader primitive under the web jest setup', () => {
  it('mounts the real fader and exposes its native range input', () => {
    const {container} = render(
      <Fader.Root min={0} max={100} step={1} largeStep={10} value={40}>
        <Fader.Control>
          <Fader.Track>
            <Fader.Indicator />
            <Fader.Thumb aria-label="Smoke fader" />
          </Fader.Track>
        </Fader.Control>
      </Fader.Root>,
    );
    const input = container.querySelector('input[type="range"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input?.getAttribute('aria-label')).toBe('Smoke fader');
    expect((input as HTMLInputElement).min).toBe('0');
    expect((input as HTMLInputElement).max).toBe('100');
    expect((input as HTMLInputElement).value).toBe('40');
  });
});
