/**
 * Navigation shapes.
 *
 * Kept in their own module so screens can type their props without importing the
 * navigators, which would make every screen a cycle back to the tree that renders it.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  /**
   * The age gate, shared by both signup paths.
   *
   * **Carries which path it is on, and nothing else.** It used to take the whole email
   * signup draft, which put a plaintext password into React Navigation's serialisable
   * navigation state — inert until state persistence or crash reporting is switched on,
   * and a credential leak the moment either is. The draft now lives in
   * `SignUpDraftProvider`; only this discriminator travels, and it is safe to persist.
   *
   * One screen rather than two because the age gate is not an email-signup step: it is
   * a compliance boundary every new account crosses, and Apple and Google supply
   * neither a date of birth nor a timezone.
   */
  AgeGate: { readonly mode: 'email' | 'social' };
  AgeRefused: undefined;
  ProviderEmailMissing: undefined;
};

export type TabParamList = {
  Profile: undefined;
  Explore: undefined;
  Library: undefined;
  Journey: undefined;
};

/**
 * The signed-in stack, with the tab shell as its root.
 *
 * The Leaf player is pushed **over** the tabs rather than living inside one. A Leaf is
 * reachable from both Journey and Library, so putting it in either tab's stack would
 * give it two identities and a back button that returns to the wrong place. Presented
 * over the shell it has one route, and the tab a reader came from is still underneath
 * when they finish.
 */
export type AppStackParamList = {
  /**
   * Undefined keeps every existing call working as it always has — `navigate('Tabs')`
   * returns to whichever tab was already focused. The nested form (WP26) is additive:
   * `navigate('Tabs', { screen: 'Explore' })` is how "Find your next book" reaches
   * Explore specifically rather than wherever the reader was before the Leaf player.
   */
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  /**
   * **Ids and a title only.** React Navigation's state is serialisable and may be
   * persisted or attached to a crash report, so route params carry references, never
   * content — the same rule that moved the signup password out of `AgeGate` in WP6.
   * The player fetches the Leaf itself, which is also what keeps the payoff gate on the
   * server: a params-passed Leaf would be a Leaf the client already holds.
   */
  LeafPlayer: {
    readonly leafId: string;
    readonly trackId: string;
    readonly trackTitle: string;
    /**
     * Set by exactly one caller — the first-run flow's pick-book beat (ONBOARD-3) — to say
     * "this is the reader's first Leaf, and finishing it closes their onboarding".
     * **Presence is the whole signal:** `true` or absent, never `false`, so there is no
     * second value to read the wrong way. A serialisable flag rather than content, so the
     * rule above still holds.
     *
     * It carries the closing moment from here to `WrapUp` through the player's completion
     * exits. It does not come from an achievement: `first-wrap` unlocks when the reader
     * *taps* wrap, which is after `WrapUp` has already opened, so it cannot tell the
     * screen what to show.
     */
    readonly onboarding?: true;
  };
  /**
   * The end-of-day summary (WP9). No params: the screen fetches the day itself, and
   * "today" is the server's answer from the reader's stored timezone. Passing a date
   * here would put a second opinion about the reader's day into navigation state.
   */
  /**
   * One book's detail page (WP10) — where the non-endorsement disclaimer and the
   * purchase-forward links are shown. Id only; the screen fetches the Track, so a
   * withdrawn book fails the same way everywhere else does.
   */
  TrackDetail: { readonly trackId: string };
  /**
   * `onboarding: true` — and only that — turns on the closing message (ONBOARD-3): the
   * reader has just finished their first Leaf, and this is where their onboarding ends.
   * Every other way here (Journey, the cap's "See your day" for an ordinary reader) passes
   * nothing and sees the screen exactly as before. The flag is a route param and not
   * something the screen works out for itself, because nothing the screen can read
   * distinguishes "the first Leaf just ended" from "an ordinary day just ended".
   */
  WrapUp: { readonly onboarding?: true } | undefined;
  /**
   * One achievement, framed for sharing.
   *
   * Carries the badge's *presentation* rather than an id, because the caller already
   * holds the whole thing — it arrived in the response of the action that earned it —
   * and re-fetching it by id to render a screen the reader is already looking at would
   * be a round trip for nothing. Still no prose or credentials, so it stays safe to
   * persist as navigation state.
   */
  AchievementShare: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly tier: 'common' | 'rare' | 'milestone';
  };
  /**
   * Finishing an entire book (WP26). Id only, same reasoning as `TrackDetail`: the
   * screen fetches the Track, its Leaves and the reader's standing fresh rather than
   * trusting whatever the player already held, so a completion reached by any other
   * route than "just finished the last Leaf" still renders correctly.
   */
  TrackComplete: { readonly trackId: string };

  /**
   * The activation flow (ONBOARD-1, reordered in ONBOARD-3). For a new account:
   * `OnboardingIntro` → `OnboardingPromise` → `OnboardingNarrator` → `OnboardingPickBook`
   * → the first Leaf (`LeafPlayer`, an action rather than a screen of its own) → `WrapUp`'s
   * closing. For an existing account: `OnboardingNarrator` alone.
   *
   * Registered on this stack, not a separate navigator, precisely so the pick-book beat
   * can reach `LeafPlayer` by name — a second navigator would need its own copy of that
   * screen or a cross-navigator jump neither React Navigation nor this codebase's existing
   * shape supports. `RootNavigator` picks which of these (or `Tabs`) the stack **opens**
   * on via `initialRouteName`, the same mechanism `AuthStack` already uses for the
   * social-signup age gate.
   *
   * None of them carries params. What each beat needs to know that is not a route is
   * handed to it as a prop by `AppStack` (`markSeen`, and the narrator beat's variant),
   * for the same reason `AppStack` gives: those are app state, not navigation state.
   */
  OnboardingIntro: undefined;
  OnboardingPromise: undefined;
  OnboardingNarrator: undefined;
  OnboardingPickBook: undefined;
};
