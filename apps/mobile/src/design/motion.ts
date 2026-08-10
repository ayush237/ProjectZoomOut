import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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

export function motionPlan(reducedMotion: boolean, durationMs: number = duration.standard): MotionPlan {
  return reducedMotion ? { kind: 'fade', durationMs } : { kind: 'spring', durationMs };
}
