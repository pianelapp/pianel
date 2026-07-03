/**
 * Web persistent `StateStorage` adapter (Task 2.2).
 *
 * Replaces the Electron `electronStorage` bridge with a browser-native,
 * IndexedDB-backed implementation that satisfies the existing
 * `@pianel/core` `StateStorage` contract verbatim — no interface change in core.
 *
 * - Primary substrate: IndexedDB (durable, PWA-recommended) via `idb-keyval`.
 * - Fallback substrate: `localStorage`, used when IndexedDB is unavailable
 *   (e.g. private-browsing modes that block it).
 * - Keys and values are opaque strings identical to those the core store
 *   factories serialize (no key remapping, no payload transformation).
 * - On a write failure (quota exceeded / storage blocked) it surfaces a
 *   non-fatal error via `onWriteError` and keeps in-memory state usable
 *   instead of throwing into the caller.
 */
import {
  get as idbGet,
  set as idbSet,
  del as idbDel,
  createStore,
  type UseStore,
} from 'idb-keyval';
import type { StateStorage } from '@pianel/core/store/storage';

export interface IndexedDbStorageOptions {
  /** IndexedDB database name. Default: "pianel". */
  dbName?: string;
  /** IndexedDB object-store name. Default: "kv". */
  storeName?: string;
  /**
   * Non-fatal write-error surface. Invoked (instead of throwing) when a
   * `setItem`/`removeItem` write fails on both the primary and fallback
   * substrates.
   */
  onWriteError?: (key: string, error: unknown) => void;
  /**
   * Test/override seam for primary-substrate availability. Defaults to a real
   * feature-detect of `indexedDB` on the global scope.
   */
  isIndexedDbAvailable?: () => boolean;
}

function defaultIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function createIndexedDbStorage(
  options: IndexedDbStorageOptions = {},
): StateStorage {
  const {
    dbName = 'pianel',
    storeName = 'kv',
    onWriteError,
    isIndexedDbAvailable = defaultIndexedDbAvailable,
  } = options;

  const useIdb = isIndexedDbAvailable();
  // Only create the idb store when IndexedDB is actually available, so the
  // fallback path never touches the unavailable API.
  const idbStore: UseStore | undefined = useIdb
    ? createStore(dbName, storeName)
    : undefined;

  const getItem = async (key: string): Promise<string | null> => {
    if (idbStore) {
      try {
        const value = await idbGet<string>(key, idbStore);
        return value ?? null;
      } catch {
        // Fall through to localStorage on a read error.
      }
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const setItem = async (key: string, value: string): Promise<void> => {
    if (idbStore) {
      try {
        await idbSet(key, value, idbStore);
        return;
      } catch (error) {
        // Surface and stop — do not silently double-write to localStorage.
        onWriteError?.(key, error);
        return;
      }
    }
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      onWriteError?.(key, error);
    }
  };

  const removeItem = async (key: string): Promise<void> => {
    if (idbStore) {
      try {
        await idbDel(key, idbStore);
        return;
      } catch (error) {
        onWriteError?.(key, error);
        return;
      }
    }
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      onWriteError?.(key, error);
    }
  };

  return { getItem, setItem, removeItem };
}
