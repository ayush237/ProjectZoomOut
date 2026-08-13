import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SessionSummary } from '@zoomout/shared';

import { useApi } from '../../auth/AuthProvider';
import { AchievementUnlock, Button, ErrorState, Screen, StatusMessage, Text } from '../../components';
import { useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { shareView, type ShareOutcome } from '../../share/shareImage';
import { useAsyncResource } from '../useAsyncResource';
import { ShareCard } from './ShareCard';

type WrapUpNavigation = NativeStackNavigationProp<AppStackParamList, 'WrapUp'>;

/**
 * The end of a reading day, and the app's only screen built to leave the app.
 *
 * **Wrapping up is a ceremony, not a lock** (ruled in the WP9 handoff). Tapping it
 * records `session_wrap`, unlocks `first-wrap`, and returns the reader to Journey — it
 * does **not** stop them reading. The daily cap is the hard stop; this is the ritual
 * ending, and locking someone out for tapping a celebratory button would be punitive and
 * surprising. A reader who wraps up and then wants one more Leaf gets one, and wrapping
 * twice in a day is fine: the summary reflects the day so far.
 *
 * **Opening this screen records nothing.** The summary is a `GET` and the wrap is a
 * separate `POST`, so arriving here from Journey to look at your day does not log an
 * ending you did not declare.
 *
 * **The cap leads here rather than to a second ending.** When the cap fires, the player
 * offers this same screen; two differently-styled endings to one day is worse than one
 * good one.
 */
export function WrapUpScreen(): React.JSX.Element {
  const api = useApi();
  const navigation = useNavigation<WrapUpNavigation>();

  const load = useCallback(async (): Promise<SessionSummary> => api.getSessionSummary(), [api]);
  const summary = useAsyncResource<SessionSummary>(load);

  if (summary.status === 'loading') {
    return (
      <Screen testID="wrap-up-loading" scrollable={false} centred>
        <Text variant="body" tone="textMuted">
          Gathering your day…
        </Text>
      </Screen>
    );
  }

  if (summary.status === 'error' || summary.data === null) {
    return (
      <Screen testID="wrap-up-screen">
        <ErrorState
          testID="wrap-up-error"
          message={summary.error ?? 'Could not load your day.'}
          onRetry={summary.reload}
        />
      </Screen>
    );
  }

  return (
    <WrapUpView
      summary={summary.data}
      onDone={() => {
        navigation.goBack();
      }}
    />
  );
}

function WrapUpView({
  summary,
  onDone,
}: {
  readonly summary: SessionSummary;
  readonly onDone: () => void;
}): React.JSX.Element {
  const api = useApi();
  const theme = useTheme();

  /** Points at the card, which is what gets photographed — not the whole screen. */
  const cardRef = useRef<View>(null);

  const [sharing, setSharing] = useState(false);
  const [wrapping, setWrapping] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const [unlocked, setUnlocked] = useState(summary.achievements.map(withoutTime));
  const [notice, setNotice] = useState<string | null>(null);

  const share = useCallback(() => {
    setSharing(true);
    setNotice(null);

    void (async () => {
      const outcome: ShareOutcome = await shareView({
        target: cardRef,
        dialogTitle: 'Share your day',
      });

      // Cancelling is silent by design — see `ShareOutcome`. Only the two genuine
      // failures say anything, and neither leaves the screen unusable.
      if (outcome.status === 'unavailable') {
        setNotice('Sharing is not available on this device.');
      } else if (outcome.status === 'failed') {
        setNotice(outcome.message);
      }

      setSharing(false);
    })();
  }, []);

  const wrapUp = useCallback(() => {
    setWrapping(true);
    setNotice(null);

    void (async () => {
      try {
        const outcome = await api.recordEvent('session_wrap');

        setUnlocked((current) => [...current, ...outcome.unlocked]);
        setWrapped(true);
      } catch {
        // The ceremony failed, and that is all it was. Nothing about the reader's day
        // is lost, so this says so plainly and leaves the button usable.
        setNotice('Could not close out your day. Your progress is safe — try again.');
      } finally {
        setWrapping(false);
      }
    })();
  }, [api]);

  const leafCount = summary.leaves.length;
  const book = summary.leaves.at(-1)?.trackTitle ?? null;

  return (
    <Screen testID="wrap-up-screen">
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            Today
          </Text>
          <Text variant="display">
            {leafCount === 0 ? 'Nothing yet today' : 'That is a session'}
          </Text>
          {leafCount === 0 ? (
            <Text variant="body" tone="textMuted">
              Finish a Leaf and this becomes something worth sharing.
            </Text>
          ) : null}
        </View>

        {notice === null ? null : (
          <StatusMessage tone="error" message={notice} testID="wrap-up-notice" />
        )}

        {/* Centred so the card reads as an object on the screen rather than as the
            screen itself — it is about to become an image somewhere else. */}
        <View style={{ alignItems: 'center' }}>
          <ShareCard
            ref={cardRef}
            eyebrow={summary.session.capReached ? 'That is today done' : 'Today'}
            headline={headlineFor(summary)}
            subtitle={book === null ? 'A ZoomOut session' : book}
            detail={summary.leaves.slice(0, 3).map((leaf) => leaf.title)}
          />
        </View>

        <AchievementUnlock achievements={unlocked} testID="wrap-up-unlocks" />

        <View style={{ gap: theme.spacing.md }}>
          <Button
            testID="wrap-up-share"
            label="Share this"
            onPress={share}
            busy={sharing}
            disabled={leafCount === 0}
          />

          {wrapped ? (
            <Text variant="body" align="center" testID="wrap-up-done">
              Your day is closed out. Come back tomorrow.
            </Text>
          ) : (
            <>
              <Button
                testID="wrap-up-confirm"
                label="Wrap up today"
                variant="secondary"
                onPress={wrapUp}
                busy={wrapping}
              />
              <Text variant="small" tone="textMuted" align="center">
                Closing out is a ritual, not a lock — you can still read more if you want to.
              </Text>
            </>
          )}

          {/**
           * Always present, whether or not the day has been wrapped.
           *
           * Found on device: with no completions yet, the only way off this screen was
           * the iOS edge-swipe — an invisible affordance, and one Android does not have
           * at all. A reader who opens the summary to look at it and does not want to
           * end their day needs a visible way back, and the label stays "Back to
           * Journey" rather than anything final because wrapping up is not a lock.
           */}
          <Button
            label="Back to Journey"
            variant="secondary"
            onPress={onDone}
            testID="wrap-up-exit"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * The one line that has to survive being shrunk to a thumbnail.
 *
 * The streak wins when there is one, because a number of consecutive days is the most
 * legible and the most human thing on the card; XP is a game currency that means nothing
 * to a stranger. Leaf count is the fallback for a reader on their first day.
 */
function headlineFor(summary: SessionSummary): string {
  if (summary.streak.current > 1) {
    return `${String(summary.streak.current)}-day streak`;
  }

  const count = summary.leaves.length;

  if (count === 0) {
    return 'No Leaves yet';
  }

  return count === 1 ? '1 Leaf today' : `${String(count)} Leaves today`;
}

/**
 * The summary reports achievements earned today without per-badge timestamps, while the
 * unlock banner renders `UnlockedAchievement`. The day's own date is the honest stamp
 * for something the screen is already grouping under "today".
 */
function withoutTime(achievement: SessionSummary['achievements'][number]): {
  id: string;
  name: string;
  description: string;
  tier: 'common' | 'rare' | 'milestone';
  unlockedAt: string;
} {
  return { ...achievement, unlockedAt: new Date().toISOString() };
}
