import { render, renderHook, screen, userEvent, waitFor } from '@testing-library/react-native';
import type {
  AnswerOutcome,
  CompletionOutcome,
  DeliveredLeaf,
  LeafProgress,
  PublicScenarioSlide,
} from '@zoomout/shared';

import { ApiError, NetworkError } from '../../api/errors';
import { ThemeProvider } from '../../design';
import { ScenarioSlide } from './ScenarioSlide';
import { flush } from '../../testing/flush';
import { useLeafSession } from './useLeafSession';

/**
 * The Leaf player.
 *
 * Tier A here is the payoff gate and what the client is allowed to know: those tests
 * live alongside the player's own state machine, below. This file starts with the
 * scenario slide because it is where `isCorrect` would leak if it ever did.
 */

const SCENARIO: PublicScenarioSlide = {
  prompt: 'A placeholder scenario prompt.',
  options: [
    { id: 'opt-a', text: 'First option' },
    { id: 'opt-b', text: 'Second option' },
    { id: 'opt-c', text: 'Third option' },
  ],
};

/**
 * `render` is asynchronous in React Native Testing Library v14. Un-awaited it returns
 * before the tree commits, and every query then fails with "render function has not
 * been called" — which points at the query rather than at the missing await.
 */
async function renderScenario(
  overrides: Partial<React.ComponentProps<typeof ScenarioSlide>> = {},
) {
  const onSubmit = jest.fn();

  const utils = await render(
    <ThemeProvider>
      <ScenarioSlide
        data={SCENARIO}
        onSubmit={onSubmit}
        busy={false}
        wrongOptionIds={[]}
        correctOptionId={null}
        {...overrides}
      />
    </ThemeProvider>,
  );

  return { ...utils, onSubmit };
}

