import { View } from 'react-native';
import type { StickyNotesSlide as StickyNotesSlideData } from '@zoomout/shared';

import { Icon, Text } from '../../components';
import { useTheme } from '../../design';

/**
 * Slide 4 of 5. Two to six notes on a board.
 *
 * Each note is its own raised surface rather than a bullet in a list, because the
 * metaphor is the point — these are the things a reader would have jotted down, and a
 * list of dashes reads as an appendix to the payoff instead of a distinct artefact.
 *
 * A single column, not a masonry grid. Notes vary from a few words to a couple of
 * sentences, and at `accessibilityExtraExtraExtraLarge` any two-column arrangement
 * either clips or leaves one column nearly empty — the seeded corpus varies note counts
 * from two to six precisely so that was visible before it shipped.
 */
export function StickyNotesSlide({
  data,
}: {
  readonly data: StickyNotesSlideData;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name="note" size={18} color={theme.palette.textMuted} />
        <Text variant="caption" tone="textMuted">
          {data.notes.length === 1 ? '1 note' : `${String(data.notes.length)} notes`}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }} accessibilityRole="list">
        {data.notes.map((note, index) => (
          <View
            // Notes have no ids in the domain model and their text is not guaranteed
            // unique, so the index is the only stable key available. The list is never
            // reordered or filtered, which is what makes that safe here.
            key={`note-${String(index)}`}
            accessibilityRole="text"
            style={{
              backgroundColor: theme.surfaceFor('raised'),
              borderRadius: theme.radius.lg,
              borderLeftWidth: theme.borderWidth.focus * 2,
              borderLeftColor: theme.palette.rewardSoft,
              padding: theme.spacing.lg,
            }}
          >
            <Text variant="body">{note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
