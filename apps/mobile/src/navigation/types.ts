/**
 * Navigation shapes.
 *
 * Kept in their own module so screens can type their props without importing the
 * navigators, which would make every screen a cycle back to the tree that renders it.
 */

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
  Tabs: undefined;
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
  WrapUp: undefined;
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
};
