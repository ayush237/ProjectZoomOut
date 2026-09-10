/**
 * Which numbers a Track-complete screen can honestly show.
 *
 * `screen-03`'s spec asks for three: XP earned, day streak, first-try count. **Only the
 * streak is real.** Checked against every client-visible shape, not assumed:
 *
 *  - `TrackProgressSummary` carries `totalLeaves`/`completedLeaves`/`nextLeafId`/
 *    `isComplete` — no XP, no first-try count, for this or any Track.
 *  - `ReaderStanding.totalXp` is **lifetime** XP, derived across every Track the reader
 *    has ever touched. Labelling it "XP earned" on one book's completion screen would
 *    not be an approximation, it would be a different, larger number wearing the right
 *    number's caption.
 *  - `SessionSummary` is scoped to **today**. A Track this size is read over several
 *    days under the daily cap, so today's XP is a fraction of the book's, not the whole
 *    of it.
 *  - `LeafSummary` (`GET` a Track's Leaves) carries no progress at all — id, order,
 *    title, placeholder flag. Nothing to sum.
 *
 * The only way to get a real per-Track total would be fetching every Leaf's
 * `LeafProgress` and summing client-side — the exact N-request rollup
 * `trackProgressSummarySchema`'s own docstring names as the reason that shape exists in
 * the first place, for the *library's* worth of Tracks. Doing it here for one Track is
 * the same anti-pattern at a smaller scale, and backend work is out of this package's
 * scope besides. So this reports the gap rather than routing around it — see the WP26
 * completion report for the fields the backend would need to add.
 */

export interface TrackCompleteStat {
  readonly value: number;
  readonly label: string;
}

/**
 * The one stat this screen can show, with `WrapUpScreen`'s established fallback:
 * a reader's first day is a beginning, not an absence, so a zero streak still reads as
 * "Day one" rather than "0 Day streak" (`wrapUpStats`, `WrapUpScreen.tsx`).
 */
export function trackCompleteStats(streakCurrent: number): readonly TrackCompleteStat[] {
  return [
    streakCurrent > 0
      ? { value: streakCurrent, label: 'Day streak' }
      : { value: 1, label: 'Day one' },
  ];
}
