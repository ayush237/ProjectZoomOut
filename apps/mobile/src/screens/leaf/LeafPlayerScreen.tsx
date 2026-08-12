import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DeliveredLeaf, UnlockedAchievement } from '@zoomout/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '../../auth/AuthProvider';
import {
  AchievementUnlock,
  Button,
  ErrorState,
  Icon,
  StatusMessage,
  Text,
} from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { useSound } from '../../sound/SoundProvider';
import { useAsyncResource } from '../useAsyncResource';
import { PayoffSlide } from './PayoffSlide';
import { ScenarioSlide } from './ScenarioSlide';
import { StickyNotesSlide } from './StickyNotesSlide';
import { SummarySlide } from './SummarySlide';
import { TakeawaySlide } from './TakeawaySlide';
import { SLIDES, useLeafSession } from './useLeafSession';

type PlayerRoute = RouteProp<AppStackParamList, 'LeafPlayer'>;
type PlayerNavigation = NativeStackNavigationProp<AppStackParamList, 'LeafPlayer'>;

/**
 * The Leaf player: five slides and the gate between them.
 *
 * This screen is deliberately thin. The loop's rules live in `useLeafSession` because
 * they are the part with the guarantees on them; what remains here is layout, the
 * chrome, and the decision about which slide to draw.
 */
export function LeafPlayerScreen(): React.JSX.Element {
  const api = useApi();
  const route = useRoute<PlayerRoute>();
  const { leafId, trackTitle } = route.params;

  const load = useCallback(async (): Promise<DeliveredLeaf> => {
    /**
     * Fetch and start together.
     *
     * `startLeaf` is what makes `firstTryCorrect` meaningful, and it is idempotent, so
     * issuing it alongside the fetch costs nothing on a re-entry. They are independent —
     * neither response feeds the other — so running them in sequence would just add a
     * round trip to the slowest moment in the app, opening a Leaf.
     */
    const [leaf] = await Promise.all([api.getLeaf(leafId), api.startLeaf(leafId)]);

    return leaf;
  }, [api, leafId]);

  const resource = useAsyncResource<DeliveredLeaf>(load);

  if (resource.status === 'loading') {
    return <PlayerFrame testID="leaf-loading" title={trackTitle} centred />;
  }

  if (resource.status === 'error' || resource.data === null) {
    return (
      <PlayerFrame testID="leaf-error" title={trackTitle}>
        <ErrorState
          testID="leaf-load-error"
          message={resource.error ?? 'Something went wrong.'}
          onRetry={resource.reload}
        />
      </PlayerFrame>
    );
  }

  /**
   * Keyed on the Leaf id so a reader who finishes one Leaf and opens the next gets a
   * fresh session rather than the previous one's slide index and answer state. Without
   * the key, `useLeafSession`'s `useState` initialisers would not re-run.
   */
  return <LeafSessionView key={leafId} leaf={resource.data} leafId={leafId} title={trackTitle} />;
}

function LeafSessionView({
  leaf,
  leafId,
  title,
}: {
  readonly leaf: DeliveredLeaf;
  readonly leafId: string;
  readonly title: string;
}): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();
  const { play } = useSound();
  const navigation = useNavigation<PlayerNavigation>();

  const session = useLeafSession({ api, leafId, leaf, play });

  const leave = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /**
   * A withdrawn Leaf takes over the screen.
   *
   * The takedown cascade can land mid-session: unpublishing a Track withdraws its
   * Leaves immediately, so the reader may be holding one that no longer exists. There
   * is nothing to retry, so the only honest control is a way out.
   */
  if (session.fatalError !== null) {
    return (
      <PlayerFrame testID="leaf-withdrawn" title={title} onClose={leave}>
        {/* Not `ErrorState`, which requires a retry: there is nothing to retry. The Leaf
            is gone, and offering a button that will 404 again is worse than offering
            none. The only honest control is the way out. */}
        <View
          style={{
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingTop: theme.spacing.xxl,
          }}
        >
          <Icon name="info" size={40} color={theme.palette.textMuted} />
          <Text variant="h3" align="center" testID="leaf-withdrawn-message">
            {session.fatalError}
          </Text>
          <View style={{ alignSelf: 'stretch', paddingTop: theme.spacing.xl }}>
            <Button label="Back to your books" onPress={leave} testID="leaf-withdrawn-exit" />
          </View>
        </View>
      </PlayerFrame>
    );
  }

  if (session.xpAwarded !== null) {
    return (
      <PlayerFrame testID="leaf-complete" title={title}>
        <CompletionSummary
          xpAwarded={session.xpAwarded}
          firstTryCorrect={session.firstTryCorrect}
          capReached={session.capReached}
          unlocked={session.unlocked}
          onDone={leave}
        />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      testID="leaf-player"
      title={title}
      onClose={leave}
      progress={{ index: session.slideIndex, total: SLIDES.length }}
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          {session.slideIndex > 0 ? (
            <Button
              testID="leaf-back"
              label="Back"
              variant="secondary"
              onPress={session.back}
            />
          ) : null}

          <View style={{ flex: 1 }}>
            {session.isLastSlide ? (
              <Button
                testID="leaf-finish"
                label="Finish"
                busy={session.completing}
                onPress={() => {
                  session.complete(() => undefined);
                }}
              />
            ) : (
              <Button
                testID="leaf-next"
                label="Next"
                // On the scenario slide with the payoff still locked there is no Next —
                // answering is the only way forward, and a disabled button says so
                // without pretending the slide is optional.
                disabled={!session.canAdvance}
                onPress={session.next}
              />
            )}
          </View>
        </View>
      }
    >
      {session.actionError === null ? null : (
        <View style={{ paddingBottom: theme.spacing.lg }}>
          <StatusMessage tone="error" testID="leaf-action-error" message={session.actionError} />
        </View>
      )}

      {session.slide === 'summary' ? <SummarySlide data={leaf.summary} /> : null}

      {session.slide === 'scenario' ? (
        <ScenarioSlide
          data={leaf.scenario}
          onSubmit={session.answer}
          busy={session.answering}
          wrongOptionIds={session.wrongOptionIds}
          correctOptionId={session.correctOptionId}
        />
      ) : null}

      {session.slide === 'payoff' ? (
        <PayoffSlide data={session.payoff} justUnlocked={session.justUnlocked} />
      ) : null}

      {session.slide === 'stickyNotes' ? <StickyNotesSlide data={leaf.stickyNotes} /> : null}

      {session.slide === 'takeaway' ? (
        <TakeawaySlide data={leaf.takeaway} onOpenDinnerTable={session.reportDinnerTableOpen} />
      ) : null}
    </PlayerFrame>
  );
}

