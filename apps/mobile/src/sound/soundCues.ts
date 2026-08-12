/**
 * The sound layer: trigger points now, audio files later.
 *
 * **Ships no assets, by ruling of 2026-08-12.** What it does ship is every place a
 * sound will eventually fire, because that is the expensive half. Retrofitting trigger
 * points across a finished player means re-reading a state machine to find the moments
 * — and the moments are exactly what is hard to recover: "the instant the payoff
 * unlocks" is one specific line inside an animation callback, not a component.
 *
 * The asset map is the swap point. Drop files in, register a real player, and every
 * cue below starts sounding without touching the player screen.
 */

/**
 * Every sound this product makes in Phase 1.
 *
 * `design-direction.md` §7 lists achievement and session-wrap too; those belong to WP5
 * and WP9 and are deliberately absent — a cue with no caller is indistinguishable from
 * a cue whose caller was forgotten.
 */
export type SoundCue = 'correct' | 'incorrect' | 'leafComplete';

/**
 * How a cue should sound, for whoever records them.
 *
 * Kept in code rather than in a document because the constraint on `incorrect` is a
 * product rule, not a preference: **unlimited retries are the ruled behaviour, so a
 * harsh buzzer turns a normal intermediate state into a rebuke.** A sound designer
 * reading only a filename would get that wrong, and it would be nobody's bug.
 */
export const CUE_INTENT: Record<SoundCue, string> = {
  correct:
    'Bright, short, resolved. The reward moment — it may be the most satisfying sound ' +
    'in the app, but it is not a fanfare; it fires up to twenty times a session.',
  incorrect:
    'Soft, neutral, unresolved — a nudge to try again, never a buzzer. Wrong answers ' +
    'are unlimited and expected; punishing this is the fastest way to make the core ' +
    'mechanic feel hostile.',
  leafComplete:
    'Warmer and slightly longer than `correct`, same instrument family. Completion, ' +
    'not achievement — WP9 owns the bigger celebration and this must not upstage it.',
};

/**
 * Where audio files will live, once they exist.
 *
 * Every value is `null` today and the player treats null as "no sound, no error". The
 * type is what makes adding one a one-line change with a compile-time guarantee that
 * the cue is known.
 */
export type SoundAssetMap = Readonly<Record<SoundCue, number | null>>;

export const SOUND_ASSETS: SoundAssetMap = {
  correct: null,
  incorrect: null,
  leafComplete: null,
};
