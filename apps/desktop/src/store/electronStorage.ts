import type { StateStorage } from '@pianel/core/store/storage';

export const electronStorage: StateStorage = {
  getItem: (key) => window.electronStorageBridge.getItem(key),
  setItem: (key, value) => window.electronStorageBridge.setItem(key, value),
  removeItem: (key) => window.electronStorageBridge.removeItem(key),
};
