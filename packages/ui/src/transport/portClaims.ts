export type PortRole = 'piano' | 'control';

const claims = new Map<string, PortRole>();

export function claimPort(portId: string, role: PortRole): void {
  claims.set(portId, role);
}

export function releasePort(portId: string): void {
  claims.delete(portId);
}

export function releaseRole(role: PortRole): void {
  for (const [portId, held] of [...claims]) {
    if (held === role) claims.delete(portId);
  }
}

export function portRole(portId: string): PortRole | null {
  return claims.get(portId) ?? null;
}

export function claimedPortIds(role: PortRole): string[] {
  return [...claims].filter(([, held]) => held === role).map(([portId]) => portId);
}

export function resetPortClaims(): void {
  claims.clear();
}
