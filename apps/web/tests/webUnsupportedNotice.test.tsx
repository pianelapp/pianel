/**
 * Task 4.2 — tests for the unsupported-context notice UI.
 *
 * Verifies the actionable copy (Chromium-required / HTTPS-required) is produced
 * at the point of failure, that a fully-capable context renders nothing, and
 * that the notice is dismissible (never blocks the rest of the UI).
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  WebUnsupportedNotice,
  unsupportedNoticeContent,
} from '../src/host/WebUnsupportedNotice';

describe('unsupportedNoticeContent', () => {
  it('returns null when both Web MIDI and a secure context are available', () => {
    expect(
      unsupportedNoticeContent({ webMidiAvailable: true, secureContext: true }),
    ).toBeNull();
  });

  it('states a Chromium-based browser is required when Web MIDI is absent', () => {
    const content = unsupportedNoticeContent({
      webMidiAvailable: false,
      secureContext: true,
    });
    expect(content?.message).toMatch(/Chromium-based browser/i);
  });

  it('states a secure (HTTPS) context is required when the context is non-secure', () => {
    const content = unsupportedNoticeContent({
      webMidiAvailable: true,
      secureContext: false,
    });
    expect(content?.message).toMatch(/secure \(HTTPS\) context/i);
  });

  it('mentions both requirements when neither is satisfied', () => {
    const content = unsupportedNoticeContent({
      webMidiAvailable: false,
      secureContext: false,
    });
    expect(content?.message).toMatch(/Chromium-based browser/i);
    expect(content?.message).toMatch(/HTTPS/i);
  });
});

describe('WebUnsupportedNotice', () => {
  it('renders nothing when the context is fully capable', () => {
    const { container } = render(
      <WebUnsupportedNotice capabilities={{ webMidiAvailable: true, secureContext: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an actionable notice and can be dismissed', () => {
    render(
      <WebUnsupportedNotice
        capabilities={{ webMidiAvailable: false, secureContext: true }}
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Dismiss notice'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
