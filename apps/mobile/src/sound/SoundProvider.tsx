import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { SOUND_ASSETS, type SoundAssetMap, type SoundCue } from './soundCues';

/**
 * Sound, as a port with a no-op adapter.
 *
 * **No audio library is installed, on purpose.** The ruling is that this package builds
 * the layer and ships no assets; pulling in `expo-audio` to play nothing would add an
 * upgrade-hazard dependency for zero behaviour. `SoundPlayer` is the seam — when files
 * arrive, one adapter implements it and `SoundProvider` takes it as a prop. Nothing in
 * the Leaf player changes.
 *
 * **The hardware silent switch is the adapter's job, not this file's.** On iOS it is
 * honoured by choosing a non-mixing audio session category rather than by reading a
 * flag — there is no supported API that reports the switch position, and every library
 * that claims to is inferring it. Writing a check here would be writing a lie; the
 * contract is recorded on `SoundPlayer` so whoever builds the adapter cannot miss it.
 */

export interface SoundPlayer {
  /**
   * Plays a cue, or does nothing if it has no asset.
   *
   * Must never throw and never block: it is called from animation callbacks and from
   * the answer round trip, where a rejected promise would surface as an unhandled
   * rejection in the middle of the product's best moment.
   *
   * **Implementations must configure the audio session so the hardware silent switch
   * is respected** — on iOS that means an ambient category, not `playback`.
   */
  play(cue: SoundCue): void;
}

/** The shipped adapter: correct trigger points, no audible output. */
export class SilentSoundPlayer implements SoundPlayer {
  constructor(private readonly assets: SoundAssetMap = SOUND_ASSETS) {}

  public play(cue: SoundCue): void {
    if (this.assets[cue] === null) {
      return;
    }

    // Unreachable until assets land, and deliberately not a throw: a missing player
    // must never be able to break a Leaf.
    void cue;
  }
}

/** Records what was asked for. Exported for tests, which assert cues, not audio. */
export class RecordingSoundPlayer implements SoundPlayer {
  public readonly played: SoundCue[] = [];

  public play(cue: SoundCue): void {
    this.played.push(cue);
  }
}

interface SoundContextValue {
  readonly enabled: boolean;
  /** Properties, not methods — these are `useCallback`s and get passed as callbacks. */
  readonly setEnabled: (enabled: boolean) => void;
  readonly play: (cue: SoundCue) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

const SOUND_ENABLED_KEY = 'zoomout.soundEnabled';

export interface SoundProviderProps {
  readonly children: React.ReactNode;
  /** Swap point for the real adapter, and for tests. */
  readonly player?: SoundPlayer;
}

export function SoundProvider({ children, player }: SoundProviderProps): React.JSX.Element {
  const [enabled, setEnabledState] = useState(true);
  const active = useMemo(() => player ?? new SilentSoundPlayer(), [player]);

  /**
   * The setting survives a cold start.
   *
   * SecureStore rather than AsyncStorage only because it is the key/value store this
   * app already has — a sound preference is not a secret, and nothing here depends on
   * the encryption. Adding a second storage dependency for one boolean would be the
   * worse trade.
   */
  useEffect(() => {
    let active2 = true;

    void SecureStore.getItemAsync(SOUND_ENABLED_KEY).then((stored) => {
      if (active2 && stored !== null) {
        setEnabledState(stored === 'true');
      }
    });

    return () => {
      active2 = false;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    void SecureStore.setItemAsync(SOUND_ENABLED_KEY, next ? 'true' : 'false');
  }, []);

  const play = useCallback(
    (cue: SoundCue) => {
      if (enabled) {
        active.play(cue);
      }
    },
    [active, enabled],
  );

  const value = useMemo<SoundContextValue>(
    () => ({ enabled, setEnabled, play }),
    [enabled, setEnabled, play],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/**
 * Sound, from anywhere in the tree.
 *
 * Returns a working no-op outside a provider rather than throwing. A missing provider
 * is a wiring mistake that should show up in a test, not a crash that takes down a
 * Leaf mid-session over a sound that currently does not play.
 */
export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);

  return context ?? FALLBACK;
}

const FALLBACK: SoundContextValue = {
  enabled: false,
  setEnabled: () => undefined,
  play: () => undefined,
};
