"""Generate a synaptic / knowledge-graph layout as SVG.

The brief: mindmap, knowledge tree, neurons connecting. A botanical tree reads
childish because it is a SILHOUETTE — thick limbs, a solid shape. A neural graph
reads adult because it is a NETWORK — fine edges, precise nodes, depth by density.

Three layers, back to front:
  1. `web`      — faint background nodes and edges: knowledge not yet reached
  2. `dendrite` — fine tapering offshoots from each Leaf node, like a neuron's
  3. `spine`    — the sequential path through the Leaves, the thing you navigate
"""

import math
import random


def spine(seed, *, n, top, bottom, cx, amp):
    """Sequential Leaf positions: a meander, not a straight line or a zigzag."""
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        t = i / (n - 1)
        y = bottom + (top - bottom) * t
        # Two out-of-phase sines keep it from reading as a regular wave.
        x = cx + math.sin(t * math.pi * 2.1 + 0.6) * amp + math.sin(t * math.pi * 3.7) * amp * 0.32
        x += rnd.uniform(-6, 6)
        pts.append((round(x, 1), round(y, 1)))
    return pts


def smooth(pts, tension=0.34):
    """A Catmull-Rom-ish cubic through the points — no visible corners."""
    if len(pts) < 2:
        return ""
    d = [f"M{pts[0][0]} {pts[0][1]}"]
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension)
        d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]} {p2[1]}")
    return " ".join(d)


def dendrites(seed, origin, *, count, length, depth, spread, base_angle):
    """Fine tapering offshoots from a node. Strokes, not fills — these are threads."""
    rnd = random.Random(seed)
    out = []

    def grow(x, y, ang, ln, w, d):
        bend = rnd.uniform(-0.22, 0.22)
        x1 = x + math.cos(ang + bend) * ln
        y1 = y - math.sin(ang + bend) * ln
        cx = x + math.cos(ang + bend * 0.4) * ln * 0.55
        cy = y - math.sin(ang + bend * 0.4) * ln * 0.55
        out.append((f"M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {x1:.1f} {y1:.1f}", round(w, 2), d, (x1, y1)))
        if d >= depth:
            return
        for k in range(2):
            a = ang + (-1 if k == 0 else 1) * math.radians(rnd.uniform(spread * 0.5, spread * 1.4))
            grow(x1, y1, a, ln * rnd.uniform(0.58, 0.74), w * 0.68, d + 1)

    for i in range(count):
        a = math.radians(base_angle + rnd.uniform(-62, 62))
        grow(origin[0], origin[1], a, length * rnd.uniform(0.7, 1.15), 1.5, 1)
    return out


def web(seed, *, w, h, n, avoid, avoid_r=54):
    """Background node cloud plus its short edges — the unexplored graph."""
    rnd = random.Random(seed)
    nodes = []
    tries = 0
    while len(nodes) < n and tries < n * 60:
        tries += 1
        p = (rnd.uniform(10, w - 10), rnd.uniform(10, h - 10))
        if any(math.dist(p, a) < avoid_r for a in avoid):
            continue
        if any(math.dist(p, q) < 30 for q in nodes):
            continue
        nodes.append(p)
    edges = []
    for i, a in enumerate(nodes):
        near = sorted(((math.dist(a, b), j) for j, b in enumerate(nodes) if j != i))[:2]
        for dist, j in near:
            if dist < 96 and (j, i) not in edges:
                edges.append((i, j))
    return nodes, edges