describe('ScenarioSlide', () => {
  it('submits an option id, never a correctness judgement', async () => {
    const user = userEvent.setup();
    const { onSubmit } = await renderScenario();

    await user.press(screen.getByTestId('scenario-option-opt-b'));
    await user.press(screen.getByTestId('scenario-check'));

    // The id and nothing else. A second argument would mean the client had formed an
    // opinion about correctness, which is the thing the whole gate rests on it not doing.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('opt-b');
  });

  it('cannot check an answer before one is selected', async () => {
    await renderScenario();

    expect(screen.getByTestId('scenario-check')).toBeDisabled();
  });

  it('keeps every remaining option live after a wrong answer', async () => {
    // The ruled behaviour: unlimited retries. Only the option already known to be wrong
    // is closed off, because re-submitting it would spend an attempt to learn nothing.
    await renderScenario({ wrongOptionIds: ['opt-a'] });

    expect(screen.getByTestId('scenario-option-opt-a')).toBeDisabled();
    expect(screen.getByTestId('scenario-option-opt-b')).not.toBeDisabled();
    expect(screen.getByTestId('scenario-option-opt-c')).not.toBeDisabled();
  });

  it('nudges rather than scolds', async () => {
    await renderScenario({ wrongOptionIds: ['opt-a', 'opt-b'] });

    const message = screen.getByTestId('scenario-retry-message');

    // Two wrong answers, and the copy must not say so. A running failure count is the
    // rebuke the unlimited-retry ruling exists to prevent.
    expect(message).toHaveTextContent(/no limit on tries/iu);
    expect(message).not.toHaveTextContent(/2|two|wrong|incorrect|failed/iu);
  });

  it('disarms the check button once the selected option is graded wrong', async () => {
    /**
     * Found on device, not by a test. After a wrong answer the option was struck out
     * but "Check answer" stayed armed with it, so one more tap resubmitted the same
     * option — spending an attempt to be told the same thing, which is the exact cost
     * that separating "select" from "check" exists to avoid.
     */
    const user = userEvent.setup();
    const { onSubmit, rerender } = await renderScenario();

    await user.press(screen.getByTestId('scenario-option-opt-a'));
    await user.press(screen.getByTestId('scenario-check'));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // The server comes back: that option was wrong.
    await rerender(
      <ThemeProvider>
        <ScenarioSlide
          data={SCENARIO}
          onSubmit={onSubmit}
          busy={false}
          wrongOptionIds={['opt-a']}
          correctOptionId={null}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('scenario-check')).toBeDisabled();
  });

  it('stops accepting answers once one is correct', async () => {
    await renderScenario({ correctOptionId: 'opt-c' });

    expect(screen.queryByTestId('scenario-check')).toBeNull();
    expect(screen.getByTestId('scenario-option-opt-a')).toBeDisabled();
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — the payoff gate, on the client                                     */
/* -------------------------------------------------------------------------- */

const PROGRESS: LeafProgress = {
  userId: '00000000-0000-4000-8000-000000000001',
  leafId: '10',
  attemptCount: 1,
  firstTryCorrect: true,
  correctAt: '2026-08-12T10:00:00.000Z',
  completedAt: null,
  xpAwarded: 0,
};

const PAYOFF_PROSE = 'PLACEHOLDER PAYOFF prose that must not exist before it is earned.';

/** A Leaf as the server delivers it to a reader who has not answered: payoff null. */
const LOCKED_LEAF = {
  id: '10',
  trackId: '1',
  orderIndex: 0,
  title: 'A sample Leaf',
  summary: { body: 'Summary body.' },
  scenario: SCENARIO,
  payoff: null,
  payoffUnlocked: false,
  stickyNotes: { notes: ['One', 'Two'] },
  takeaway: { body: 'Takeaway body.' },
  sourceReferences: [],
  isPlaceholder: true,
} as unknown as DeliveredLeaf;

function fakeApi(overrides: {
  submitAnswer?: jest.Mock;
  completeLeaf?: jest.Mock;
  recordEvent?: jest.Mock;
} = {}) {
  return {
    submitAnswer:
      overrides.submitAnswer ??
      jest.fn(
        (): Promise<AnswerOutcome> =>
          Promise.resolve({
            correct: false,
            progress: { ...PROGRESS, firstTryCorrect: false, correctAt: null },
            payoffUnlocked: false,
            payoff: null,
            unlocked: [],
            trackCompleted: false,
          }),
      ),
    completeLeaf:
      overrides.completeLeaf ??
      jest.fn(
        (): Promise<CompletionOutcome> =>
          Promise.resolve({
            progress: { ...PROGRESS, completedAt: '2026-08-12T10:05:00.000Z', xpAwarded: 100 },
            xpAwarded: 100,
            alreadyCompleted: false,
        session: {
          localDate: '2026-08-12',
          secondsActive: 60,
          xpEarned: 100,
          capReached: false,
          capSeconds: 900,
          capXp: 500,
        },
            unlocked: [],
            trackCompleted: false,
          }),
      ),
    // WP5b. Awards nothing by default, so the existing gate tests are unaffected.
    recordEvent:
      overrides.recordEvent ?? jest.fn(() => Promise.resolve({ unlocked: [] })),
  };
}

const correctOutcome: AnswerOutcome = {
  correct: true,
  progress: PROGRESS,
  payoffUnlocked: true,
  payoff: { body: PAYOFF_PROSE },
  unlocked: [],
};

async function renderSession(api: ReturnType<typeof fakeApi>, leaf: DeliveredLeaf = LOCKED_LEAF) {
  const play = jest.fn();
  const view = await renderHook(() => useLeafSession({ api, leafId: '10', leaf, play }));

  return { ...view, play };
}

describe('the payoff gate, as the client sees it', () => {
  it('holds no payoff prose before one is earned', async () => {
    const { result } = await renderSession(fakeApi());

    /**
     * Asserted on **client state, not on what renders**, which is the distinction the
     * acceptance criterion draws. A test that only checked the payoff was off-screen
     * would pass against a client that had fetched the prose and hidden it — and that
     * client leaks it to a screenshot, a memory dump or the next re-render.
     */
    expect(result.current.payoff).toBeNull();
    expect(JSON.stringify(result.current)).not.toContain(PAYOFF_PROSE);
  });

  it('still holds none after a wrong answer', async () => {
    const api = fakeApi();
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.answer('opt-a');
    });

    expect(result.current.payoff).toBeNull();
    expect(result.current.wrongOptionIds).toEqual(['opt-a']);
  });

  it('will not advance past the scenario while the payoff is locked', async () => {
    const { result } = await renderSession(fakeApi());

    await flush(() => {
      result.current.next();
    });
    expect(result.current.slide).toBe('scenario');
    expect(result.current.canAdvance).toBe(false);

    // The gate is navigation, not rendering: there is no route to the payoff slide.
    await flush(() => {
      result.current.next();
    });
    expect(result.current.slide).toBe('scenario');
  });

  it('receives the prose only from the answer response, and then opens the gate', async () => {
    const api = fakeApi({ submitAnswer: jest.fn(() => Promise.resolve(correctOutcome)) });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.answer('opt-c');
    });

    expect(result.current.payoff?.body).toBe(PAYOFF_PROSE);
    expect(result.current.correctOptionId).toBe('opt-c');
    expect(result.current.slide).toBe('payoff');
    expect(result.current.justUnlocked).toBe(true);
  });

  it('never locks a reader out, however many times they are wrong', async () => {
    const api = fakeApi();
    const { result } = await renderSession(api);

    for (const optionId of ['opt-a', 'opt-b', 'opt-a', 'opt-b', 'opt-a', 'opt-b']) {
      await flush(() => {
        result.current.answer(optionId);
      });
    }

    // Twelve calls' worth of wrongness would be no different; what matters is that
    // nothing latches. The client keeps accepting answers and the gate stays shut.
    expect(result.current.payoff).toBeNull();
    expect(result.current.correctOptionId).toBeNull();
    expect(result.current.fatalError).toBeNull();

    api.submitAnswer.mockResolvedValueOnce(correctOutcome);
    await flush(() => {
      result.current.answer('opt-c');
    });

    expect(result.current.payoff?.body).toBe(PAYOFF_PROSE);
  });
});

