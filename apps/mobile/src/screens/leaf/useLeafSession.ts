import { useCallback, useRef, useState } from 'react';
import type {
  AnswerOutcome,
  DeliveredLeaf,
  PayoffSlide,
  UnlockedAchievement,
} from '@zoomout/shared';

import type { ApiClient } from '../../api/client';
import { ApiError, NetworkError } from '../../api/errors';
import type { SoundCue } from '../../sound/soundCues';

/**
 * The learning loop as a state machine, separated from the screen that draws it.
 *
 * Extracted for one reason: **the Tier A guarantees in this package are behavioural,
 * not visual.** "The payoff is absent until earned", "completing twice awards XP once",
 * "a withdrawn Leaf fails readably" are all statements about state transitions, and
 * testing them through a rendered tree would mean asserting on what appears rather than
 * on what the client holds — which is precisely the weaker claim the acceptance
 * criteria warn against ("asserted on the payload, not on what renders").
 */

export const SLIDES = ['summary', 'scenario', 'payoff', 'stickyNotes', 'takeaway'] as const;

export type SlideKey = (typeof SLIDES)[number];

/** The index past which a locked payoff must not let anyone travel. */
const SCENARIO_INDEX = 1;

export interface LeafSessionState {
  readonly slideIndex: number;
  readonly slide: SlideKey;
  /**
   * The earned payoff, or null.
   *
   * **Never populated from anything but a server response.** There is no branch that
   * reconstructs it, defaults it, or copies it out of the Leaf before it is earned —
   * `DeliveredLeaf.payoff` is itself null until then.
   */
  readonly payoff: PayoffSlide | null;
  readonly wrongOptionIds: readonly string[];
  readonly correctOptionId: string | null;
  readonly answering: boolean;
  readonly completing: boolean;
  /** Set once the reader has finished; drives the XP summary. */
  readonly xpAwarded: number | null;
  readonly firstTryCorrect: boolean;
  /** The server's verdict that today's session is over. Never computed here. */
  readonly capReached: boolean;
  /** True only on the transition that earned the payoff, so re-entry does not replay it. */
  readonly justUnlocked: boolean;
  /**
   * Achievements this session has earned, in the order the server awarded them.
   *
   * **Server-decided, never inferred.** The client does not know the thresholds and must
   * not guess at them — a locally computed "you have now done five" would disagree with
   * the server the first time a completion was replayed, and the reader would be
   * congratulated twice for one badge.
   */
  readonly unlocked: readonly UnlockedAchievement[];
  /** A reader-facing failure that ends the session — a withdrawn Leaf, most notably. */
  readonly fatalError: string | null;
  /** A recoverable failure; the reader can try the same action again. */
  readonly actionError: string | null;
}

export interface LeafSession extends LeafSessionState {
  readonly canAdvance: boolean;
  readonly isLastSlide: boolean;
  /**
   * Declared as properties rather than methods on purpose. These are `useCallback`
   * arrow functions with no `this`, and the screen passes them straight to `onPress`;
   * method shorthand would tell TypeScript they are methods and make every such pass
   * an `unbound-method` violation for a hazard that does not exist here.
   */
  readonly next: () => void;
  readonly back: () => void;
  readonly answer: (optionId: string) => void;
  readonly complete: (onFinished: () => void) => void;
  /**
   * Reports that the reader opened this Leaf's Dinner Table Knowledge fact.
   *
   * Fire-and-forget by design: the fact is already on screen, revealed locally, and a
   * failed report must not undo that or interrupt the reader. What is lost on failure
   * is one analytics row and — at worst, once — the `dinner-party` badge, which the
   * next open re-earns because the predicate is monotonic.
   */
  readonly reportDinnerTableOpen: () => void;
}

export interface LeafSessionOptions {
  readonly api: Pick<ApiClient, 'submitAnswer' | 'completeLeaf' | 'recordEvent'>;
  readonly leafId: string;
  readonly leaf: DeliveredLeaf;
  readonly play: (cue: SoundCue) => void;
}

