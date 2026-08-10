import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { ThemeMode } from '../../design';
import { AgeGateScreen } from './AgeGateScreen';
import { AgeRefusedScreen } from './AgeRefusedScreen';
import { ProviderEmailMissingScreen } from './ProviderEmailMissingScreen';
import { SignInScreen } from './SignInScreen';

/**
 * The auth screens, rendered.
 *
 * Screens are rendered directly with a stubbed navigation prop rather than through the
 * navigators. What is under test is which screen a given backend answer leads to, and
 * mounting three navigators to assert one `navigate` call would test React Navigation
 * rather than ZoomOut.
 *
 * Every screen is also rendered in **both themes**, because "renders correctly in dark
 * and light" is an acceptance criterion and a token that resolves to `undefined` in one
 * theme fails silently in the other.
 */

/** Fixed insets: real ones are measured asynchronously and never settle under Jest. */
const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(async () => {
  await cleanup();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A backend that answers every request the same way. */
const always = (response: () => Response): typeof fetch => () => Promise.resolve(response());

interface Harness {
  readonly navigate: jest.Mock;
  readonly goBack: jest.Mock;
}

function stubNavigation(): Harness {
  return { navigate: jest.fn(), goBack: jest.fn() };
}

/**
 * Renders one screen inside the real providers.
 *
 * Returns the queries rather than relying on the module-level `screen`: with several
 * trees rendered across one file, `screen` stays bound to the first and every later
 * assertion searches the wrong tree — which surfaces as "unable to find an element"
 * for markup that is demonstrably rendered.
 */
async function renderScreen(
  element: ReactElement,
  options: { fetchFn?: typeof fetch; mode?: ThemeMode } = {},
): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={options.mode ?? 'dark'}>
        <AuthProvider
          tokenStore={new MemoryTokenStore(null)}
          baseUrl="https://api.test"
          {...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn })}
        >
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(element, { wrapper });

  // Let `AuthProvider`'s launch check settle inside an act() before the test body runs.
  // Without this its promise resolves during the *next* test's render, which React
  // reports as overlapping act() calls and which leaves later renders querying a tree
  // that never committed.
  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The screens take React Navigation's generated prop types. Constructing a faithful
 * one in a test means reproducing a large generic shape to call two functions on it;
 * the cast is confined to this helper. */
