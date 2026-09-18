/**
 * The four beats' copy and timing.
 *
 * **Verbatim strings.** `IntroScreen.test.tsx` asserts these exact values so a
 * transcription slip cannot reach published copy — see the handoff's own requirement.
 *
 * **One timeline, not four slides.** `startMs` is when a line begins its fade *in*; the
 * next line's `startMs` is also when *this* line begins its fade *out* — the two windows
 * overlap by `INTRO_CROSSFADE_MS`, which is the crossfade. The camera in `IntroScreen`
 * runs its own single continuous move across the same clock and does not stop or restart
 * at any of these timestamps — see that file for why beat boundaries are a text concern
 * only, not a camera one.
 */

export interface IntroBeat {
  readonly text: string;
  /** When this line starts fading in, in ms from mount. */
  readonly startMs: number;
}

export const INTRO_BEATS: readonly IntroBeat[] = [
  { text: 'Your mind is a vast landscape.', startMs: 0 },
  { text: 'Nothing grows here in a single leap.', startMs: 3200 },
  { text: 'What changes you is how small things connect.', startMs: 6800 },
  { text: "Let's zoom out.", startMs: 10400 },
];

/** How long a line takes to fade fully in (or out). */
export const INTRO_CROSSFADE_MS = 700;

/**
 * Total run time, mount to hand-off eligibility. Within the handoff's 12–16s window,
 * with beat 4 holding for `INTRO_TOTAL_DURATION_MS - INTRO_HANDOFF_MS` (3.6s) before the
 * sign-in control appears — long enough to read four words, short enough not to stall
 * a reader who is ready to go.
 */
export const INTRO_TOTAL_DURATION_MS = 14_000;

/**
 * When beat 4 begins — the instant the sign-in control replaces skip, and where the
 * camera's own single move (`introCamera.ts`, wired in `IntroScreen.tsx`) finishes so it
 * can hold still for the rest of the run rather than still drifting while the reader is
 * meant to be reading. Derived rather than duplicated so the two files cannot disagree
 * about which timestamp "beat 4 starts" means.
 */
const lastBeat = INTRO_BEATS[INTRO_BEATS.length - 1];
export const INTRO_HANDOFF_MS = lastBeat?.startMs ?? INTRO_TOTAL_DURATION_MS;
