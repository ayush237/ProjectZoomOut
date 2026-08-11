import { duration, motionPlan, spring } from './motion';

/**
 * The motion primitives.
 *
 * Worth being precise about what this covers: **WP6 ships no animation**. The screens
 * are static, so there is nothing yet whose reduced-motion behaviour could be observed
 * on a device. What is tested here is the rule every future animation will branch on —
 * `motionPlan` — and specifically that reduced motion **swaps** the feedback rather
 * than removing it (`design-direction.md` §6). Removing it is the common mistake, and
 * it leaves a reader who needs the accommodation with no confirmation their tap landed.
 */

describe('motionPlan', () => {
  it('springs when motion is allowed', () => {
    expect(motionPlan(false)).toMatchObject({ kind: 'spring' });
  });

  it('fades rather than doing nothing when motion is reduced', () => {
    // The load-bearing assertion: there is no 'none' outcome, by construction.
    expect(motionPlan(true)).toMatchObject({ kind: 'fade' });
  });

  it('keeps a non-zero duration under reduced motion', () => {
    // A zero-duration fade is "removed" wearing a different name.
    expect(motionPlan(true).durationMs).toBeGreaterThan(0);
  });

  it('preserves the requested duration in both modes', () => {
    expect(motionPlan(false, duration.micro).durationMs).toBe(duration.micro);
    expect(motionPlan(true, duration.micro).durationMs).toBe(duration.micro);
  });
});

describe('the motion budget', () => {
  it('keeps micro interactions in the 120–180ms band', () => {
    expect(duration.micro).toBeGreaterThanOrEqual(120);
    expect(duration.micro).toBeLessThanOrEqual(180);
  });

  it('keeps standard transitions in the 240–320ms band', () => {
    expect(duration.standard).toBeGreaterThanOrEqual(240);
    expect(duration.standard).toBeLessThanOrEqual(320);
  });

  it('keeps celebrations in the 600–1200ms band', () => {
    expect(duration.celebration).toBeGreaterThanOrEqual(600);
    expect(duration.celebration).toBeLessThanOrEqual(1200);
  });

  it('overshoots only for rewards', () => {
    // Underdamped springs overshoot. On an ordinary button that reads as sloppy; it
    // earns its place when something has been won (§6).
    expect(spring.reward.damping).toBeLessThan(spring.snappy.damping);
    expect(spring.reward.damping).toBeLessThan(spring.standard.damping);
  });
});
