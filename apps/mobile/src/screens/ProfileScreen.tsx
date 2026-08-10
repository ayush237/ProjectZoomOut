import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { Button, Screen, StatusMessage, Text } from '../components';
import { useTheme } from '../design';

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
