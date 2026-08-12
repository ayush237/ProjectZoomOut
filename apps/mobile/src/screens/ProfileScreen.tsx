import { useCallback, useState } from 'react';
import { View } from 'react-native';

import type { DayStatus } from '../api/client';
import { useApi, useAuth } from '../auth/AuthProvider';
import { Button, Icon, Screen, StatusMessage, Text } from '../components';
import { useTheme } from '../design';
import { useAsyncResource } from './useAsyncResource';

/**
 * The only real tab in WP6.
 *
 * Shows what the account actually is and offers the way out. Everything else a profile
 * will eventually carry — XP, streak, achievements — belongs to WP5 and WP9, and
 * stubbing it here would give WP7 a shape to build against that is going to change.
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

  if (day.status !== 'ready' || day.data === null) {
    return null;
  }

  const { streak, session } = day.data;

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
