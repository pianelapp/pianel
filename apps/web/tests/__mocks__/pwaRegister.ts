/**
 * Test stub for the `virtual:pwa-register` module provided by vite-plugin-pwa.
 *
 * Captures the registration options so tests can drive the `onNeedRefresh`
 * lifecycle hook, and records calls to the returned `updateSW` so tests can
 * assert the atomic-update path (`updateSW(true)`).
 */
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, r: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

export const updateSWMock = jest.fn(async (_reload?: boolean) => {});
export let lastOptions: RegisterSWOptions | undefined;

export function registerSW(options: RegisterSWOptions = {}) {
  lastOptions = options;
  return updateSWMock;
}

export function __reset() {
  updateSWMock.mockClear();
  lastOptions = undefined;
}
