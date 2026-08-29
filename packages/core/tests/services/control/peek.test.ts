import {controlWorld, makeAction} from '../../fixtures/controlSurface';
import {useControlSurfaceStore} from '../../../src/store/controlSurfaceStore';
import type {ControlAction, PeekHandle} from '../../../src/types/control';

function peekable(id = 'perform.nextScene') {
  const end = jest.fn().mockResolvedValue(undefined);
  const handle: PeekHandle = {end};
  const beginPeek = jest.fn().mockResolvedValue(handle);
  const action = makeAction(id, {beginPeek});
  return {action, beginPeek, end};
}

describe('ControlSurfaceService peek', () => {
  it('begins on press and ends on release', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    const {action, beginPeek, end} = peekable();
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();
    expect(beginPeek).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    expect(useControlSurfaceStore.getState().held).toEqual({
      actionId: 'perform.nextScene',
      behaviour: 'peek',
    });

    await release();
    expect(end).toHaveBeenCalledTimes(1);
    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('never calls run for a peek binding', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    const {action} = peekable();
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();
    await release();

    expect(action.run).not.toHaveBeenCalled();
    await service.destroy();
  });

  it('ignores a second peek while one is held', async () => {
    const {registry, service, bind, press} = controlWorld();
    const {action: next, beginPeek: beginNext} = peekable('perform.nextScene');
    const {action: prev, beginPeek: beginPrev} = peekable('perform.prevScene');
    registry.register(next);
    registry.register(prev);
    bind('perform.nextScene', 'peek', 20);
    bind('perform.prevScene', 'peek', 21);

    await press(20);
    await press(21);

    expect(beginNext).toHaveBeenCalledTimes(1);
    expect(beginPrev).not.toHaveBeenCalled();
    expect(useControlSurfaceStore.getState().held!.actionId).toBe('perform.nextScene');
    await service.destroy();
  });

  it('registers the hold even when the peek could not move anywhere', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    const {action, beginPeek} = peekable();
    const end = jest.fn().mockResolvedValue(undefined);
    beginPeek.mockResolvedValue({end});
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();
    expect(useControlSurfaceStore.getState().held).not.toBeNull();

    await release();
    expect(end).toHaveBeenCalledTimes(1);
    await service.destroy();
  });

  it('clears held when the action could not anchor', async () => {
    const {registry, service, bind, press} = controlWorld();
    const {action, beginPeek} = peekable();
    beginPeek.mockResolvedValue(null);
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();

    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('clears held when beginPeek throws', async () => {
    const {registry, service, bind, press, release, tick} = controlWorld();
    const {action, beginPeek} = peekable();
    beginPeek.mockRejectedValue(new Error('boom'));
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();
    expect(useControlSurfaceStore.getState().held).toBeNull();

    await release();
    tick(500);
    beginPeek.mockResolvedValue({end: jest.fn().mockResolvedValue(undefined)});
    await press();
    expect(useControlSurfaceStore.getState().held).not.toBeNull();
    await service.destroy();
  });

  it('clears held when an action declares peek but implements no beginPeek', async () => {
    const {registry, service, bind, press} = controlWorld();
    const action = makeAction('perform.nextScene');
    delete (action as Partial<ControlAction>).beginPeek;
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();

    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('ends the peek when the pedal disappears mid-hold', async () => {
    const {registry, service, transport, bind, press} = controlWorld();
    const {action, end} = peekable();
    registry.register(action);
    bind('perform.nextScene', 'peek');
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await press();
    transport.setStatus('connecting');
    await service.whenIdle();

    expect(end).toHaveBeenCalledTimes(1);
    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('ends the peek when the service is detached mid-hold', async () => {
    const {registry, service, bind, press} = controlWorld();
    const {action, end} = peekable();
    registry.register(action);
    bind('perform.nextScene', 'peek');
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await press();
    await service.detach();

    expect(end).toHaveBeenCalledTimes(1);
    await service.destroy();
  });

  it('survives an end that throws', async () => {
    const {registry, service, bind, press, release, tick} = controlWorld();
    const {action, end} = peekable();
    end.mockRejectedValue(new Error('cursor is gone'));
    registry.register(action);
    bind('perform.nextScene', 'peek');

    await press();
    await release();
    expect(useControlSurfaceStore.getState().held).toBeNull();

    tick(500);
    end.mockResolvedValue(undefined);
    await press();
    await release();
    expect(end).toHaveBeenCalledTimes(2);
    await service.destroy();
  });

  it('does not end a peek twice when disconnect follows release', async () => {
    const {registry, service, transport, bind, press, release} = controlWorld();
    const {action, end} = peekable();
    registry.register(action);
    bind('perform.nextScene', 'peek');
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await press();
    await release();
    transport.setStatus('connecting');
    await service.whenIdle();

    expect(end).toHaveBeenCalledTimes(1);
    await service.destroy();
  });
});
