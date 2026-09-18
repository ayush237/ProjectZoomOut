import { setAudioModeAsync } from 'expo-audio';

/**
 * Configures the audio session for narration, explicitly rather than by default.
 *
 * **`playsInSilentMode: true` is the entire reason this file exists.** A phone in a
 * pocket with the ringer switch on silent is the single most common way a narration
 * feature ships broken — it works on the simulator and on a desk, and is silent on a
 * real phone. `expo-audio` documents this flag `true` by default today, but a reader's
 * ears must not depend on that staying true through a future SDK release: this is the
 * "configure explicitly; do not rely on a default" instruction, made concrete.
 *
 * **`shouldPlayInBackground: false` is also already the library default** — restated
 * here for the same reason, and because it records the decision: this app requests no
 * background-audio capability (a 15-minute foreground session has no use for one, and
 * the entitlement is a store-review surface for no gain). `useNarration`'s own
 * `AppState` listener is what actually enforces the stop; this is the belt to that
 * braces, not a substitute for it.
 *
 * Narration is deliberate, requested playback — unlike `SoundProvider`'s UI cues, which
 * are meant to respect the silent switch — so this is the one place in the app that
 * asks for the opposite of `SoundProvider`'s ambient behaviour, on purpose.
 */
export function configureNarrationAudioSession(): Promise<void> {
  return setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
}
