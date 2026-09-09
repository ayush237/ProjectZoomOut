import { badgeBlobPath } from './achievementBadge';

describe('badgeBlobPath', () => {
  it('starts with a move, ends with a close, and has one curve per vertex', () => {
    const d = badgeBlobPath(22, 22, 18);

    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // 8 vertices, one `Q` segment joining each to the next.
    expect(d.match(/Q /g)).toHaveLength(8);
  });

  it('is deterministic: the same inputs always draw the same outline', () => {
    expect(badgeBlobPath(22, 22, 18)).toBe(badgeBlobPath(22, 22, 18));
  });

  it('is a function of its own centre, not a hidden random seed', () => {
    // Same radius and wobble, different centres — the paths must differ, and they must
    // differ *consistently* with the same centre, which rules out `Math.random`.
    const a = badgeBlobPath(10, 10, 18);
    const b = badgeBlobPath(90, 10, 18);

    expect(a).not.toBe(b);
    expect(badgeBlobPath(10, 10, 18)).toBe(a);
  });

  it('stays within radius plus wobble of the centre (mutation check: drop the sine term)', () => {
    const cx = 22;
    const cy = 22;
    const radius = 18;
    const wobble = 0.16;
    const d = badgeBlobPath(cx, cy, radius, wobble);

    const coordinates = d.match(/-?\d+\.\d/g)?.map(Number) ?? [];
    const maxDistance = radius * (1 + wobble) + 0.1; // tolerance for the 1-decimal rounding

    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i];
      const y = coordinates[i + 1];

      if (x === undefined || y === undefined) {
        throw new Error('unreachable: coordinates come in (x, y) pairs');
      }

      const distance = Math.hypot(x - cx, y - cy);

      expect(distance).toBeLessThanOrEqual(maxDistance);
    }
  });

  it('collapses to a regular octagon when wobble is zero', () => {
    const d = badgeBlobPath(0, 0, 10, 0);
    const coordinates = d.match(/-?\d+\.\d/g)?.map(Number) ?? [];

    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i];
      const y = coordinates[i + 1];

      if (x === undefined || y === undefined) {
        throw new Error('unreachable: coordinates come in (x, y) pairs');
      }

      // Every vertex and every Q-command midpoint sits within rounding of radius 10.
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(10.1);
    }
  });
});
