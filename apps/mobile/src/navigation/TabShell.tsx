import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon, type IconName } from '../components';
import { useTheme } from '../design';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { JourneyScreen } from '../screens/JourneyScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import type { TabParamList } from './types';

const Tabs = createBottomTabNavigator<TabParamList>();

/**
 * The signed-in shell.
 *
 * Explore leads because it is where a reader with an empty library has something to do.
 * Profile is last, where a settings-shaped destination belongs.
 *
 * Every tab is labelled as well as iconed, so nothing depends on reading the symbol.
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
        options={{ tabBarIcon: icon('explore') }}
      />
      <Tabs.Screen
        name="Library"
        component={LibraryScreen}
        options={{ tabBarIcon: icon('library') }}
      />
      <Tabs.Screen
        name="Journey"
        component={JourneyScreen}
        options={{ tabBarIcon: icon('journey') }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: icon('profile') }}
      />
    </Tabs.Navigator>
  );
}


/**
 * Tab icons come from the shared `Icon` component, which does not scale with the OS
 * text size — the bar's height is fixed by React Navigation, and a scaled icon is
 * clipped to a fragment. The **labels still scale**, and they are what carries the
 * accessibility requirement here.
 */
function icon(name: IconName) {
  return function TabIcon({ color }: { color: string }): React.JSX.Element {
    // `color` comes from the navigator's active/inactive tint. Passing it through is
    // what makes the selected tab legible — the thing WP6's emoji glyphs silently lost.
    return <Icon name={name} size={22} color={color} />;
  };
}
