import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type {
  AnswerOutcome,
  CompletionOutcome,
  DeliveredLeaf,
  LeafProgress,
  SessionSummary,
} from '@zoomout/shared';

/**
 * Fixtures for a Leaf a test can actually **finish** through the real player, and the
 * helper that drives it there (ONBOARD-3).
 *
 * Shared by `navigation.test.tsx` (the whole first-run flow through `RootNavigator`'s real
 * gate) and `onboardingClosing.test.tsx` (the closing, in both directions, through the
 * real player and `AppStack`). Both need to get a reader from the first slide to the
 * completion panel, and the alternative to one copy of that is two that drift.
 *
 * Nothing here keys on a Payload Media id or asserts on audio: it carries no narration at
 * all, because finishing a Leaf does not involve any.
 */

export const FIRST_LEAF_ID = 'l1';
export const FIRST_TRACK_ID = 't1';

/** The option the fixture's server treats as correct. The client never learns this. */
export const CORRECT_OPTION_ID = 'o1';

/** A Leaf as the server delivers it to a reader who has not answered yet: payoff null. */
export const FIRST_LEAF: DeliveredLeaf = {
  id: FIRST_LEAF_ID,
  trackId: FIRST_TRACK_ID,
  orderIndex: 0,
  title: 'Leaf One',
  isPlaceholder: false,
  summary: { body: 'Summary.' },
  scenario: {
    prompt: 'Prompt?',
    options: [
      { id: CORRECT_OPTION_ID, text: 'The right one' },
      { id: 'o2', text: 'The wrong one' },
    ],
  },
  payoff: null,
  payoffUnlocked: false,
  stickyNotes: { notes: ['One', 'Two'] },
  takeaway: { body: 'Takeaway.' },
  sourceReferences: [],
} as unknown as DeliveredLeaf;

const PROGRESS: LeafProgress = {
  userId: '55a918e0-b185-4fb7-9b08-7459aae3b8fa',
  leafId: FIRST_LEAF_ID,
  attemptCount: 1,
  firstTryCorrect: true,
  correctAt: '2026-09-24T10:00:00.000Z',
  completedAt: null,
  xpAwarded: 0,
};

export const CORRECT_ANSWER: AnswerOutcome = {
  correct: true,
  progress: PROGRESS,
  payoffUnlocked: true,
  payoff: { body: 'The payoff, earned.' },
  unlocked: [],
  trackCompleted: false,
} as unknown as AnswerOutcome;

export const COMPLETION: CompletionOutcome = {
  progress: { ...PROGRESS, completedAt: '2026-09-24T10:05:00.000Z', xpAwarded: 100 },
  xpAwarded: 100,
  alreadyCompleted: false,
  session: {
    localDate: '2026-09-24',
    secondsActive: 300,
    xpEarned: 100,
    capReached: false,
    capSeconds: 900,
    capXp: 500,
  },
  unlocked: [],
  trackCompleted: false,
};

/** The reader's day after finishing one Leaf — what `WrapUp` fetches. */
export const SESSION_SUMMARY: SessionSummary = {
  localDate: '2026-09-24',
  leaves: [
    {
      leafId: FIRST_LEAF_ID,
      title: 'Leaf One',
      trackId: FIRST_TRACK_ID,
      trackTitle: 'A Real Book',
      xpAwarded: 100,
      firstTryCorrect: true,
    },
  ],
  xpEarned: 100,
  streak: { current: 1, longest: 1, lastActiveLocalDate: '2026-09-24' },
  achievements: [],
  session: COMPLETION.session,
};

/**
 * Drives the real player from wherever it is on the first slide to the completion panel:
 * answers the scenario correctly, walks the remaining slides and taps Finish.
 *
 * Presses the same controls a reader does and waits for each slide to arrive, so a slide
 * that never appears fails loudly here rather than being pressed through blind.
 */
export async function finishTheLeaf(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('leaf-player')).toBeOnTheScreen();
  });

  await advanceTo('2 of 5');

  await fireEvent.press(screen.getByTestId(`scenario-option-${CORRECT_OPTION_ID}`));
  await fireEvent.press(screen.getByTestId('scenario-check'));

  // A correct answer unlocks the payoff and the player moves onto it by itself
  // (`useLeafSession.answer` sets the slide) — so this waits for the arrival and does
  // not press Next, which would overshoot to the slide after.
  await waitFor(() => {
    expect(screen.getByTestId('leaf-slide-count')).toHaveTextContent('3 of 5');
  });

  await advanceTo('4 of 5');
  await advanceTo('5 of 5');

  await fireEvent.press(screen.getByTestId('leaf-finish'));

  await waitFor(() => {
    expect(screen.getByTestId('leaf-complete')).toBeOnTheScreen();
  });
}

/** Presses Next once and waits for the slide counter to say the next slide has arrived. */
async function advanceTo(counter: string): Promise<void> {
  await fireEvent.press(screen.getByTestId('leaf-next'));

  await waitFor(() => {
    expect(screen.getByTestId('leaf-slide-count')).toHaveTextContent(counter);
  });
}
