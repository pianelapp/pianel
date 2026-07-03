// Initialize the shared domain stores against an in-memory substrate for tests.
import {inMemoryStorage} from '@pianel/core/store';
import {initStores} from '../../src/store';

let initialized = false;

export function initTestStores(): void {
  if (initialized) return;
  initStores(inMemoryStorage);
  initialized = true;
}
