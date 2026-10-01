import { NavigationContext } from '@react-navigation/native';
import { Fragment, useContext, useEffect, useRef } from 'react';
import { NARRATOR_IDS, type NarratorId, type NarratorSamples } from '@zoomout/shared';

import { useNarration, type Narration } from '../audio';

/** What a screen needs to draw one narrator's card. */
export interface NarratorCardState {
  readonly narrator: NarratorId;
  /** This narrator is the reader's current pick. */
  readonly selected: boolean;
  /**
   * The hello is loaded, so pressing the card plays it. `false` means pressing only
   * chooses — the card should not offer a play control it cannot honour.
   */
  readonly playable: boolean;
  readonly playing: boolean;
  /**
   * The last attempt to play this hello failed (a missing file, a decode error). Only
   * ever `true` when `playable`; a further press tries again and clears it.
   */
  readonly playbackFailed: boolean;
  /** Chooses this narrator and, when `playable`, plays or pauses its hello. */
  readonly onPress: () => void;
}

export interface NarratorPreviewProps {
  /** Both hellos — or `null` while they load or could not be loaded: the cards then only choose. */
  readonly samples: NarratorSamples | null;
  readonly selected: NarratorId;
  /** Called on every press, whether or not there is anything to play. */
  readonly onSelect: (narrator: NarratorId) => void;
  /** Draws one card. Called once per narrator, in `NARRATOR_IDS` order. */
  readonly renderCard: (card: NarratorCardState) => React.JSX.Element;
}

/**
 * Both narrators' cards and everything that happens when one is pressed (ONBOARD-3.1) —
 * shared by the onboarding beat and Profile's narrator card, so the behaviour below exists
 * once and the two screens differ only in how a card looks.
 *
 * **Renders a fragment of cards and leaves the row to the caller**, so each screen keeps its
 * own layout and its own card; `renderCard` is the seam. Nothing here draws anything.
 *
 * **Two branches, and the split is forced.** A player exists only inside `useNarration`, and
 * `useAudioPlayer` creates its native player once, from the first source it is given (see
 * `useNarration`'s own docstring). So the hooks cannot be called while the hellos are still
 * on their way and then be pointed at them: they live in `PlayableNarrators`, which is
 * mounted only once there are two clips to hand it. Until then — loading, or a failed fetch
 * — the cards are the same cards with **no player behind them**, and a press only chooses.
 * That is what lets the beat fail open: it never needs a clip to let a reader carry on.
 *
 * **`samples` is treated as fixed for the life of a mount.** Both callers unmount the
 * playable branch whenever the fetch is redone (the beat swaps to its spinner; Profile never
 * refetches), so a player is never asked to change source under it. If a caller ever
 * refreshes hellos in place, this needs a `key` on the URLs, as `NarrationControl` has.
 */
export function NarratorPreview({
  samples,
  selected,
  onSelect,
  renderCard,
}: NarratorPreviewProps): React.JSX.Element {
  if (samples === null) {
    return (
      <>
        {NARRATOR_IDS.map((narrator) => (
          <Fragment key={narrator}>
            {renderCard({
              narrator,
              selected: selected === narrator,
              playable: false,
              playing: false,
              playbackFailed: false,
              onPress: () => {
                onSelect(narrator);
              },
            })}
          </Fragment>
        ))}
      </>
    );
  }

  return (
    <PlayableNarrators
      samples={samples}
      selected={selected}
      onSelect={onSelect}
      renderCard={renderCard}
    />
  );
}

/**
 * The two players, and the rules that keep them from talking over each other or over
 * whatever the reader does next.
 *
 * **The two `useNarration` calls live here, side by side, and not one per card** — so a card
 * can stop the other. Two five-second hellos overlapping is not an introduction, and the
 * natural way to compare two voices is to tap one and then the other. Each is called
 * unconditionally, in a fixed order, on a closed pair of narrators (`Record<NarratorId, …>`
 * turns a third into a compile error), so the rules of hooks hold by construction.
 *
 * **Plays that narrator's clip regardless of the reader's stored preference** — the reason
 * `useNarration` is exported on its own: `NarrationControl` picks the *stored* narrator's
 * clip, which cannot be pointed at "whichever card was tapped".
 *
 * **A clip stops when the screen loses focus, for any reason.** In the beat's `full` variant
 * Continue *pushes* the next screen over it, so the beat stays mounted and a clip still
 * playing would finish over the top; a Profile tab switch is the same. Unmounting already
 * stops a clip (`useNarration` pauses in its cleanup), which is why this is a `blur`
 * listener and not a second unmount hook. It reads the players through a ref because the
 * listener is registered once and must never act on a stale `playing`/`toggle` pair —
 * `toggle` on a stale "not playing" would *start* the clip it meant to stop.
 *
 * **The limit this inherits, and does not fix:** `playing` turns true only once audio is
 * flowing, so a clip still *buffering* when the screen is left, or when the other card is
 * tapped, is not stopped by either rule and then plays over what follows. `useNarration`
 * has no separate `pause`, and how it behaves also drives the Leaf player, so that is left
 * to a later package if it is ever heard.
 */
function PlayableNarrators({
  samples,
  selected,
  onSelect,
  renderCard,
}: {
  readonly samples: NarratorSamples;
  readonly selected: NarratorId;
  readonly onSelect: (narrator: NarratorId) => void;
  readonly renderCard: (card: NarratorCardState) => React.JSX.Element;
}): React.JSX.Element {
  // Read from context rather than `useFocusEffect`, which throws outside a navigator — the
  // same reason `useRefreshOnFocus` does. Outside one there is no focus to lose.
  const navigation = useContext(NavigationContext);

  const female = useNarration(samples.female);
  const male = useNarration(samples.male);
  const players: Record<NarratorId, Narration> = { female, male };

  const latest = useRef(players);
  useEffect(() => {
    latest.current = players;
  });

  useEffect(() => {
    if (navigation === undefined) {
      return undefined;
    }

    return navigation.addListener('blur', () => {
      for (const narrator of NARRATOR_IDS) {
        const player = latest.current[narrator];

        if (player.playing) {
          // `toggle` on a playing clip pauses it — the hook has no separate `pause`.
          player.toggle();
        }
      }
    });
  }, [navigation]);

  const press = (narrator: NarratorId): void => {
    onSelect(narrator);

    for (const other of NARRATOR_IDS) {
      if (other !== narrator && players[other].playing) {
        players[other].toggle();
      }
    }

    players[narrator].toggle();
  };

  return (
    <>
      {NARRATOR_IDS.map((narrator) => (
        <Fragment key={narrator}>
          {renderCard({
            narrator,
            selected: selected === narrator,
            playable: true,
            playing: players[narrator].playing,
            playbackFailed: players[narrator].playbackFailed,
            onPress: () => {
              press(narrator);
            },
          })}
        </Fragment>
      ))}
    </>
  );
}
