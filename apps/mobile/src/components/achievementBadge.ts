/**
 * The achievement badge's outline, as an SVG path.
 *
 * Ported from `design/claude_design/Achievement unlock.html`'s `blobPath` (WP25/
 * screen-11) — a plain circle reads as a status dot and a trophy icon alone is the one
 * glyph the whole catalogue already shares (`Icon.tsx`'s `achievement` entry), so
 * neither carries the weight of "a thing you were given". A blob is a shape nothing
 * else in the app draws, which is what makes it read as an object rather than an icon.
 *
 * **Deterministic, not random.** The source wobbles each vertex by
 * `Math.sin(i * 2.7 + cx)`, a function of the vertex index and the badge's own centre —
 * no seed, no `Math.random`. The same badge therefore draws the same outline on every
 * render and every re-mount, which matters here because the celebration re-runs its
 * entrance animation each time an unlock arrives.
 */
export function badgeBlobPath(cx: number, cy: number, radius: number, wobble = 0.16): string {
  const points = 8;
  const step = (Math.PI * 2) / points;

  const vertices = Array.from({ length: points }, (_, index) => {
    const angle = index * step;
    const wobbled = radius * (1 + Math.sin(index * 2.7 + cx) * wobble);

    return [cx + Math.cos(angle) * wobbled, cy + Math.sin(angle) * wobbled] as const;
  });

  // Falls back to the centre only if `points` were ever 0 — never true for the constant
  // above, but `noUncheckedIndexedAccess` cannot see that.
  const [startX, startY] = vertices[0] ?? [cx, cy];

  const segments = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % points];

    if (next === undefined) {
      // Unreachable: `(index + 1) % points` is always a valid index into `vertices`.
      throw new Error('badgeBlobPath: unreachable vertex index');
    }

    const [x1, y1] = vertex;
    const [x2, y2] = next;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return `Q ${x1.toFixed(1)} ${y1.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  });

  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} ${segments.join(' ')} Z`;
}
