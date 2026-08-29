import {useCallback, useSyncExternalStore} from 'react';
import {getControlActionRegistry} from '@pianel/core/services/control/registry';
import {useControlBindingsStore, useControlSurfaceStore} from '../store';
import type {ControlSurfaceService} from '@pianel/core/services/control/ControlSurfaceService';
import type {DiscoveredDevice} from '@pianel/core/transport/types';
import type {Behaviour, ControlAction, ControlDevice} from '../store';

let controlSurfaceService: ControlSurfaceService | null = null;

export function setControlSurfaceService(service: ControlSurfaceService): void {
  controlSurfaceService = service;
}

export function getControlSurfaceService(): ControlSurfaceService | null {
  return controlSurfaceService;
}

export function resetControlSurfaceService(): void {
  controlSurfaceService = null;
}

function subscribeToRegistry(listener: () => void): () => void {
  return getControlActionRegistry().subscribe(listener);
}

function registrySnapshot(): readonly ControlAction[] {
  return getControlActionRegistry().snapshot();
}

export function useControlSurface() {
  const attached = useControlSurfaceStore(s => s.attached);
  const deviceName = useControlSurfaceStore(s => s.deviceName);
  const held = useControlSurfaceStore(s => s.held);
  const lastMessage = useControlSurfaceStore(s => s.lastMessage);
  const lastMessageAt = useControlSurfaceStore(s => s.lastMessageAt);
  const learn = useControlSurfaceStore(s => s.learn);

  const bindings = useControlBindingsStore(s => s.bindings);
  const device = useControlBindingsStore(s => s.device);

  const actions = useSyncExternalStore(
    subscribeToRegistry,
    registrySnapshot,
    registrySnapshot,
  );

  const known = new Set(actions.map(a => a.id));
  const orphanBindings = bindings.filter(b => !known.has(b.actionId));

  const listDevices = useCallback(async (): Promise<DiscoveredDevice[]> => {
    const service = getControlSurfaceService();
    if (!service) return [];
    return service.listDevices();
  }, []);

  const attachDevice = useCallback(async (target: ControlDevice): Promise<void> => {
    await getControlSurfaceService()?.attach(target);
  }, []);

  const detachDevice = useCallback(async (): Promise<void> => {
    await getControlSurfaceService()?.detach();
  }, []);

  const startLearn = useCallback((actionId: string): void => {
    getControlSurfaceService()?.startLearn(actionId);
  }, []);

  const cancelLearn = useCallback((): void => {
    getControlSurfaceService()?.cancelLearn();
  }, []);

  const acceptConflict = useCallback((): void => {
    getControlSurfaceService()?.acceptConflict();
  }, []);

  const confirmLearn = useCallback((behaviour: Behaviour): void => {
    getControlSurfaceService()?.confirmLearn(behaviour);
  }, []);

  const removeBinding = useCallback((bindingId: string): void => {
    useControlBindingsStore.getState().removeBinding(bindingId);
  }, []);

  return {
    attached,
    deviceName,
    device,
    held,
    lastMessage,
    lastMessageAt,
    learn,
    actions,
    bindings,
    orphanBindings,
    listDevices,
    attachDevice,
    detachDevice,
    startLearn,
    cancelLearn,
    acceptConflict,
    confirmLearn,
    removeBinding,
  };
}