const navProps = (harness: Harness): any => ({ navigation: harness, route: { params: undefined } });
const navPropsWithDraft = (harness: Harness): any => ({
  navigation: harness,
  route: {
    params: { email: 'reader@example.test', password: 'a-long-enough-password', displayName: 'R' },
  },
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------------------------------------------------- */
/* Both themes                                                                 */
/* -------------------------------------------------------------------------- */

describe.each(['dark', 'light'] as const)('in the %s theme', (mode) => {
  it('renders sign-in', async () => {
    const view = await renderScreen(<SignInScreen {...navProps(stubNavigation())} />, { mode });

    expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(view.getByTestId('sign-in-submit')).toBeOnTheScreen();
  });

  it('renders the age gate', async () => {
    const view = await renderScreen(<AgeGateScreen {...navPropsWithDraft(stubNavigation())} />, { mode });

    expect(view.getByTestId('age-gate-dob')).toBeOnTheScreen();
  });

  it('renders the age refusal', async () => {
    const view = await renderScreen(<AgeRefusedScreen {...navProps(stubNavigation())} />, { mode });

    expect(view.getByTestId('age-refused-screen')).toBeOnTheScreen();
  });

  it('renders the provider dead end', async () => {
    const view = await renderScreen(<ProviderEmailMissingScreen {...navProps(stubNavigation())} />, { mode });

    expect(view.getByTestId('provider-email-missing-screen')).toBeOnTheScreen();
  });
});

/* -------------------------------------------------------------------------- */
/* The age gate                                                                */
/* -------------------------------------------------------------------------- */

describe('the age gate', () => {
  it('sends an under-age reader to the refusal screen without calling the server', async () => {
    // The local check is UX only — it exists so nobody fills in a form they cannot
    // submit. Nothing is created either way, because submission happens after it.
    const fetchFn = jest.fn(always(() => json({}))) as unknown as typeof fetch;
    const nav = stubNavigation();

    const view = await renderScreen(<AgeGateScreen {...navPropsWithDraft(nav)} />, { fetchFn });

    await fireEvent.changeText(view.getByTestId('age-gate-dob'), '2020-01-01');
    await fireEvent.press(view.getByTestId('age-gate-submit'));

    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith('AgeRefused');
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects a malformed date before submitting it', async () => {
    const nav = stubNavigation();
    const view = await renderScreen(<AgeGateScreen {...navPropsWithDraft(nav)} />);

    await fireEvent.changeText(view.getByTestId('age-gate-dob'), '17/03/1994');
    await fireEvent.press(view.getByTestId('age-gate-submit'));

    await waitFor(() => {
      expect(view.getByText('Use the format YYYY-MM-DD.')).toBeOnTheScreen();
    });
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('routes to the refusal screen when the server refuses on age', async () => {
    // The server is the control. Its refusal has to reach the same screen the local
    // check does, or the two paths would look different for the same outcome.
    const nav = stubNavigation();

    const view = await renderScreen(<AgeGateScreen {...navPropsWithDraft(nav)} />, {
      fetchFn: always(() =>
        json({ error: { code: 'BELOW_MINIMUM_AGE', message: 'too young' } }, 403),
      ),
    });

    await fireEvent.changeText(view.getByTestId('age-gate-dob'), '1994-03-17');
    await fireEvent.press(view.getByTestId('age-gate-submit'));

    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith('AgeRefused');
    });
  });

  it('never offers a timezone input', async () => {
    // Read from the device, never asked. A picker here would be a worse answer than
    // the device's own setting in every case.
    const view = await renderScreen(<AgeGateScreen {...navPropsWithDraft(stubNavigation())} />);

    // No field labelled Timezone. The word appears once, in the hint explaining that
    // we read it from the device — which is the opposite of asking for it.
    expect(view.queryByLabelText('Timezone')).toBeNull();
    expect(view.getByText(/comes from your device/iu)).toBeOnTheScreen();
  });

  it('asks for the date differently on the social path', async () => {
    // No route params means a social signup the backend paused. The copy has to explain
    // why an app that just authenticated them is still asking for something.
    const view = await renderScreen(<AgeGateScreen {...navProps(stubNavigation())} />);

    expect(view.getByText('One more thing')).toBeOnTheScreen();
    expect(view.getByText(/does not share this/iu)).toBeOnTheScreen();
  });
});

/* -------------------------------------------------------------------------- */
/* The refusal screen                                                          */
/* -------------------------------------------------------------------------- */

describe('the age refusal screen', () => {
  it('is non-punitive and says nothing was saved', async () => {
    // A compliance boundary, not a user failure. The copy is checked because it is the
    // requirement — "clear, non-punitive" is not something a snapshot would catch.
    const view = await renderScreen(<AgeRefusedScreen {...navProps(stubNavigation())} />);

    expect(view.getByText('Not quite yet')).toBeOnTheScreen();
    expect(view.getByText(/Nothing has been saved/u)).toBeOnTheScreen();
  });

  it('offers a way back rather than a dead stop', async () => {
    const nav = stubNavigation();
    const view = await renderScreen(<AgeRefusedScreen {...navProps(nav)} />);

    await fireEvent.press(view.getByTestId('age-refused-back'));

    expect(nav.navigate).toHaveBeenCalledWith('SignIn');
  });
});

/* -------------------------------------------------------------------------- */
/* The two provider errors                                                     */
/* -------------------------------------------------------------------------- */

describe('the provider dead end', () => {
  it('points at the recovery that exists, not at a retry', async () => {
    // PROVIDER_EMAIL_MISSING cannot be fixed inside ZoomOut. Offering "try again" would
    // be offering a fix that does not exist.
    const nav = stubNavigation();
    const view = await renderScreen(<ProviderEmailMissingScreen {...navProps(nav)} />);

    expect(view.getByText(/We need an email address/u)).toBeOnTheScreen();

    await fireEvent.press(view.getByTestId('provider-email-missing-signup'));
    expect(nav.navigate).toHaveBeenCalledWith('SignUp');
  });

  it('explains the change has to happen at the provider', async () => {
    const view = await renderScreen(<ProviderEmailMissingScreen {...navProps(stubNavigation())} />);

    expect(view.getByTestId('provider-email-missing-hint')).toBeOnTheScreen();
    expect(view.getByText(/Apple or Google account settings/u)).toBeOnTheScreen();
  });
});

/* -------------------------------------------------------------------------- */
/* Sign-in errors                                                              */
/* -------------------------------------------------------------------------- */

describe('sign-in', () => {
  it('shows the backend’s message for bad credentials', async () => {
    const view = await renderScreen(<SignInScreen {...navProps(stubNavigation())} />, {
      fetchFn: always(() =>
        json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }, 401),
      ),
    });

    await fireEvent.changeText(view.getByTestId('sign-in-email'), 'reader@example.test');
    await fireEvent.changeText(view.getByTestId('sign-in-password'), 'wrong-password');
    await fireEvent.press(view.getByTestId('sign-in-submit'));

    await waitFor(() => {
      expect(view.getByTestId('sign-in-error')).toBeOnTheScreen();
    });
    expect(view.getByText('Email or password is incorrect')).toBeOnTheScreen();
  });

  it('offers a route to sign-up', async () => {
    const nav = stubNavigation();
    const view = await renderScreen(<SignInScreen {...navProps(nav)} />);

    await fireEvent.press(view.getByTestId('sign-in-to-signup'));

    expect(nav.navigate).toHaveBeenCalledWith('SignUp');
  });

  it('hides social buttons that are not configured', async () => {
    // Apple is unavailable under Jest and no Google client id is set, so neither should
    // appear. A visible button that cannot work is worse than an absent one.
    const view = await renderScreen(<SignInScreen {...navProps(stubNavigation())} />);

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('sign-in-apple')).toBeNull();
    expect(view.queryByTestId('sign-in-google')).toBeNull();
  });
});
