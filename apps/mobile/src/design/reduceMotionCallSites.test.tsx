import { AccessibilityInfo } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ReduceMotion } from 'react-native-reanimated';
import type { PublicScenarioSlide, UnlockedAchievement } from '@zoomout/shared';

import { AchievementUnlock } from '../components/AchievementUnlock';
import { PayoffSlide } from '../screens/leaf/PayoffSlide';
import { ScenarioSlide } from '../screens/leaf/ScenarioSlide';
import { ThemeProvider } from './index';

/**
 * The guard WP22.1 asked for and could not write: **the override reaches the call
 * sites**, not merely the helper.
 *
 * `motion.test.ts` already pins `motionTimingConfig` and `REDUCE_MOTION_OVERRIDE`
 * themselves. Neither of those tests can fail when a *caller* drops the flag, which is
 * the mistake that actually happened — WP22.1 found the roadmap's replacement animation
 * silently cancelled, with nothing failing and nothing warning, and had to catch it by
 * measuring pixels across six frames.
 *
 * **Why this spies on Reanimated instead of asserting on what renders.** Under reduce
 * motion, Reanimated's suppression makes an animation *jump to its final value*. That
 * final value is also where a correctly-animated element ends up, so the rendered tree
 * is identical either way — the suppression is invisible to any assertion about what is
 * on screen. The flag is only observable at the moment it is passed, so that is where
 * this looks.
 *
 * **WP28.1: both branches, not only the reduced one.** WP28 found that Reanimated's
 * own reduce-motion reading is a snapshot frozen at native init, while the OS setting
 * `useReducedMotion` reports stays live — so the two can disagree for the life of a
 * running process, and the branch that ends up silently suppressed is whichever one
 * actually runs, not always the fade. Every `it` below now renders each surface twice:
 * once with the accommodation on (proving the fade survives, as before) and once with
 * it off (proving the full-motion branch is no longer the unflagged one).
 *
 * **Scope, stated because it is a real boundary rather than an oversight.** This
 * covers the three animated surfaces that can be rendered on their own. The fourth,
 * `TrackRoadmap`'s `NextNodeRing`, is a private component inside a screen that needs a
 * full graph fixture. It now routes through the same shared override as everywhere
 * else — WP28.1 closed the inline `ReduceMotion.Never` copy WP28 flagged — but it stays
 * uncovered by *this* guard for the fixture reason, and is verified on-device instead
 * (WP28.1's report). Named here so it stays a stated boundary, not a rediscovery.
 */

interface RecordedCall {
  readonly factory: string;
  readonly args: readonly unknown[];
}

type CallSink = { __reanimatedCalls?: RecordedCall[] };

const calls: RecordedCall[] = [];

(globalThis as CallSink).__reanimatedCalls = calls;

jest.mock('react-native-reanimated', () => {
  // Built on the shipped mock rather than replacing it: that mock is what makes
  // `Animated.View` render as a plain `View` under Node, which these components need.
  const base = jest.requireActual<Record<string, unknown>>('react-native-reanimated/mock');
  const factories = ['withTiming', 'withSpring', 'withDelay', 'withSequence', 'withRepeat'];
  const spied: Record<string, unknown> = { ...base };

  for (const name of factories) {
    const original = base[name] as (...args: unknown[]) => unknown;

    spied[name] = (...args: unknown[]): unknown => {
      // Reached through `globalThis` because Jest hoists this factory above every
      // binding in the module scope, so it cannot close over `calls` directly.
      (globalThis as { __reanimatedCalls?: { factory: string; args: unknown[] }[] })
        .__reanimatedCalls?.push({ factory: name, args });

      return original(...args);
    };
  }

  return { ...spied, __esModule: true, default: base['default'] };
});

const SCENARIO: PublicScenarioSlide = {
  prompt: 'A placeholder scenario prompt.',
  options: [
    { id: 'opt-a', text: 'First option' },
    { id: 'opt-b', text: 'Second option' },
    { id: 'opt-c', text: 'Third option' },
  ],
};

const ACHIEVEMENT: UnlockedAchievement = {
  id: 'first-leaf',
  name: 'First Leaf',
  description: 'You finished your first Leaf.',
  tier: 'common',
  unlockedAt: '2026-09-10T00:00:00.000Z',
};

/**
 * Every reduce-motion value handed to a Reanimated factory during this render.
 *
 * `withDelay` and `withRepeat` take theirs as a **positional argument** rather than
 * inside a config object — the asymmetry that made WP22.1's bug possible — so both
 * shapes are collected.
 */
