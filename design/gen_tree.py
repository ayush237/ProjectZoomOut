"""Generate a naturalistic tree as SVG paths.

Hand-drawn strokes read as childish for three reasons this fixes:
  1. constant stroke width -> real branches TAPER along their length
  2. round line caps -> lollipop ends; real tips come to a point
  3. shallow, symmetric branching -> real trees subdivide recursively and unevenly

Each branch is emitted as a filled, tapered, curved quad rather than a stroke.
Deterministic seed so the shape is reproducible and reviewable.
"""

import math
import random

def tree(seed, *, base, trunk_len, trunk_w, depth, spread, len_ratio, w_ratio, curve, jitter):
    rnd = random.Random(seed)
    branches = []   # (x0, y0, x1, y1, w0, w1, depth)
    tips = []       # (x, y, depth)

    def grow(x, y, angle, length, width, d):
        # Branches bend toward the light: a small consistent curve, jittered.
        bend = rnd.uniform(-curve, curve)
        mid_a = angle + bend * 0.5
        x1 = x + math.cos(angle + bend) * length
        y1 = y - math.sin(angle + bend) * length
        cx = x + math.cos(mid_a) * length * 0.5
        cy = y - math.sin(mid_a) * length * 0.5
        w1 = width * w_ratio
        branches.append((x, y, x1, y1, cx, cy, width, w1, d))

        if d >= depth:
            tips.append((x1, y1, d))
            return

        # Two or three children, unevenly split. Asymmetry is what kills the
        # "cartoon" read more than any other single parameter.
        n = 3 if (d <= 2 and rnd.random() < 0.45) else 2
        used = []
        for i in range(n):
            side = -1 if i % 2 == 0 else 1
            if n == 3 and i == 2:
                side = rnd.choice([-1, 1])
            a = angle + side * math.radians(rnd.uniform(spread * 0.55, spread * 1.35))
            a += math.radians(rnd.uniform(-jitter, jitter))
            # Length varies per child; a dominant leader keeps it looking grown
            # rather than assembled.
            lead = 1.0 if i == 0 else rnd.uniform(0.62, 0.9)
            used.append((a, length * len_ratio * lead, w1 * rnd.uniform(0.86, 1.0)))
        for a, l, w in used:
            grow(x1, y1, a, l, w, d + 1)

    grow(base[0], base[1], math.radians(90), trunk_len, trunk_w, 1)
    return branches, tips


def branch_path(x0, y0, x1, y1, cx, cy, w0, w1):
    """A tapered, curved branch as a closed filled path."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    px, py = -dy / ln, dx / ln          # unit perpendicular
    h0, h1 = w0 / 2, w1 / 2
    hm = (h0 + h1) / 2
    return (
        f"M{x0 + px * h0:.1f} {y0 + py * h0:.1f} "
        f"Q{cx + px * hm:.1f} {cy + py * hm:.1f} {x1 + px * h1:.1f} {y1 + py * h1:.1f} "
        f"L{x1 - px * h1:.1f} {y1 - py * h1:.1f} "
        f"Q{cx - px * hm:.1f} {cy - py * hm:.1f} {x0 - px * h0:.1f} {y0 - py * h0:.1f} Z"
    )


def render(branches, colour_fn):
    out = []
    for (x0, y0, x1, y1, cx, cy, w0, w1, d) in sorted(branches, key=lambda b: -b[8]):
        out.append(f'<path d="{branch_path(x0, y0, x1, y1, cx, cy, w0, w1)}" fill="{colour_fn(d)}"/>')
    return "\n".join(out)