export function useLeafSession({ api, leafId, leaf, play }: LeafSessionOptions): LeafSession {
  const [slideIndex, setSlideIndex] = useState(0);

  /**
   * Seeded from the delivered Leaf, which carries the payoff only when the reader has
   * already earned it on a previous visit. On a first visit this is null and stays null
   * until `answer` puts a server response in it.
   */
  const [payoff, setPayoff] = useState<PayoffSlide | null>(leaf.payoff);
  const [wrongOptionIds, setWrongOptionIds] = useState<readonly string[]>([]);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [unlocked, setUnlocked] = useState<readonly UnlockedAchievement[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * One report per Leaf session, guarded by a ref for the same reason as completion.
   *
   * The toggle can be tapped repeatedly to hide and re-show the fact, and each of those
   * is a genuine open — but only the first tells us anything, and nineteen rows from one
   * reader fidgeting would drown the signal the table exists to collect.
   */
  const dinnerTableReported = useRef(false);

  /**
   * Guards double submission, and a `useRef` rather than the `completing` state on
   * purpose.
   *
   * A fast double-tap fires both handlers in the same React batch, so both read the
   * pre-update `completing === false` and both call the endpoint. The server is
   * idempotent and would award XP once regardless — but the *second* response carries
   * `xpAwarded: 0`, and whichever resolves last wins the render, so the reader who
   * double-tapped is told they earned nothing. A ref updates synchronously and closes
   * that window.
   */
  const completionStarted = useRef(false);

  const answer = useCallback(
    (optionId: string) => {
      if (answering || correctOptionId !== null) {
        return;
      }

      setAnswering(true);
      setActionError(null);

      void (async () => {
        try {
          const outcome: AnswerOutcome = await api.submitAnswer(leafId, optionId);

          if (outcome.correct) {
            setCorrectOptionId(optionId);
            setFirstTryCorrect(outcome.progress.firstTryCorrect);
            // The payoff arrives with the grade, so the unlock does not wait on a
            // second round trip — the animation would otherwise start on a spinner.
            setPayoff(outcome.payoff);
            setJustUnlocked(true);
            // `first-try-first` is earned by answering, so it can land here rather than
            // at completion. Accumulated, not replaced: a later completion may add more.
            setUnlocked((current) => [...current, ...outcome.unlocked]);
            play('correct');
            setSlideIndex(SCENARIO_INDEX + 1);
          } else {
            setWrongOptionIds((current) =>
              current.includes(optionId) ? current : [...current, optionId],
            );
            play('incorrect');
          }
        } catch (caught) {
          assignError(caught, setFatalError, setActionError);
        } finally {
          setAnswering(false);
        }
      })();
    },
    [answering, correctOptionId, api, leafId, play],
  );

  const complete = useCallback(
    (onFinished: () => void) => {
      if (completionStarted.current) {
        return;
      }

      completionStarted.current = true;
      setCompleting(true);
      setActionError(null);

      void (async () => {
        try {
          const outcome = await api.completeLeaf(leafId);

          setXpAwarded(outcome.xpAwarded);
          setCapReached(outcome.session.capReached);
          setUnlocked((current) => [...current, ...outcome.unlocked]);
          play('leafComplete');
          onFinished();
        } catch (caught) {
          // Let them try again — the guard is against a double-tap, not against a
          // retry after a dropped connection.
          completionStarted.current = false;
          assignError(caught, setFatalError, setActionError);
        } finally {
          setCompleting(false);
        }
      })();
    },
    [api, leafId, play],
  );

  /**
   * The gate, expressed as navigation.
   *
   * A locked payoff does not merely render differently — the reader cannot get past the
   * scenario at all. Enforcing it here rather than in the payoff slide means there is
   * one place to check and no route around it.
   */
  const canAdvance = slideIndex !== SCENARIO_INDEX || payoff !== null;
  const isLastSlide = slideIndex === SLIDES.length - 1;

  const next = useCallback(() => {
    setJustUnlocked(false);
    setSlideIndex((current) => {
      if (current === SCENARIO_INDEX && payoff === null) {
        return current;
      }

      return Math.min(current + 1, SLIDES.length - 1);
    });
  }, [payoff]);

  const back = useCallback(() => {
    setJustUnlocked(false);
    setSlideIndex((current) => Math.max(current - 1, 0));
  }, []);

  const reportDinnerTableOpen = useCallback(() => {
    if (dinnerTableReported.current) {
      return;
    }

    dinnerTableReported.current = true;

    void (async () => {
      try {
        const outcome = await api.recordEvent('dinner_table_open', leafId);

        setUnlocked((current) => [...current, ...outcome.unlocked]);
      } catch {
        /**
         * Swallowed, and this is the one place in the loop where that is right.
         *
         * The reader has already been shown the fact; there is nothing to roll back and
         * nothing they could do about a failure. Allowing a retry on the next open is
         * why the guard is reset here rather than left latched.
         */
        dinnerTableReported.current = false;
      }
    })();
  }, [api, leafId]);

  return {
    slideIndex,
    slide: SLIDES[slideIndex] ?? 'summary',
    payoff,
    wrongOptionIds,
    correctOptionId,
    answering,
    completing,
    xpAwarded,
    firstTryCorrect,
    capReached,
    justUnlocked,
    unlocked,
    fatalError,
    actionError,
    canAdvance,
    isLastSlide,
    next,
    back,
    answer,
    complete,
    reportDinnerTableOpen,
  };
}

/**
 * Routes a failure to the right severity.
 *
 * **A 404 mid-session is the takedown case and it is fatal.** `resolveVisibleLeaf`
 * withdraws a Leaf the moment its Track is unpublished, which can land while a reader
 * is on slide 3 — so the Leaf they are holding no longer exists and no retry will bring
 * it back. Anything else is recoverable and leaves them where they are.
 */
function assignError(
  caught: unknown,
  setFatal: (message: string) => void,
  setAction: (message: string) => void,
): void {
  if (caught instanceof ApiError && caught.status === 404) {
    setFatal('This Leaf is no longer available. It may have been removed while you were reading.');
    return;
  }

  if (caught instanceof NetworkError) {
    setAction(caught.message);
    return;
  }

  if (caught instanceof ApiError) {
    setAction(caught.message);
    return;
  }

  setAction('Something went wrong. Please try again.');
}
