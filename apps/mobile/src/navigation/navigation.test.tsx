import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, type ThemeMode } from '../design';
import { RootNavigator } from './RootNavigator';

/**
 * The navigators, rendered.
 *
 * WP6 shipped `RootNavigator` and `TabShell` with no render test — the two components
 * that decide *which* screen a reader sees. Everything below is about that choice:
 * signed out lands on the auth stack, signed in lands on the tab shell, and the four
 * tabs are present and labelled.
 *
 * `TabShell` is exercised through `RootNavigator` rather than directly, because
 * mounting it alone would test a navigator nobody renders that way.
 */

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

/**
 * The URL of a fetch call, whichever form it arrives in.
 *
 * `RequestInfo` is `string | URL | Request`, and `String()` on a `Request` yields
 * "[object Object]" — every route would silently stop matching.
 */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

const PROFILE = {
  id: '55a918e0-b185-4fb7-9b08-7459aae3b8fa',
  email: 'reader@example.test',
  authProviders: ['email'],
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

const SESSION = {
  userId: PROFILE.id,
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 900,
  tokenType: 'Bearer',
};

/** Answers everything the shell asks for on mount, so the tabs can render. */
const signedInBackend: typeof fetch = (input) => {
  const url = urlOf(input);

  if (url.includes('/auth/refresh')) return Promise.resolve(json(SESSION));
  if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
  if (url.includes('/content/tracks')) {
    return Promise.resolve(json({ tracks: [], page: 1, totalPages: 0, totalTracks: 0 }));
  }
  if (url.includes('/library')) return Promise.resolve(json({ entries: [] }));

  return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
};

/** No stored token, so the app settles signed out. */
const signedOutBackend: typeof fetch = () =>
  Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));

async function renderApp(options: {
  refreshToken: string | null;
  fetchFn: typeof fetch;
  mode?: ThemeMode;
}): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={options.mode ?? 'dark'}>
        <AuthProvider
          tokenStore={new MemoryTokenStore(options.refreshToken)}
          baseUrl="https://api.test"
          fetchFn={options.fetchFn}
        >
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(<RootNavigator />, { wrapper });

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

describe('RootNavigator', () => {
  it('shows the auth stack when nobody is signed in', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
  });

  it('shows the tab shell to a restored session', async () => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });

  it('does not flash sign-in at a reader who is already signed in', async () => {
    // The reason `restoring` is a distinct state rather than an initial `signedOut`.
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('sign-in-screen')).toBeNull();
  });
});

describe('TabShell', () => {
  it.each(['Explore', 'Library', 'Journey', 'Profile'])(
    'offers a labelled %s tab',
    async (label) => {
      // Labelled as well as iconed, so nothing depends on reading the symbol — the
      // property that made WP6's emoji-glyph defect survivable.
      const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

      await waitFor(() => {
        expect(view.getByText(label)).toBeOnTheScreen();
      });
    },
  );

  it('opens on Explore', async () => {
    // Where a reader with an empty library has something to do.
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });

  it.each(['dark', 'light'] as const)('renders the shell in the %s theme', async (mode) => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend, mode });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });
});
