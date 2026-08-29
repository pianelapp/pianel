import {
  claimPort,
  releasePort,
  releaseRole,
  portRole,
  claimedPortIds,
  resetPortClaims,
} from '../../src/transport/portClaims';

beforeEach(() => {
  resetPortClaims();
});

describe('portClaims', () => {
  it('starts with nothing claimed', () => {
    expect(portRole('in-piano')).toBeNull();
    expect(claimedPortIds('piano')).toEqual([]);
    expect(claimedPortIds('control')).toEqual([]);
  });

  it('records a claim and reports it by role', () => {
    claimPort('in-piano', 'piano');
    claimPort('in-pedal', 'control');

    expect(portRole('in-piano')).toBe('piano');
    expect(portRole('in-pedal')).toBe('control');
    expect(claimedPortIds('piano')).toEqual(['in-piano']);
    expect(claimedPortIds('control')).toEqual(['in-pedal']);
  });

  it('releases one port without touching the others', () => {
    claimPort('in-piano', 'piano');
    claimPort('in-pedal', 'control');

    releasePort('in-piano');

    expect(portRole('in-piano')).toBeNull();
    expect(portRole('in-pedal')).toBe('control');
  });

  it('releases every port held by a role', () => {
    claimPort('in-piano', 'piano');
    claimPort('in-piano-2', 'piano');
    claimPort('in-pedal', 'control');

    releaseRole('piano');

    expect(claimedPortIds('piano')).toEqual([]);
    expect(claimedPortIds('control')).toEqual(['in-pedal']);
  });

  it('lets a re-claim move a port to the other role', () => {
    claimPort('in-shared', 'piano');
    claimPort('in-shared', 'control');

    expect(portRole('in-shared')).toBe('control');
    expect(claimedPortIds('piano')).toEqual([]);
  });

  it('is idempotent', () => {
    claimPort('in-pedal', 'control');
    claimPort('in-pedal', 'control');
    expect(claimedPortIds('control')).toEqual(['in-pedal']);
  });
});