describe('completion', () => {
  it('submits once on a fast double-tap', async () => {
    const api = fakeApi();
    const { result } = await renderSession(api);

    /**
     * Both calls in one act, which is what a double-tap is: two handlers in a single
     * React batch, both seeing the pre-update state. The server is idempotent, so the
     * bug this guards is not double XP — it is the *second* response arriving with
     * `xpAwarded: 0` and overwriting the first, telling a reader who tapped twice that
     * they earned nothing.
     */
    await flush(() => {
      result.current.complete(() => undefined);
      result.current.complete(() => undefined);
    });

    expect(api.completeLeaf).toHaveBeenCalledTimes(1);
    expect(result.current.xpAwarded).toBe(100);
  });

  it('reports what this call awarded, so a replay reads as zero', async () => {
    const api = fakeApi({
      completeLeaf: jest.fn(() => Promise.resolve({
        progress: { ...PROGRESS, completedAt: '2026-08-12T10:05:00.000Z', xpAwarded: 100 },
        xpAwarded: 0,
        alreadyCompleted: true,
        session: {
          localDate: '2026-08-12',
          secondsActive: 60,
          xpEarned: 100,
          capReached: false,
          capSeconds: 900,
          capXp: 500,
        },
        // A replay awards nothing, so it announces nothing. The server decides this;
        // the empty list here is the shape that decision arrives in.
        unlocked: [],
        trackCompleted: false,
      })),
    });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.complete(() => undefined);
    });

    expect(result.current.xpAwarded).toBe(0);
  });

  it('lets the reader try again after a dropped connection', async () => {
    const api = fakeApi({
      // `NetworkError` takes no message — it supplies its own reader-facing copy.
      completeLeaf: jest.fn().mockRejectedValueOnce(new NetworkError()),
    });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.complete(() => undefined);
    });

    // `NetworkError` supplies its own reader-facing copy rather than echoing whatever
    // the transport threw, so the assertion is on that, not on the constructor argument.
    expect(result.current.actionError).toMatch(/check your connection/iu);
    expect(result.current.fatalError).toBeNull();

    // The double-tap guard must not have latched shut on a failure.
    api.completeLeaf.mockResolvedValueOnce({
      progress: PROGRESS,
      xpAwarded: 100,
      alreadyCompleted: false,
        session: {
          localDate: '2026-08-12',
          secondsActive: 60,
          xpEarned: 100,
          capReached: false,
          capSeconds: 900,
          capXp: 500,
        },
      unlocked: [],
      trackCompleted: false,
    });

    await flush(() => {
      result.current.complete(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.xpAwarded).toBe(100);
    });
  });
});

describe('a Leaf withdrawn mid-session', () => {
  it('fails to a readable message rather than a crash', async () => {
    const api = fakeApi({
      submitAnswer: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'NOT_FOUND', message: 'Leaf not found', status: 404 }),
        ),
    });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.answer('opt-a');
    });

    expect(result.current.fatalError).toMatch(/no longer available/iu);
  });

  it('does not tell the reader the Track was the reason', async () => {
    // The backend deliberately 404s the Leaf without naming the Track — a message that
    // said "this book was removed" would leak the takedown the cascade exists to hide.
    const api = fakeApi({
      completeLeaf: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'NOT_FOUND', message: 'Leaf not found', status: 404 }),
        ),
    });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.complete(() => undefined);
    });

    expect(result.current.fatalError).not.toMatch(/track|book|unpublish/iu);
  });
});

/* -------------------------------------------------------------------------- */
/* Tier B — navigation and the round trip                                      */
/* -------------------------------------------------------------------------- */

