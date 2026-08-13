/**
 * The shapes the learning loop returns to a reader.
 *
 * These describe what the server *delivers*, as opposed to what the content model
 * *is* — the difference being the payoff gate, which is a fact about one reader at one
 * moment rather than a fact about a Leaf. They live here because WP8 makes the mobile
 * app the second consumer, and CLAUDE.md forbids the same shape being defined in both
 * `apps/backend` and `apps/mobile`.
 *
 * **A new module rather than an addition to `content.ts`,** which has been frozen since
 * 2026-08-08. Nothing here changes the content model; it describes delivery of it.
 *
 * **Types only, deliberately no Zod schemas.** The rest of `packages/shared` pairs each
 * shape with a parser because that shape arrives from outside — a CMS response, a
 * request body, a database row. These arrive from our own backend over an authenticated
 * channel, and the one schema that looks like it would fit, `publicLeafSchema`, must
 * never be used on them: it predates the Dinner Table Knowledge refinement and would
 * reject valid Leaves. Parsing here would buy nothing and break the takeaway slide.
 */

import type { LeafProgress } from './progress.js';
import type { PayoffSlide, PublicLeaf } from './content.js';
import type { Achievement, UnlockedAchievement } from './gamification.js';

/**
 * A Leaf as one specific reader is allowed to receive it.
 *
 * `PublicLeaf` with the payoff made conditional. The answer key is already gone by
 * construction; this narrows it further by who is asking, which `PublicLeaf` cannot
 * express because it has no reader.
 *
 * **`payoff` is null, not blank, until earned.** The prose is absent from the object
 * rather than emptied, so there is no locked-but-present state for a client to render
 * early, log, or cache. Widening this type is how the product's differentiator gets
 * quietly removed.
 */
export interface DeliveredLeaf extends Omit<PublicLeaf, 'payoff'> {
  /** Null until earned. The prose is absent from the object, not blanked. */
  readonly payoff: PayoffSlide | null;
  /** The contract the client renders against; `payoff === null` is its enforcement. */
  readonly payoffUnlocked: boolean;
}

/**
 * The result of submitting one answer.
 *
 * Carries the payoff on success so a correct answer costs one round trip rather than
 * two — the unlock animation should not wait on a second request.
 */
export interface AnswerOutcome {
  readonly correct: boolean;
  readonly progress: LeafProgress;
  readonly payoffUnlocked: boolean;
  /** The earned payoff slide, or null while it is still locked. */
  readonly payoff: PayoffSlide | null;
  /** Achievements this answer earned. Added in WP5b; empty on most answers. */
  readonly unlocked: readonly UnlockedAchievement[];
}

export interface CompletionOutcome {
  readonly progress: LeafProgress;
  /** What *this call* awarded. Zero on a replay; `progress.xpAwarded` holds the total. */
  readonly xpAwarded: number;
  readonly alreadyCompleted: boolean;
  /** The reader's day, after this completion. Added in WP5a. */
  readonly session: SessionStatus;
  /**
   * Achievements this completion earned. Added in WP5b.
   *
   * **In the response of the triggering action, not on a later poll** — the unlock
   * animation fires on the completion screen the reader is already looking at, and a
   * client that had to ask a second time would either animate late or animate on
   * re-entry to a Leaf that awarded nothing.
   *
   * Empty on a replay, because awarding is idempotent: the second call earns nothing,
   * so it announces nothing.
   */
  readonly unlocked: readonly UnlockedAchievement[];
  /**
   * True on the completion that finished the **book**, not just the Leaf. Added in WP10.
   *
   * The client cannot infer this — it knows its own Leaf, not how many remain — and the
   * server already decides it while closing `user_tracks.status`. It exists because
   * `PRODUCT.md` requires the purchase-forward link to be shown on Track completion
   * specifically, and that obligation needs a moment to appear at.
   *
   * Re-derived on a replay rather than reported as false: a reader re-entering the Leaf
   * that finished the book should still be offered the link.
   */
  readonly trackCompleted: boolean;
}

