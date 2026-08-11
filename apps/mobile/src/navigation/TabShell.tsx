import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PixelRatio } from 'react-native';

import { Text } from '../components';
import { asTextGlyph } from '../components/glyphs';
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
 * The tab bar's height is fixed by React Navigation, so its glyphs must not scale.
 *
 * At `accessibilityExtraExtraExtraLarge` an unscaled-capped glyph rendered at roughly
 * 2.4× and was clipped to fragments by the bar — leaving four unreadable shapes above
 * four labels. The **labels still scale**, which is what carries the accessibility
 * requirement here; the icon is decoration beside them.
 *
 * Pre-dividing by the OS scale holds the glyph at a constant visual size, because React
 * Native multiplies it straight back. `allowFontScaling={false}` would be the obvious
 * tool and `Text` deliberately does not offer it — that escape hatch is how apps lose
 * scaling on real content.
 */
const TAB_GLYPH_SIZE = 18;

function glyph(symbol: string) {
  return function TabGlyph({ color }: { color: string }): React.JSX.Element {
    const size = TAB_GLYPH_SIZE / PixelRatio.getFontScale();

    return (
      // Hidden from screen readers: the tab's own label already announces it, and a
      // duplicate glyph would just be noise.
      <Text
        variant="h3"
        style={{ color, fontSize: size, lineHeight: size * 1.25 }}
        accessibilityElementsHidden
      >
        {asTextGlyph(symbol)}
      </Text>
    );
  };
}
