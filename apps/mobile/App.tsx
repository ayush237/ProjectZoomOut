import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { ThemeProvider, useTheme } from './src/design';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SoundProvider } from './src/sound/SoundProvider';

/**
 * The app root.
 *
 * Provider order matters and is not arbitrary: the theme wraps everything, because the
 * loading state below needs a surface colour too — a white flash before the dark theme
 * mounts is the most visible bug an app like this can ship, and it happens exactly when
 * the theme sits inside the thing that waits for fonts.
 */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppBody />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppBody(): React.JSX.Element {
  const theme = useTheme();

  // Two families, six weights — the ceiling `design-direction.md` §4 sets, because font
  // files are startup cost in React Native.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  /**
   * A font that fails to load must not be a blank app.
   *
   * `fontError` is treated as "carry on with the system font" rather than as fatal.
   * The type scale still applies — sizes, weights and line heights are ours — so the
   * app is merely off-brand instead of unusable, which is the right trade for a
   * cosmetic dependency on a network fetch.
   */
  const ready = fontsLoaded || fontError !== null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceFor('page') }}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />

      {ready ? (
        <AuthProvider>
          {/* Outside the navigator so the setting survives every screen, and so WP5's
              streak and achievement cues have the same provider to reach for. */}
          <SoundProvider>
            <RootNavigator />
          </SoundProvider>
        </AuthProvider>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.primary} />
        </View>
      )}
    </View>
  );
}
