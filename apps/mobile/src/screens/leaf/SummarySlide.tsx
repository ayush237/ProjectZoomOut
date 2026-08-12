import { View } from 'react-native';
import type { SummarySlide as SummarySlideData } from '@zoomout/shared';

import { Text } from '../../components';
import { useTheme } from '../../design';

/**
 * Slide 1 of 5. Short text that sets up the scenario.
 *
 * Deliberately the plainest screen in the player. Its job is to be read and left — the
 * reader should arrive at the scenario with the setup in mind, not with a memory of the
 * layout.
 */
export function SummarySlide({ data }: { readonly data: SummarySlideData }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text variant="caption" tone="textMuted">
        Summary
      </Text>
      <Text variant="body">{data.body}</Text>
    </View>
  );
}
