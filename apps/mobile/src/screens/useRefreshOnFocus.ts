import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';

/**
 * Re-fetches when the reader comes back to a tab.
 *
 * React Navigation keeps tab screens **mounted** once visited, so a screen fetches on
 * first open and then never again. That is invisible on a single tab and obviously
 * wrong across four: add a book in Explore, switch to Library, and the book is not
 * there — the shelf is showing what it read before the book existed. Found in the
 * simulator, not in a test, because every component test mounts one screen in isolation
 * where the staleness cannot happen.
 *
 * Refreshes rather than reloads: what is already on screen stays while the request is
 * in flight, so returning to a tab does not flash a spinner over content that is
 * probably still correct.
 */
export function useRefreshOnFocus(refresh: () => void): void {
  /**
   * Read from context rather than through `useFocusEffect`, which throws outside a
   * navigator.
   *
   * Screens are rendered standalone in tests — deliberately, so a component test
   * exercises ZoomOut rather than React Navigation — and a hook that made that
   * impossible would push every screen test into mounting a navigator. Outside a
   * navigator there is simply no focus to react to, which is the honest behaviour.
   */
  const navigation = useContext(NavigationContext);

  useEffect(() => {
    if (navigation === undefined) {
      return undefined;
    }

    /**
     * No guard against an initial double-fetch, because there is nothing to guard.
     * A tab mounts *because* it was focused, so the listener attaches after that event
     * and never sees it. The only case that fires early is a preloaded screen, where
     * one extra request is a far better outcome than the alternative — skipping the
     * first return, which is the refresh the reader actually notices.
     */
    return navigation.addListener('focus', refresh);
  }, [navigation, refresh]);
}
