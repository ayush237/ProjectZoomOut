import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { AchievementStatus } from '@zoomout/shared';

import type { DayStatus } from '../api/client';
import { useApi, useAuth } from '../auth/AuthProvider';
import { Button, Icon, Screen, StatusMessage, Text } from '../components';
import { useTheme } from '../design';
import { useAsyncResource } from './useAsyncResource';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/**
 * The account, and now the reader's standing.
 *
 * WP6 shipped this as identity and a way out; WP5a added the streak and WP5b the
 * lifetime XP and the achievement grid. Each of the three cards loads independently and
 * fails silently, so the screen's original job — showing who you are signed in as and
 * letting you sign out — survives any one of them being unavailable.
 */
export function ProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async (): Promise<void> => {
    setError(null);
    setBusy(true);

    try {
      await signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign out.');
      setBusy(false);
    }
  };

  return (
    <Screen testID="profile-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            Profile
          </Text>
          <Text variant="display" testID="profile-display-name">
            {user?.displayName ?? 'Reader'}
          </Text>
        </View>

        {error === null ? null : <StatusMessage tone="error" message={error} testID="profile-error" />}

        <StreakCard />

        <AchievementGrid />

        <View
          style={{
            backgroundColor: theme.surfaceFor('card'),
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.palette.border,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          <Field label="Email" value={user?.email ?? '—'} />
          <Field
            label="Timezone"
            value={user?.timezone ?? '—'}
            testID="profile-timezone"
            hint="Read from your device. Your day rolls over at your local midnight."
          />
          <Field label="Signs in with" value={(user?.authProviders ?? []).join(', ') || '—'} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            testID="profile-sign-out"
            label="Sign out"
            variant="secondary"
            onPress={() => {
              void leave();
            }}
            busy={busy}
          />
          <Text variant="small" tone="textMuted" align="center">
            Signs you out on this device only.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/**
 * The streak, and how much of today is left.
 *
 * Loaded here rather than lifted into `AuthProvider`: it changes on every completion,
 * and a value cached at sign-in would be wrong for the whole session. Failure is
 * silent — Profile's job is the account, and a missing streak must not take the screen
 * down or block signing out.
 */
function StreakCard(): React.JSX.Element | null {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(async (): Promise<DayStatus> => api.getToday(), [api]);
  const day = useAsyncResource<DayStatus>(load);

  /**
   * Re-read on focus, as Library, Journey and Explore already do.
   *
   * Found on device: finish a Leaf, come back to Profile, and it still says "0 XP" and
   * "No streak yet" — the card had loaded once at mount and never again, so the numbers
   * were stale for the rest of the session. Every value here changes as a side effect of
   * reading, which is precisely the case tab focus exists to cover.
   */
  useRefreshOnFocus(day.refresh);

  if (day.status !== 'ready' || day.data === null) {
    return null;
  }

  const { streak, session, totalXp } = day.data;

  return (
    <View
      testID="profile-streak"
      style={{
        backgroundColor: theme.surfaceFor('card'),
        borderRadius: theme.radius.lg,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon name="journey" size={22} color={theme.palette.reward} />
        {/* `flex: 1` so the number and the label wrap rather than collide at XXXL. */}
        <Text variant="h2" tone="reward" testID="profile-streak-current" style={{ flex: 1 }}>
          {streak.current === 0
            ? 'No streak yet'
            : `${String(streak.current)}-day streak`}
        </Text>
      </View>

      <Text variant="small" tone="textMuted">
        {streak.current === 0
          ? 'Finish a Leaf today to start one.'
          : `Your longest is ${String(streak.longest)} days.`}
      </Text>

      {/**
       * Lifetime XP, summed server-side on every read.
       *
       * Shown next to the streak rather than in its own card: both answer "how am I
       * doing", and a third card between the streak and the achievements would push the
       * grid below the fold on a small screen at XXXL.
       */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <Text variant="h3" tone="reward" testID="profile-total-xp">
          {String(totalXp)} XP
        </Text>
        <Text variant="small" tone="textMuted">
          earned in total
        </Text>
      </View>

      {/**
       * Today's session, phrased as an amount done rather than an amount remaining.
       * "You have 200 XP left" invites a reader to go and spend it, which is the
       * opposite of what a wellbeing cap is for.
       */}
      <Text variant="small" tone={session.capReached ? 'reward' : 'textMuted'} testID="profile-today">
        {session.capReached
          ? 'You have finished today’s session.'
          : `${String(session.xpEarned)} XP today.`}
      </Text>
    </View>
  );
}

/**
 * The reader's achievements, locked ones included.
 *
 * **The locked tiles are the feature, not filler.** §3 of the proposal ships four
 * achievements that are unreachable with one 20-Leaf Track precisely so that a reader
 * can see what is still out there — hiding them would turn the grid into a list of
 * things already done, which is a receipt rather than a reason to come back.
 *
 * The catalogue comes from the server. The app holds no copy of the nineteen, so a
 * twentieth is a backend deploy rather than an app release.
 *
 * Fails silently, like the streak above it: Profile's job is the account, and a grid
 * that cannot load must not take the sign-out button down with it.
 */
function AchievementGrid(): React.JSX.Element | null {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(
    async (): Promise<readonly AchievementStatus[]> => api.listAchievements(),
    [api],
  );
  const achievements = useAsyncResource<readonly AchievementStatus[]>(load);

  // Same reason as the streak card: a badge earned in the player must be visible on
  // the very next visit to this tab, not after a restart.
  useRefreshOnFocus(achievements.refresh);

  if (achievements.status !== 'ready' || achievements.data === null) {
    return null;
  }

  const earned = achievements.data.filter((entry) => entry.unlockedAt !== null).length;

  return (
    <View testID="profile-achievements" style={{ gap: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          flexWrap: 'wrap',
        }}
      >
        <Icon name="achievement" size={22} color={theme.palette.reward} />
        <Text variant="h3" style={{ flex: 1 }}>
          Achievements
        </Text>
        <Text variant="caption" tone="textMuted" testID="profile-achievement-count">
          {earned} of {achievements.data.length}
        </Text>
      </View>

      {/**
       * A wrapping row of tiles rather than a fixed-column grid.
       *
       * A two-column grid with a hard width is what breaks at
       * `accessibilityExtraExtraExtraLarge` — the name wraps to four lines and the tiles
       * stop lining up. Letting them flow means a large text size simply produces fewer
       * per row.
       */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {achievements.data.map((entry) => (
          <AchievementTile key={entry.id} achievement={entry} />
        ))}
      </View>
    </View>
  );
}

/**
 * One tile.
 *
 * Locked and unlocked differ by **more than colour** — the icon changes shape and the
 * card loses its amber edge, so the state survives being read by someone who cannot
 * distinguish the tints. That is the same rule the scenario feedback follows.
 */
function AchievementTile({
  achievement,
}: {
  readonly achievement: AchievementStatus;
}): React.JSX.Element {
  const theme = useTheme();
  const unlocked = achievement.unlockedAt !== null;

  return (
    <View
      testID={`achievement-tile-${achievement.id}`}
      accessibilityLabel={`${achievement.name}. ${
        unlocked ? 'Unlocked.' : 'Locked.'
      } ${achievement.description}`}
      style={{
        flexGrow: 1,
        flexBasis: 140,
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.surfaceFor('card'),
        borderWidth: theme.borderWidth.hairline,
        borderColor: unlocked ? theme.palette.reward : theme.palette.border,
        opacity: unlocked ? 1 : 0.6,
      }}
    >
      <Icon
        name={unlocked ? 'achievement' : 'locked'}
        size={20}
        color={unlocked ? theme.palette.reward : theme.palette.textMuted}
      />
      <Text variant="caption" tone={unlocked ? 'textPrimary' : 'textMuted'}>
        {achievement.name}
      </Text>
      <Text variant="small" tone="textMuted">
        {achievement.description}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  hint,
  testID,
}: {
  label: string;
  value: string;
  hint?: string;
  testID?: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <Text variant="body" {...(testID === undefined ? {} : { testID })}>
        {value}
      </Text>
      {hint === undefined ? null : (
        <Text variant="small" tone="textMuted">
          {hint}
        </Text>
      )}
    </View>
  );
}
