import { Pressable, View } from 'react-native';
import { NARRATOR_LABELS, type AudioRef, type NarratorId } from '@zoomout/shared';

import { Icon, StatusMessage, Text } from '../components';
import { MIN_TOUCH_TARGET, useTheme } from '../design';
import { selectNarration } from './selectNarration';
import { useNarration } from './useNarration';
import { useNarrator } from './useNarrator';

export interface NarrationControlProps {
  readonly audio: readonly AudioRef[] | undefined;
  /** Names the slide in the accessibility label — "Summary", "Scenario", "Payoff",
   *  "Takeaway". */
  readonly label: string;
}

/**
 * Plays a slide's narration in the reader's chosen narrator (VO-3).
 *
 * **One component, used identically on all four narrated slides** — `SlideFrame` is
 * not the right seam for it, because `PayoffSlide` deliberately does not use
 * `SlideFrame` at all (WP23.1), so each slide places this directly instead.
 *
 * **Renders nothing when there is no clip for the current narrator.** The same rule
 * `optionalImage`/`SlideImage` already apply to every other asset a Leaf might not
 * carry: most Tracks have no narration at all today (VO-2 was Ikigai only), and a
 * persistent "narration unavailable" label under every slide of every one of them
 * would be noise, not information. A slide missing the preferred narrator's clip and a
 * slide with no audio at all therefore collapse to the same rendered nothing — which is
 * also the founder's rule that a reader who picks one narrator must never be handed the
 * other mid-book: there is no fallback branch here that could reach for it.
 *
 * **Deliberately two components, not one.** `useNarrator()`'s preference read is
 * async (a SecureStore round trip), so the very first render always sees the
 * hard-coded default, however briefly, before the reader's real choice arrives.
 * Deciding *whether* to render anything happens here, with no player created yet;
 * `NarrationButton` below owns the player and is **keyed on `entry.url`**, so a
 * narrator resolving to a different clip after that first render unmounts the old
 * button (stopping its clip, via the same cleanup `useNarration` already runs on any
 * unmount) and mounts a fresh one bound to the right source from the start — see
 * `useNarration`'s own docstring for why a single long-lived player cannot safely
 * switch sources under it.
 */
export function NarrationControl({ audio, label }: NarrationControlProps): React.JSX.Element | null {
  const { narrator } = useNarrator();
  const entry = selectNarration(audio, narrator);

  if (entry === undefined) {
    return null;
  }

  return <NarrationButton key={entry.url} entry={entry} narrator={narrator} label={label} />;
}

function NarrationButton({
  entry,
  narrator,
  label,
}: {
  readonly entry: AudioRef;
  readonly narrator: NarratorId;
  readonly label: string;
}): React.JSX.Element {
  const theme = useTheme();
  const narration = useNarration(entry);
  const action = narration.playing ? 'Pause' : 'Play';

  return (
    <View style={{ alignItems: 'flex-start', gap: theme.spacing.sm }}>
      <Pressable
        testID="narration-control"
        onPress={narration.toggle}
        accessibilityRole="button"
        // The narrator's name, from the one shared map (ONBOARD-3) — a screen-reader
        // reader hears "Lara's voice", never "Female voice" and never a provider voice id.
        // This label is the only place the name is spoken here, and it cannot be observed
        // on screen, so `NarrationControl.test.tsx` pins it.
        accessibilityLabel={`${action} ${label} narration, ${NARRATOR_LABELS[narrator].name}'s voice`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: theme.spacing.sm,
          minHeight: MIN_TOUCH_TARGET,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.full,
          backgroundColor: pressed ? theme.surfaceFor('pressed') : theme.surfaceFor('raised'),
        })}
      >
        <Icon name={narration.playing ? 'pause' : 'play'} tone="primary" size={22} />
        <Text variant="caption" tone="primary">
          {narration.playing ? 'Playing narration' : 'Play narration'}
        </Text>
      </Pressable>

      {/* Modest and transient by design (Part C) — never a modal, never a persistent
          banner: it reflects `playbackFailed` directly and disappears the moment a
          retry succeeds, the same "couldn't do X" idiom `StatusMessage` already carries
          on twelve other screens. `error`, not `incorrect` — a failed play is not a
          wrong answer. */}
      {narration.playbackFailed ? (
        <StatusMessage
          tone="error"
          testID="narration-playback-error"
          message={`Couldn't play ${label.toLowerCase()} narration.`}
        />
      ) : null}
    </View>
  );
}