/**
 * Where a reader stands, in one round trip: today's cap, the streak, and lifetime XP.
 *
 * One shape rather than three endpoints because Profile renders all of it at once and
 * the limit screen needs the session half. **Defined here rather than in each app** —
 * the mobile client previously declared its own `DayStatus` for the WP5a half of this,
 * which is exactly the duplication CLAUDE.md forbids for a shape crossing the boundary.
 */
/**
 * One Leaf the reader finished today, named well enough to show someone else.
 *
 * Carries the book as well as the Leaf because the wrap-up screen is built to be
 * screenshotted: "3 Leaves" means nothing to a stranger, and "3 Leaves from *Atomic
 * Habits*" is the whole point of sharing it.
 */
export interface CompletedLeafSummary {
  readonly leafId: string;
  readonly title: string;
  readonly trackId: string;
  readonly trackTitle: string;
  /** What this Leaf paid. Zero for one completed after the cap had already fired. */
  readonly xpAwarded: number;
  readonly firstTryCorrect: boolean;
}

/**
 * A reader's day, assembled in one call for the wrap-up screen (WP9).
 *
 * **Why this exists rather than the client stitching it together:** `SessionStatus`
 * carries totals and says nothing about *which* Leaves were completed, so "here is what
 * you learnt" could not be built from what shipped in WP5a. The alternative was four
 * requests — session, streak, progress, achievements — resolved against content on the
 * client, which is both slower and a second place where "today" would have to be
 * decided.
 *
 * **"Today" is the reader's local day, resolved server-side** from their stored
 * timezone, exactly as `GET /progress/today` does it. A client that sent its own date
 * could rewrite its history by changing the device clock.
 */
export interface SessionSummary {
  /** The reader's own calendar date, not UTC. */
  readonly localDate: string;
  /** Completed today, in the order they were finished. Empty before the first one. */
  readonly leaves: readonly CompletedLeafSummary[];
  /** XP earned today. From the day's row, not a sum of `leaves` — the cap can differ. */
  readonly xpEarned: number;
  readonly streak: StreakStatus;
  /**
   * Achievements earned **today**, not the reader's whole collection.
   *
   * `Achievement` rather than `UnlockedAchievement`: the screen groups them under one
   * date it already has, so a per-badge timestamp would be noise.
   */
  readonly achievements: readonly Achievement[];
  /** Where the day stands, so the screen can tell an ending from a pause. */
  readonly session: SessionStatus;
}

export interface ReaderStanding {
  readonly session: SessionStatus;
  readonly streak: StreakStatus;
  /**
   * Lifetime XP, **derived on read** — `SUM(xp_awarded)` over the reader's Leaf
   * progress, ruled 2026-08-09. There is deliberately no stored counter: the completion
   * path is idempotent precisely because replaying it is the ordinary failure mode, and
   * a denormalised total is where that replay would land as a double increment nobody
   * could later detect.
   */
  readonly totalXp: number;
}

/**
 * Where the reader stands against today's cap.
 *
 * **The thresholds travel with the state on purpose.** The client has to say "500 XP"
 * on the limit screen, and a client that knows the number independently is a second
 * copy of a product decision that lives in backend configuration — it would go stale
 * silently the first time the cap moved.
 *
 * `capReached` is the server's verdict, not a comparison for the client to make. The
 * totals are here to render a progress indicator, never to re-derive the decision.
 */
export interface SessionStatus {
  /** The reader's own calendar date, not UTC. */
  readonly localDate: string;
  readonly secondsActive: number;
  readonly xpEarned: number;
  readonly capReached: boolean;
  readonly capSeconds: number;
  readonly capXp: number;
}

/** Current and longest run of days with at least one completed Leaf. */
export interface StreakStatus {
  readonly current: number;
  readonly longest: number;
  /** Null for a reader who has never completed a Leaf. */
  readonly lastActiveLocalDate: string | null;
}
