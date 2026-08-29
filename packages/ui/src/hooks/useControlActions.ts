import {useEffect} from 'react';
import {getControlActionRegistry} from '@pianel/core/services/control/registry';
import type {ControlAction} from '@pianel/core/types/control';

export function useRegisterControlActions(
  actions: readonly ControlAction[],
): void {
  useEffect(() => {
    const registry = getControlActionRegistry();
    const offs = actions.map(action => registry.register(action));
    return () => {
      for (const off of offs) off();
    };
  }, [actions]);
}