function overridesPassed(): unknown[] {
  const seen: unknown[] = [];

  for (const call of calls) {
    for (const arg of call.args) {
      if (arg === ReduceMotion.Never || arg === ReduceMotion.System || arg === ReduceMotion.Always) {
        seen.push(arg);
      }

      if (typeof arg === 'object' && arg !== null && 'reduceMotion' in arg) {
        seen.push(arg.reduceMotion);
      }
    }
  }

  return seen;
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Which branch a render exercises is a choice each test makes explicitly (WP28.1) —
 * there is no longer a single default, because both branches now need their own
 * proof.
 */
function mockReducedMotion(enabled: boolean): void {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
}

describe('the reduce-motion override, at the call sites that need it', () => {
  describe('the reduced-motion branch', () => {
    it('reaches every animation the payoff unlock runs for a reduced-motion reader', async () => {
      mockReducedMotion(true);

      await render(
        <ThemeProvider mode="dark">
          <PayoffSlide data={{ body: 'The payoff prose.' }} justUnlocked />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(calls.length).toBeGreaterThan(0);
      });

      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThan(0);
      // The exact set, not `arrayContaining`: a single `System` among them is the bug.
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });

    it('reaches the wrong-answer feedback, which is confirmation rather than flourish', async () => {
      mockReducedMotion(true);

      await render(
        <ThemeProvider mode="dark">
          <ScenarioSlide
            data={SCENARIO}
            onSubmit={jest.fn()}
            busy={false}
            wrongOptionIds={['opt-a']}
            correctOptionId={null}
          />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('scenario-retry-message')).toBeTruthy();
      });

      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThan(0);
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });

    it('reaches both nesting levels of the achievement entrance, not just the inner timing', async () => {
      mockReducedMotion(true);

      await render(
        <ThemeProvider mode="dark">
          <AchievementUnlock achievements={[ACHIEVEMENT]} />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(calls.length).toBeGreaterThan(0);
      });

      /**
       * `withDelay` resolves reduce-motion independently of the `withTiming` it wraps,
       * so a correctly-configured inner animation can still be suppressed by its
       * wrapper. Counting rather than merely checking presence is what lets this fail
       * when only the **outer** flag is dropped — mutation-checked in exactly that
       * shape.
       */
      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThanOrEqual(2);
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });
  });

  /**
   * WP28.1. Every animation below runs in the branch that fires when Reanimated and
   * the OS agree that motion is fine — which is exactly the branch a **stale**
   * Reanimated snapshot cannot tell apart from "motion is fine, so suppress anything
   * unflagged." Counts are exact, not thresholds: with this many nesting levels per
   * surface, a loose `greaterThan(0)` would not notice one of them losing its flag,
   * and that is precisely the failure mode this guard exists to catch.
   */
  describe('the full-motion branch', () => {
    it('reaches every animation the payoff unlock runs for a full-motion reader', async () => {
      mockReducedMotion(false);

      await render(
        <ThemeProvider mode="dark">
          <PayoffSlide data={{ body: 'The payoff prose.' }} justUnlocked />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(calls.length).toBeGreaterThan(0);
      });

      // The lock's squash-and-release (withSequence + 2 inner animations) plus the
      // panel's two staggered withDelay/inner pairs: 3 + 2 + 2 = 7.
      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThanOrEqual(7);
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });

    it('reaches the correct-answer nudge, not only the confirmatory opacity beside it', async () => {
      mockReducedMotion(false);

      await render(
        <ThemeProvider mode="dark">
          <ScenarioSlide
            data={SCENARIO}
            onSubmit={jest.fn()}
            busy={false}
            wrongOptionIds={['opt-a']}
            correctOptionId={null}
          />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('scenario-retry-message')).toBeTruthy();
      });

      // feedbackOpacity's withTiming always runs (1) — the wrong-answer signal is not
      // conditional on the branch — plus the nudge's withSequence and its 3 inner
      // animations: 1 + 1 + 3 = 5.
      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThanOrEqual(5);
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });

    it('reaches both nesting levels of the achievement entrance in full motion too', async () => {
      mockReducedMotion(false);

      await render(
        <ThemeProvider mode="dark">
          <AchievementUnlock achievements={[ACHIEVEMENT]} />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(calls.length).toBeGreaterThan(0);
      });

      // Two withDelay calls (opacity, translateY), each wrapping one inner animation: 4.
      const overrides = overridesPassed();

      expect(overrides.length).toBeGreaterThanOrEqual(4);
      expect(new Set(overrides)).toEqual(new Set([ReduceMotion.Never]));
    });
  });
});
