export interface InputCandidate {
  id: string;
  name: string | null;
}

export type InputMatchHow = 'exact' | 'prefix' | 'fallback';

export interface InputMatch<T> {
  port: T;
  how: InputMatchHow;
}

function normalise(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

export function matchInputPort<T extends InputCandidate>(
  inputs: readonly T[],
  outputName: string | null,
  excludeIds: readonly string[] = [],
): InputMatch<T> | null {
  const excluded = new Set(excludeIds);
  const candidates = inputs.filter(input => !excluded.has(input.id));
  if (candidates.length === 0) return null;

  const target = normalise(outputName);
  if (target.length > 0) {
    for (const port of candidates) {
      if (normalise(port.name) === target) return {port, how: 'exact'};
    }
    for (const port of candidates) {
      const candidate = normalise(port.name);
      if (candidate.length === 0) continue;
      if (candidate.startsWith(target) || target.startsWith(candidate)) {
        return {port, how: 'prefix'};
      }
    }
  }

  return {port: candidates[0], how: 'fallback'};
}
