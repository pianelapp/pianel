/**
 * Task 8.3 — tests for the controlled service-worker update path.
 *
 * Verifies the prompt-based update flow:
 *  - registration installs an `onNeedRefresh` handler;
 *  - when a new version is detected, an actionable update prompt is surfaced via
 *    the shared alert UI;
 *  - accepting applies the update atomically by calling `updateSW(true)`
 *    (skip-waiting + reload), while declining leaves the running version intact.
 */
import { showAlert } from '@pianel/ui/components/modals/AlertModal';
import { registerPwa } from '../src/host/registerPwa';
import { updateSWMock, lastOptions, __reset } from './__mocks__/pwaRegister';

jest.mock('@pianel/ui/components/modals/AlertModal', () => ({
  __esModule: true,
  showAlert: jest.fn(),
}));

const showAlertMock = showAlert as jest.MockedFunction<typeof showAlert>;

beforeEach(() => {
  __reset();
  showAlertMock.mockReset();
});

describe('registerPwa (controlled update path)', () => {
  it('registers an onNeedRefresh handler', () => {
    registerPwa();
    expect(lastOptions).toBeDefined();
    expect(typeof lastOptions?.onNeedRefresh).toBe('function');
  });

  it('surfaces an actionable update prompt and applies the update atomically on accept', async () => {
    showAlertMock.mockResolvedValueOnce(true);
    registerPwa();

    lastOptions?.onNeedRefresh?.();
    // Allow the prompt promise chain to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(showAlertMock).toHaveBeenCalledTimes(1);
    const opts = showAlertMock.mock.calls[0][0];
    expect(opts.title).toMatch(/update/i);
    expect(opts.confirmLabel).toBeDefined();
    expect(opts.cancelLabel).toBeDefined();

    expect(updateSWMock).toHaveBeenCalledWith(true);
  });

  it('does not apply the update when the user declines', async () => {
    showAlertMock.mockResolvedValueOnce(false);
    registerPwa();

    lastOptions?.onNeedRefresh?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(showAlertMock).toHaveBeenCalledTimes(1);
    expect(updateSWMock).not.toHaveBeenCalled();
  });
});