describe('slide navigation', () => {
  it('walks all five slides once the payoff is earned', async () => {
    const unlocked = { ...LOCKED_LEAF, payoff: { body: PAYOFF_PROSE }, payoffUnlocked: true };
    const { result } = await renderSession(fakeApi(), unlocked);

    const seen = [result.current.slide];

    for (let step = 0; step < 4; step += 1) {
      await flush(() => {
        result.current.next();
      });
      seen.push(result.current.slide);
    }

    expect(seen).toEqual(['summary', 'scenario', 'payoff', 'stickyNotes', 'takeaway']);
    expect(result.current.isLastSlide).toBe(true);
  });

  it('goes back, and stops at the first slide', async () => {
    const { result } = await renderSession(fakeApi());

    await flush(() => {
      result.current.back();
    });

    expect(result.current.slide).toBe('summary');
    expect(result.current.slideIndex).toBe(0);
  });

  it('stops replaying the unlock once the reader moves on', async () => {
    const api = fakeApi({ submitAnswer: jest.fn(() => Promise.resolve(correctOutcome)) });
    const { result } = await renderSession(api);

    await flush(() => {
      result.current.answer('opt-c');
    });
    expect(result.current.justUnlocked).toBe(true);

    await flush(() => {
      result.current.next();
    });

    // Re-entering the payoff slide later must not bounce the card again.
    expect(result.current.justUnlocked).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* WP5a — the daily cap reaches the client as a verdict, not a calculation      */
/* -------------------------------------------------------------------------- */

describe('the session cap', () => {
  it('carries the server’s verdict through to the completion screen', async () => {
    /**
     * Tier B, one happy path. What matters here is that `capReached` is *transported*
     * rather than derived: the client has the XP total and the threshold in the same
     * object, and the temptation to compare them locally is exactly how a wellbeing
     * feature ends up disagreeing with the server that enforces it.
     */
    const api = fakeApi({
      completeLeaf: jest.fn(() =>
        Promise.resolve({
          progress: { ...PROGRESS, completedAt: '2026-08-12T10:05:00.000Z', xpAwarded: 100 },
          xpAwarded: 100,
          alreadyCompleted: false,
          session: {
            localDate: '2026-08-12',
            secondsActive: 400,
            // Deliberately *under* the XP threshold: the cap fired on time, and a
            // client comparing xpEarned to capXp would conclude the day is still open.
            xpEarned: 120,
            capReached: true,
            capSeconds: 300,
            capXp: 500,
          },
          unlocked: [],
          trackCompleted: false,
        }),
      ),
    });

    const { result } = await renderSession(api);

    await flush(() => {
      result.current.complete(() => undefined);
    });

    expect(result.current.capReached).toBe(true);
    expect(result.current.xpAwarded).toBe(100);
  });
});

/* -------------------------------------------------------------------------- */
/* Achievements (WP5b)                                                         */
/* -------------------------------------------------------------------------- */

describe('achievements', () => {
  const BADGE = {
    id: 'first-leaf',
    name: 'First Light',
    description: 'Complete your first Leaf.',
    tier: 'common' as const,
    unlockedAt: '2026-08-12T10:05:00.000Z',
  };

  it('carries what the completion awarded, without inferring it', async () => {
    /**
     * Tier B, one happy path. The client is told; it never decides. There is
     * deliberately no branch here that counts completed Leaves locally — a client that
     * knew the thresholds would disagree with the server the first time a completion
     * was replayed, and congratulate the reader twice for one badge.
     */
    const api = fakeApi({
      completeLeaf: jest.fn(() =>
        Promise.resolve({
          progress: { ...PROGRESS, completedAt: '2026-08-12T10:05:00.000Z', xpAwarded: 100 },
          xpAwarded: 100,
          alreadyCompleted: false,
          session: {
            localDate: '2026-08-12',
            secondsActive: 60,
            xpEarned: 100,
            capReached: false,
            capSeconds: 900,
            capXp: 500,
          },
          unlocked: [BADGE],
          trackCompleted: false,
        }),
      ),
    });

    const { result } = await renderSession(api);

    await flush(() => {
      result.current.complete(() => undefined);
    });

    expect(result.current.unlocked).toEqual([BADGE]);
  });

  it('reports a Dinner Table Knowledge open once, and keeps what it unlocked', async () => {
    // The only signal that the deep-cut content is read at all. Reported once per
    // session: the toggle can be tapped repeatedly, and each re-open is a real open,
    // but nineteen rows from one reader fidgeting would drown the signal.
    const recordEvent = jest.fn(() =>
      Promise.resolve({ unlocked: [{ ...BADGE, id: 'dinner-party', name: 'Dinner Party' }] }),
    );
    const { result } = await renderSession(fakeApi({ recordEvent }));

    await flush(() => {
      result.current.reportDinnerTableOpen();
    });
    await flush(() => {
      result.current.reportDinnerTableOpen();
    });

    expect(recordEvent).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith('dinner_table_open', '10');
    expect(result.current.unlocked.map((achievement) => achievement.id)).toEqual(['dinner-party']);
  });
});
