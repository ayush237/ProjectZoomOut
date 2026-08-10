import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Text } from '../components';
import { useTheme } from '../design';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ExploreScreen, JourneyScreen, LibraryScreen } from '../screens/shells';
import type { TabParamList } from './types';

const Tabs = createBottomTabNavigator<TabParamList>();

/**
 * The signed-in shell.
 *
 * Explore leads because it is where a reader with an empty library has something to do.
 * Profile is last, where a settings-shaped destination belongs.
 *
 * Tab icons are text glyphs rather than an icon set. No icon library is installed yet,
 * and picking one is a WP7 decision made against real surfaces — glyphs keep the shell
 * honest in the meantime, scale with the OS font setting for free, and are trivially
 * replaceable. Each tab is labelled as well as glyphed, so nothing depends on reading
 * the symbol.
 */
export function TabShell(): React.JSX.Element {
  const theme = useTheme();

  return (
    <Tabs.Navigator
      initialRouteName="Explore"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.palette.primary,
        tabBarInactiveTintColor: theme.palette.textMuted,
        tabBarStyle: {
          // Elevation by surface, never a shadow — the tab bar sits above the page, so
          // it renders on the card surface with a hairline instead.
          backgroundColor: theme.surfaceFor('card'),
          borderTopColor: theme.palette.border,
          borderTopWidth: theme.borderWidth.hairline,
        },
        tabBarLabelStyle: theme.typography.caption,
      }}
    >
      <Tabs.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarIcon: glyph('◎') }}
      />
      <Tabs.Screen
        name="Library"
        component={LibraryScreen}
        options={{ tabBarIcon: glyph('❑') }}
      />
      <Tabs.Screen
        name="Journey"
        component={JourneyScreen}
        options={{ tabBarIcon: glyph('↗') }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: glyph('☺') }}
      />
    </Tabs.Navigator>
  );
}

/**
 * Forces **text presentation** on a glyph.
 *
 * Several of these characters have an emoji form, and iOS picks it by default: `↗` and
 * `☺` rendered as full-colour emoji in the simulator, which ignore `color` entirely — so
 * the active tab looked identical to the inactive ones on half the bar. U+FE0E is the
 * variation selector that asks for the monochrome glyph, which then takes the tint.
 */
const TEXT_PRESENTATION = '︎';

function glyph(symbol: string) {
  return function TabGlyph({ color }: { color: string }): React.JSX.Element {
    return (
      // Hidden from screen readers: the tab's own label already announces it, and a
      // duplicate glyph would just be noise.
      <Text variant="h3" style={{ color }} accessibilityElementsHidden>
        {`${symbol}${TEXT_PRESENTATION}`}
      </Text>
    );
  };
}
