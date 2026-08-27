import {controlWorld, makeAction} from '../../fixtures/controlSurface';
import {useControlBindingsStore} from '../../../src/store/controlBindingsStore';
import {useControlSurfaceStore} from '../../../src/store/controlSurfaceStore';

describe('ControlSurfaceService attaching', () => {
  it('lists the transport devices', async () => {
    const {service} = controlWorld();
    await expect(service.listDevices()).resolves.toEqual([
      {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'},
    ]);
    await service.destroy();
  });

  it('remembers the device it attached and reflects it in the store', async () => {
    const {service} = controlWorld();
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    expect(useControlBindingsStore.getState().device).toEqual({
      id: 'in-pedal',
      name: 'FootCtrlPlus Bluetooth',
    });
    expect(useControlSurfaceStore.getState().attached).toBe(true);
    expect(useControlSurfaceStore.getState().deviceName).toBe('FootCtrlPlus Bluetooth');
    await service.destroy();
  });

  it('reattaches the remembered device on restore', async () => {
    const {transport, service} = controlWorld();
    useControlBindingsStore.getState().setDevice({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await service.restore();

    expect(transport.connectCalls).toEqual([
      {deviceId: 'in-pedal', deviceName: 'FootCtrlPlus Bluetooth'},
    ]);
    await service.destroy();
  });

  it('does nothing on restore when no device was ever chosen', async () => {
    const {transport, service} = controlWorld();
    await service.restore();
    expect(transport.connectCalls).toEqual([]);
    await service.destroy();
  });

  it('forgets the device on detach', async () => {
    const {service} = controlWorld();
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await service.detach();

    expect(useControlBindingsStore.getState().device).toBeNull();
    expect(useControlSurfaceStore.getState().attached).toBe(false);
    await service.destroy();
  });

  it('tracks the transport losing and regaining the pedal', async () => {
    const {transport, service} = controlWorld();
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    transport.setStatus('connecting');
    await service.whenIdle();
    expect(useControlSurfaceStore.getState().attached).toBe(false);

    transport.setStatus('connected');
    await service.whenIdle();
    expect(useControlSurfaceStore.getState().attached).toBe(true);
    await service.destroy();
  });
});

describe('ControlSurfaceService dispatch', () => {
  it('runs a press-bound action on the press edge and not on the release', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    const action = makeAction('piano.toggleMetronome', {behaviours: ['press']});
    registry.register(action);
    bind('piano.toggleMetronome', 'press');

    await press();
    expect(action.run).toHaveBeenCalledTimes(1);

    await release();
    expect(action.run).toHaveBeenCalledTimes(1);
    await service.destroy();
  });

  it('runs a release-bound action on the release edge, not the press', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    const action = makeAction('perform.nextScene');
    registry.register(action);
    bind('perform.nextScene', 'release');

    await press();
    expect(action.run).not.toHaveBeenCalled();

    await release();
    expect(action.run).toHaveBeenCalledTimes(1);
    await service.destroy();
  });

  it('marks a release-bound switch as held while it is down', async () => {
    const {registry, service, bind, press, release} = controlWorld();
    registry.register(makeAction('perform.nextScene'));
    bind('perform.nextScene', 'release');

    await press();
    expect(useControlSurfaceStore.getState().held).toEqual({
      actionId: 'perform.nextScene',
      behaviour: 'release',
    });

    await release();
    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('ignores a message with no binding', async () => {
    const {registry, service, press} = controlWorld();
    const action = makeAction('perform.nextScene');
    registry.register(action);

    await press();

    expect(action.run).not.toHaveBeenCalled();
    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('ignores a binding whose action nobody registered', async () => {
    const {service, bind, press, release} = controlWorld();
    bind('perform.somethingRenamed', 'release');

    await press();
    await release();

    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('swallows an action that throws rather than wedging the pedal', async () => {
    const {registry, service, bind, press, release, tick} = controlWorld();
    const action = makeAction('perform.nextScene', {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    });
    registry.register(action);
    bind('perform.nextScene', 'release');

    await press();
    await release();
    expect(useControlSurfaceStore.getState().held).toBeNull();

    tick(500);
    await press();
    await release();
    expect(action.run).toHaveBeenCalledTimes(2);
    await service.destroy();
  });

  it('records every parsed message for the monitor line', async () => {
    const {transport, service, tick} = controlWorld();

    tick(1234);
    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().lastMessage).toEqual({
      type: 'cc',
      channel: 1,
      id: 20,
      value: 127,
    });
    expect(useControlSurfaceStore.getState().lastMessageAt).toBe(1234);
    await service.destroy();
  });

  it('discards clock and active sensing before anything else sees them', async () => {
    const {registry, service, bind, transport} = controlWorld();
    const action = makeAction('perform.nextScene', {behaviours: ['press']});
    registry.register(action);
    bind('perform.nextScene', 'press');

    transport.emit([0xf8]);
    transport.emit([0xfe]);
    await service.whenIdle();

    expect(action.run).not.toHaveBeenCalled();
    expect(useControlSurfaceStore.getState().lastMessage).toBeNull();
    await service.destroy();
  });

  it('debounces a repeated press but never the release between them', async () => {
    const {registry, service, bind, press, release, tick} = controlWorld({debounceMs: 150});
    const action = makeAction('perform.nextScene');
    registry.register(action);
    bind('perform.nextScene', 'release');

    await press();
    tick(50);
    await release();
    expect(action.run).toHaveBeenCalledTimes(1);

    tick(50);
    await press();
    tick(50);
    await release();
    expect(action.run).toHaveBeenCalledTimes(1);
    await service.destroy();
  });

  it('fires immediately rather than holding a control that cannot release', async () => {
    const {registry, service, transport} = controlWorld();
    const action = makeAction('perform.nextScene');
    registry.register(action);
    useControlBindingsStore.setState({
      bindings: [
        {
          id: 'hand-edited',
          match: {type: 'pc', channel: 1, id: 5},
          actionId: 'perform.nextScene',
          behaviour: 'release',
        },
      ],
    });

    transport.emit([0xc0, 0x05]);
    await service.whenIdle();

    expect(action.run).toHaveBeenCalledTimes(1);
    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('drops a held switch when the pedal disappears', async () => {
    const {registry, service, transport, bind, press} = controlWorld();
    registry.register(makeAction('perform.nextScene'));
    bind('perform.nextScene', 'release');
    await service.attach({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    await press();
    expect(useControlSurfaceStore.getState().held).not.toBeNull();

    transport.setStatus('connecting');
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('stops listening once destroyed', async () => {
    const {registry, service, bind, transport} = controlWorld();
    const action = makeAction('perform.nextScene', {behaviours: ['press']});
    registry.register(action);
    bind('perform.nextScene', 'press');

    await service.destroy();
    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();

    expect(action.run).not.toHaveBeenCalled();
  });
});