/**
 * What the reader earned.
 *
 * The amount is shown, not just the fact — "first try" is worth more and a reader who
 * is not told the number cannot learn that answering carefully pays.
 */
function CompletionSummary({
  xpAwarded,
  firstTryCorrect,
  capReached,
  unlocked,
  onDone,
}: {
  readonly xpAwarded: number;
  readonly firstTryCorrect: boolean;
  readonly capReached: boolean;
  readonly unlocked: readonly UnlockedAchievement[];
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.lg, paddingTop: theme.spacing.xxl }}>
      <Icon name="success" size={44} color={theme.palette.reward} />

      <Text variant="display" align="center">
        Leaf complete
      </Text>

      {/* Zero is the replay case: the reader has been here before and the XP is already
          theirs. Saying "+0 XP" would read as a punishment for revisiting. */}
      {xpAwarded > 0 ? (
        <Text variant="h2" tone="reward" align="center" testID="leaf-xp">
          +{xpAwarded} XP
        </Text>
      ) : (
        <Text variant="body" tone="textMuted" align="center" testID="leaf-xp">
          You had already finished this one, so no new XP this time.
        </Text>
      )}

      {xpAwarded > 0 && firstTryCorrect ? (
        <Text variant="small" tone="textMuted" align="center" testID="leaf-first-try">
          First try — that is the bonus.
        </Text>
      ) : null}

      {/**
       * Below the XP, above the cap notice.
       *
       * The XP is what the reader was expecting and the badge is the surprise, so the
       * expected thing lands first and the surprise arrives underneath it. Putting the
       * badge on top would make the reader hunt for the number they came for — and the
       * cap notice stays last because it is the sentence that ends the session.
       */}
      <View style={{ alignSelf: 'stretch' }}>
        <AchievementUnlock achievements={unlocked} />
      </View>

      {/**
       * The daily cap, and it is not an error.
       *
       * PRODUCT.md treats stopping as a feature, so this reads as an ending rather than
       * a refusal: no warning tone, no "limit", no locked icon. The reader has just
       * finished something — the sentence should sound like the natural close of a
       * session, which is the only reason a wellbeing feature ever works.
       */}
      {capReached ? (
        <View
          testID="leaf-cap-reached"
          style={{
            alignSelf: 'stretch',
            marginTop: theme.spacing.lg,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.surfaceFor('card'),
            gap: theme.spacing.sm,
          }}
        >
          <Text variant="h3" align="center">
            That is today done
          </Text>
          <Text variant="small" tone="textMuted" align="center">
            You have finished your session for today. Come back tomorrow — the next Leaf
            will be waiting, and spacing it out is what makes it stick.
          </Text>
        </View>
      ) : null}

      <View style={{ alignSelf: 'stretch', paddingTop: theme.spacing.xl }}>
        <Button label="Done" onPress={onDone} testID="leaf-done" />
      </View>
    </View>
  );
}

/**
 * The chrome: a close control, a slide counter, the scrolling body and a fixed footer.
 *
 * The footer sits outside the `ScrollView` on purpose. At
 * `accessibilityExtraExtraExtraLarge` a payoff slide is several screens tall, and a
 * Next button that scrolls away leaves the reader hunting for it at the bottom of a
 * wall of text.
 */
function PlayerFrame({
  testID,
  title,
  children,
  footer,
  onClose,
  progress,
  centred = false,
}: {
  readonly testID: string;
  readonly title: string;
  readonly children?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly onClose?: () => void;
  readonly progress?: { index: number; total: number };
  readonly centred?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: theme.surfaceFor('page'),
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      >
        {onClose === undefined ? null : (
          <Pressable
            testID="leaf-close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close this Leaf"
            hitSlop={theme.spacing.md}
            style={{
              minWidth: MIN_TOUCH_TARGET,
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={24} color={theme.palette.textMuted} />
          </Pressable>
        )}

        <Text variant="caption" tone="textMuted" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Text>

        {progress === undefined ? null : (
          <Text variant="caption" tone="textMuted" testID="leaf-slide-count">
            {progress.index + 1} of {progress.total}
          </Text>
        )}
      </View>

      {centred ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
            flexGrow: 1,
          }}
        >
          {children}
        </ScrollView>
      )}

      {footer === undefined ? null : (
        <View
          style={{
            padding: theme.spacing.lg,
            borderTopWidth: theme.borderWidth.hairline,
            borderTopColor: theme.palette.border,
            backgroundColor: theme.surfaceFor('card'),
          }}
        >
          {footer}
        </View>
      )}
    </View>
  );
}
