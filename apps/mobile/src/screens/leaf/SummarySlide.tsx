import { View } from 'react-native';
import type { SummarySlide as SummarySlideData } from '@zoomout/shared';

import { Text } from '../../components';
import { useTheme } from '../../design';
import { SlideFrame } from './SlideFrame';

/**
 * Slide 1 of 5. Short text that sets up the scenario.
 *
 * Deliberately the plainest screen in the player. Its job is to be read and left — the
 * reader should arrive at the scenario with the setup in mind, not with a memory of the
 * layout.
 *
 * **No illustration slot (WP23.1).** `design/leaf_player/`'s mockup shows a dashed
 * "Optional illustration — or browse files" box here, but that is an editor affordance
 * captured by accident, not a reader-facing one — and `summarySlideSchema` has no image
 * field at all, so there is nothing to render even if it were. See `SlideImage`'s own
 * docstring for the general rule this follows.
 */
export function SummarySlide({ data }: { readonly data: SummarySlideData }): React.JSX.Element {
  const theme = useTheme();

  return (
    <SlideFrame>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="textMuted">
          Summary
        </Text>
        <Text variant="body">{data.body}</Text>
      </View>
    </SlideFrame>
  );
}
