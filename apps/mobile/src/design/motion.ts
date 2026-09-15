import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * Motion, from `design-direction.md` §6.
 *
 * "Playfulness lives here. This is the budget line that should not get cut." Spring
 * physics rather than linear easing — linear reads as corporate and kills the register
 * instantly — with a slight overshoot reserved for reward moments.
 *
 * WP6 ships the constants and the reduced-motion rule. The payoff unlock, which §6
 * calls the signature moment of the product, is WP8's and will be built on these.
 */

export const duration = {
  /** Taps, toggles, state flips. */
  micro: 150,
  /** Screen and layout transitions. */
  standard: 280,
  /** Achievement, session wrap. WP9. */
  celebration: 900,
} as const;

/**
 * Spring configurations, in Reanimated's parameter shape.
 *
 * `reward` is the only one that overshoots. Overshoot on an ordinary button press
 * reads as sloppy rather than lively — it earns its place when something has been won.
 */
export const spring = {
  /** Buttons, toggles: settles fast, no visible bounce. */
  snappy: { damping: 20, stiffness: 300, mass: 1 },
  /** Screen transitions and reveals. */
  standard: { damping: 18, stiffness: 180, mass: 1 },
  /** Rewards only — deliberately underdamped. */
  reward: { damping: 10, stiffness: 200, mass: 1 },
} as const;

/**
 * Whether the reader has asked the OS to reduce motion.
 *
 * The rule (§6) is **swap, never remove**: a reduced-motion reader gets an opacity
 * fade, not a silent instant state change. Removing the feedback entirely is the
 * common mistake and it is worse than the animation — it leaves someone who needs the
 * accommodation with no confirmation that their tap registered.
 *
 * Defaults to `false` and corrects itself on mount, so a slow accessibility query
 * cannot block first paint.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduced(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * The animation a component should run, given the reader's preference.
 *
 * Returning a described intent rather than a boolean keeps the branch in one place:
 * a caller animates `transform` when told to `spring` and `opacity` when told to
 * `fade`, and neither branch is "do nothing".
 */
export interface MotionPlan {
  readonly kind: 'spring' | 'fade';
  readonly durationMs: number;
}

export function motionPlan(
  reducedMotion: boolean,
  durationMs: number = duration.standard,
): MotionPlan {
  return reducedMotion ? { kind: 'fade', durationMs } : { kind: 'spring', durationMs };
}

/**
 * Forces a Reanimated animation to run regardless of the OS reduce-motion setting.
 *
 * This looks like a contradiction — a reduced-motion accommodation that turns reduced
 * motion *off* — so it needs saying plainly: this disables **Reanimated's own**
 * suppression, not the reader's preference. Reanimated reads the OS setting itself,
 * independently of `motionPlan`, and by default silently skips the animation when it is
 * on. Applied to a `fade` plan, that cancels the very swap `motionPlan` returned it for —
 * turning the accommodation into the removal §6 forbids, with nothing failing and
 * nothing warning. `motionPlan` has already made the reduced-motion decision by the time
 * this runs; Reanimated must not make it a second time.
 *
 * Required at **every** nesting level of the animation, not only on `withTiming`'s own
 * config: `withRepeat`, `withDelay` and `withSequence` each resolve reduce-motion
 * independently and can suppress a correctly-configured child. Pass this to each of
 * their `reduceMotion` parameters, the same way `motionTimingConfig` below carries it
 * into `withTiming`'s.
 *
 * **WP28.1: required on the full-motion branch too, not only the fade.** WP28 found
 * that Reanimated's own reduce-motion reading is a **snapshot taken once at native
 * init**, while the OS setting the app itself sees (via `AccessibilityInfo`, through
 * `useReducedMotion` above) stays live for the life of the process. The two can
 * disagree for as long as the app keeps running, in either direction, whenever the
 * reader changes the setting without a full restart. `motionPlan`'s branch choice is
 * always correct — it reads the live value — but Reanimated's *separate* suppression
 * check is not, and it applies to whichever branch actually runs. When Reanimated's
 * stale snapshot still says reduce motion is on, an **unflagged full-motion**
 * animation is silenced exactly as an unflagged fade would be. There is no branch
 * this constant is safe to omit from.
 */
export const REDUCE_MOTION_OVERRIDE = ReduceMotion.Never;

/**
 * The Reanimated `withTiming` config for a `MotionPlan`.
 *
 * `motionPlan`'s companion: it is the abstraction's other half, and the reason the first
 * half went uncalled for a whole package (`motionPlan` was exported and dead from WP6
 * until WP22). Building the config here, once, is what makes the flag a property of the
 * mechanism instead of something every caller has to remember — see
 * `REDUCE_MOTION_OVERRIDE` for why the flag is required at all.
 */
export function motionTimingConfig(plan: MotionPlan): WithTimingConfig {
  return { duration: plan.durationMs, reduceMotion: REDUCE_MOTION_OVERRIDE };
}

/**
 * The Reanimated `withSpring` config for one of the `spring` presets above, always
 * carrying the override.
 *
 * `motionTimingConfig`'s counterpart for springs (WP28.1). A spring preset has no
 * `MotionPlan` to build from — reaching for `spring.reward` or `spring.snappy` at all
 * already means a caller has committed to the full-motion branch, so there is no
 * fade/spring choice left for this to make; it only needs to splice the override in.
 * Exists for the reason `motionTimingConfig` does: the flag belongs in one importable
 * place, not retyped at every call site — and every full-motion call site is exactly
 * where WP28 found it missing.
 */
export function motionSpringConfig(preset: (typeof spring)[keyof typeof spring]): WithSpringConfig {
  return { ...preset, reduceMotion: REDUCE_MOTION_OVERRIDE };
}
