/**
 * Task 5.1 — tests for the web app shell.
 *
 * Verifies the shell:
 *  - mounts the reused desktop `App` (read-only features stay mounted
 *    regardless of connectivity);
 *  - surfaces the unsupported notice (gating the connect affordance) when the
 *    context is not connection-capable; and
 *  - renders no notice when the context is fully capable.
 *
 * The reused `App` is mocked to keep the shell test isolated from the full
 * renderer tree; the store is mocked to a minimal theme selector.
 */
import { render, screen } from '@testing-library/react';
import { WebAppShell } from '../src/host/WebAppShell';

jest.mock('@pianel/ui/App', () => ({
  __esModule: true,
  default: () => <div data-testid="reused-app">REUSED APP</div>,
}));

jest.mock('../src/store', () => ({
  __esModule: true,
  useAppSettingsStore: (selector: (s: { themePreference: string }) => unknown) =>
    selector({ themePreference: 'dark' }),
}));

describe('WebAppShell', () => {
  it('mounts the reused desktop App and shows no notice when fully capable', () => {
    render(
      <WebAppShell
        capabilities={{ webMidiAvailable: true, secureContext: true }}
      />,
    );
    expect(screen.getByTestId('reused-app')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the reused App mounted and gates connect with a notice when Web MIDI is absent', () => {
    render(
      <WebAppShell
        capabilities={{ webMidiAvailable: false, secureContext: true }}
      />,
    );
    // Read-only features (reused App) remain mounted...
    expect(screen.getByTestId('reused-app')).toBeTruthy();
    // ...and the actionable connect-gating notice is shown.
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows the notice in a non-secure context', () => {
    render(
      <WebAppShell
        capabilities={{ webMidiAvailable: true, secureContext: false }}
      />,
    );
    expect(screen.getByTestId('reused-app')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
