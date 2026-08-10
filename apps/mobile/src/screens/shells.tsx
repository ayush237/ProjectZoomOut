import { EmptyState, Screen } from '../components';

/**
 * The three tabs with no content yet.
 *
 * They are shells, but not placeholders in the throwaway sense: each is composed around
 * the **reserved mascot slot** (`design-direction.md` §9), so when a character arrives
 * it is an asset swap inside `EmptyState` rather than a redesign of three screens.
 *
 * The copy is written as if the feature exists and is simply empty for this reader,
 * because that is what it will mean from WP7 onward — a Library with nothing in it
 * reads the same whether the feature is unbuilt or unused, and only one of those needs
 * rewriting later.
 */

export function ExploreScreen(): React.JSX.Element {
  return (
    <Screen testID="explore-screen" scrollable={false}>
      <EmptyState
        testID="explore-empty"
        placeholderGlyph="◎"
        title="Nothing to explore yet"
        body="Tracks arrive here once there are books to read. Each one turns a non-fiction book into about fifteen minutes of active recall."
      />
    </Screen>
  );
}

export function LibraryScreen(): React.JSX.Element {
  return (
    <Screen testID="library-screen" scrollable={false}>
      <EmptyState
        testID="library-empty"
        placeholderGlyph="❑"
        title="Your library is empty"
        body="Books you add from Explore will wait for you here, with your progress through each one."
      />
    </Screen>
  );
}

export function JourneyScreen(): React.JSX.Element {
  return (
    <Screen testID="journey-screen" scrollable={false}>
      <EmptyState
        testID="journey-empty"
        placeholderGlyph="↗"
        title="Your journey starts with one Leaf"
        body="Streaks, XP and everything you have learned will show up here once you finish your first session."
      />
    </Screen>
  );
}
