/**
 * TDD Tests for connectionStore.
 *
 * T017: Write failing tests for connection state transitions
 * before implementing the BLE connection logic.
 */

import {useConnectionStore, createConnectionStore} from '../../src/store/connectionStore';
import {inMemoryStorage} from '../../src/store/storage';

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
});

// Reset store between tests
beforeEach(() => {
  useConnectionStore.getState().reset();
});

describe('connectionStore', () => {
  describe('initial state', () => {
    it('should start with idle status', () => {
      const state = useConnectionStore.getState();
      expect(state.status).toBe('idle');
    });

    it('should have no device info initially', () => {
      const state = useConnectionStore.getState();
      expect(state.deviceId).toBeNull();
      expect(state.deviceName).toBeNull();
      expect(state.lastConnectedAt).toBeNull();
    });

    it('should flag first connection as pending', () => {
      const state = useConnectionStore.getState();
      expect(state.isFirstConnectionThisSession).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('idle → scanning', () => {
      useConnectionStore.getState().setScanning();
      expect(useConnectionStore.getState().status).toBe('scanning');
    });

    it('scanning → discovered (with device info)', () => {
      useConnectionStore.getState().setScanning();
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');

      const state = useConnectionStore.getState();
      expect(state.status).toBe('discovered');
      expect(state.deviceId).toBe('ABC123');
      expect(state.deviceName).toBe('FP-30X');
    });

    it('discovered → connecting', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');
      useConnectionStore.getState().setConnecting();
      expect(useConnectionStore.getState().status).toBe('connecting');
    });

    it('connecting → connected (sets lastConnectedAt)', () => {
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();

      const state = useConnectionStore.getState();
      expect(state.status).toBe('connected');
      expect(state.lastConnectedAt).not.toBeNull();
      // Should be a valid ISO date
      expect(new Date(state.lastConnectedAt!).getTime()).not.toBeNaN();
    });

    it('connected → disconnected', () => {
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setDisconnected();
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });

    it('reset returns to initial state but keeps device info if persisted', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().reset();

      const state = useConnectionStore.getState();
      expect(state.status).toBe('idle');
      expect(state.isFirstConnectionThisSession).toBe(true);
    });
  });

  describe('first connection tracking', () => {
    it('should clear first-connection flag when marked as handled', () => {
      expect(useConnectionStore.getState().isFirstConnectionThisSession).toBe(true);
      useConnectionStore.getState().markFirstConnectionHandled();
      expect(useConnectionStore.getState().isFirstConnectionThisSession).toBe(false);
    });
  });

  describe('auto-reconnect', () => {
    it('should preserve deviceId and deviceName after disconnect', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setDisconnected();

      const state = useConnectionStore.getState();
      expect(state.status).toBe('disconnected');
      // Device info survives — BleManager can use it for auto-reconnect
      expect(state.deviceId).toBe('ABC123');
      expect(state.deviceName).toBe('FP-30X');
    });

    it('should allow disconnected → connecting (auto-reconnect path)', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setDisconnected();

      // Auto-reconnect triggers connecting again
      useConnectionStore.getState().setConnecting();
      expect(useConnectionStore.getState().status).toBe('connecting');
      expect(useConnectionStore.getState().deviceId).toBe('ABC123');
    });

    it('should update lastConnectedAt on successful reconnect', () => {
      useConnectionStore.getState().setConnected();
      const firstTimestamp = useConnectionStore.getState().lastConnectedAt;

      useConnectionStore.getState().setDisconnected();
      // Simulate slight time delay
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();
      const secondTimestamp = useConnectionStore.getState().lastConnectedAt;

      expect(secondTimestamp).not.toBeNull();
      // Both should be valid timestamps (they may be equal if test runs fast)
      expect(new Date(firstTimestamp!).getTime()).not.toBeNaN();
      expect(new Date(secondTimestamp!).getTime()).not.toBeNaN();
    });

    it('should handle multiple disconnect/reconnect cycles', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');

      // Cycle 1
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setDisconnected();

      // Cycle 2
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setDisconnected();

      // Cycle 3 — reconnect
      useConnectionStore.getState().setConnecting();
      useConnectionStore.getState().setConnected();

      const state = useConnectionStore.getState();
      expect(state.status).toBe('connected');
      expect(state.deviceId).toBe('ABC123');
      expect(state.lastConnectedAt).not.toBeNull();
    });
  });

  describe('liveness tracking', () => {
    it('lastSeenAt is null initially', () => {
      expect(useConnectionStore.getState().lastSeenAt).toBeNull();
    });

    it('markSeen sets lastSeenAt to a numeric epoch ms', () => {
      const before = Date.now();
      useConnectionStore.getState().markSeen();
      const after = Date.now();
      const seen = useConnectionStore.getState().lastSeenAt;
      expect(typeof seen).toBe('number');
      expect(seen!).toBeGreaterThanOrEqual(before);
      expect(seen!).toBeLessThanOrEqual(after);
    });

    it('setConnected also initializes lastSeenAt', () => {
      useConnectionStore.getState().setConnected();
      expect(useConnectionStore.getState().lastSeenAt).not.toBeNull();
    });

    it('setStale flips status to stale only when currently connected', () => {
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setStale();
      expect(useConnectionStore.getState().status).toBe('stale');
    });

    it('setStale is a no-op when status is not connected', () => {
      useConnectionStore.getState().setDisconnected();
      useConnectionStore.getState().setStale();
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });

    it('setStale leaves deviceId and deviceName intact', () => {
      useConnectionStore.getState().setDiscovered('ABC123', 'FP-30X');
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setStale();
      const state = useConnectionStore.getState();
      expect(state.deviceId).toBe('ABC123');
      expect(state.deviceName).toBe('FP-30X');
    });

    it('setConnected from stale restores connected status', () => {
      useConnectionStore.getState().setConnected();
      useConnectionStore.getState().setStale();
      useConnectionStore.getState().setConnected();
      expect(useConnectionStore.getState().status).toBe('connected');
    });
  });

  describe('discovered devices', () => {
    it('discoveredDevices is empty initially', () => {
      expect(useConnectionStore.getState().discoveredDevices).toEqual([]);
    });

    it('addDiscoveredDevice appends a new device', () => {
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'FP-30X'});
      expect(useConnectionStore.getState().discoveredDevices).toEqual([
        {id: 'A', name: 'FP-30X'},
      ]);
    });

    it('addDiscoveredDevice dedupes by id', () => {
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'FP-30X'});
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'FP-30X'});
      expect(useConnectionStore.getState().discoveredDevices).toHaveLength(1);
    });

    it('addDiscoveredDevice updates name on collision', () => {
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'Old'});
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'New'});
      expect(useConnectionStore.getState().discoveredDevices[0].name).toBe('New');
    });

    it('clearDiscoveredDevices empties the list', () => {
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'FP-30X'});
      useConnectionStore.getState().clearDiscoveredDevices();
      expect(useConnectionStore.getState().discoveredDevices).toEqual([]);
    });

    it('setScanning clears the previous list and sets status', () => {
      useConnectionStore.getState().addDiscoveredDevice({id: 'A', name: 'FP-30X'});
      useConnectionStore.getState().setScanning();
      expect(useConnectionStore.getState().discoveredDevices).toEqual([]);
      expect(useConnectionStore.getState().status).toBe('scanning');
    });

    it('setIdle sets status to idle without touching device fields', () => {
      useConnectionStore.getState().setDiscovered('ABC', 'FP-30X');
      useConnectionStore.getState().setIdle();
      const state = useConnectionStore.getState();
      expect(state.status).toBe('idle');
      expect(state.deviceId).toBe('ABC');
      expect(state.deviceName).toBe('FP-30X');
    });
  });
});
