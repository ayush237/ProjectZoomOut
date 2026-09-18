import type { LeafNodeState } from '../track/roadmapModel';

/**
 * The graph the intro draws — fixed, not a reader's real progress.
 *
 * **Nobody has read anything yet.** The intro plays before sign-in, so there is no
 * Track and no reader state to draw from; `layoutRoadmap` is fed a synthetic fixture
 * instead of a real `RoadmapModel`. Fixed rather than randomised per install: the spec
 * requires the identical graph "on every install, every launch and every device", which
 * is what makes it safe to hand-tune camera framing (`introCamera.ts`) against one known
 * shape rather than an infinite family of them.
 *
 * **Twenty-two nodes, five done and one next, mirrors a real Track mid-read** rather
 * than an empty or finished one — variety in state is variety in the geometry (radius,
 * dendrite reach, the next cell's halo), and it doubles as an honest preview of the
 * screen these readers will land on. `INTRO_FOCUS_INDEX` points at the `next` cell:
 * biggest body, richest arbors, the natural single "neuron" for beat 1 to sit inside.
 *
 * **Twenty-two, not `PRODUCT.md`'s minimum of fifteen, so the zoom-out is real rather
 * than nominal.** `layoutRoadmap`'s width always equals the viewport's — only height can
 * make the fitted end-of-beat-4 scale (`introCamera.ts`'s `fitScale`) drop below 1 — and
 * `minStepForLabels` floors the per-node step at roughly 39–40pt regardless of count. At
 * eighteen nodes the graph is ≈780pt tall, which *fits inside* most current iPhones at
 * scale 1 — "zoom out" would be a no-op on exactly the devices this ships to. Twenty-two
 * nodes is ≈940pt, taller than even a Pro Max, so `end.scale` is genuinely below 1 on
 * real hardware — see `introCamera.test.ts`'s own check of this.
 */
export const INTRO_STATES: readonly LeafNodeState[] = [
  'done',
  'done',
  'done',
  'done',
  'done',
  'next',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
  'locked',
];

/** The `next` cell — index 5, the sixth node. Beat 1's subject. */
export const INTRO_FOCUS_INDEX = 5;

/**
 * `seedFromTrackId` folds a string into this space, but the intro has no Track id — a
 * literal is the fixture, chosen by rendering candidates side by side (see the
 * completion report for which ones and why this one won).
 */
export const INTRO_SEED = 8_675_309;
