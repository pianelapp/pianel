export interface StateStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export const inMemoryStorage: StateStorage = (() => {
  const map: Record<string, string> = {};
  return {
    getItem: (k) => map[k] ?? null,
    setItem: (k, v) => { map[k] = v; },
    removeItem: (k) => { delete map[k]; },
  };
})();
