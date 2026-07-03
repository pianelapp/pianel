/**
 * T004 — profileId helper unit tests (R1, FR-013).
 *
 * Assertions:
 *  - Matches the documented pattern `^\d+-[a-z0-9]{8,}$`.
 *  - Leading `Date.now()` prefix is monotonic non-decreasing across calls.
 *  - 10,000 consecutive calls return unique strings (no collisions).
 */

import {generateProfileId, PROFILE_ID_PATTERN} from '../../src/helpers/profileId';

describe('generateProfileId', () => {
  it('matches the documented pattern', () => {
    for (let i = 0; i < 100; i += 1) {
      const id = generateProfileId();
      expect(id).toMatch(PROFILE_ID_PATTERN);
    }
  });

  it('leading timestamp prefix is monotonic non-decreasing', () => {
    let prev = 0;
    for (let i = 0; i < 100; i += 1) {
      const id = generateProfileId();
      const ts = Number(id.split('-')[0]);
      expect(ts).toBeGreaterThanOrEqual(prev);
      prev = ts;
    }
  });

  it('10,000 consecutive calls produce unique IDs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      seen.add(generateProfileId());
    }
    expect(seen.size).toBe(10_000);
  });
});
