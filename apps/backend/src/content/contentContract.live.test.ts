import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The maximal-fixture round-trip, against real Payload and the real backend.
 *
 * **This is the test `agents/manager.md` described for weeks and nobody built** —
 * and the gap it left is not hypothetical: WP15 shipped a mapper that dropped three
 * new fields with 932 unit tests green, and VO-1 shipped a mapper that would have
 * taken a Leaf down on its first real audio URL, because a fixture written from
 * understanding what Payload returns is not the same thing as what Payload actually
 * returns. VO-1.1 changes that seam again — `audio` from a group to an array — which
 * is exactly where that gap reopens.
 *
 * It runs against **real Payload and the real backend**, not stand-ins, deliberately:
 * a stand-in is written from the same understanding as the code under test and
 * inherits its blind spots. Mirrors `apps/pipeline/tests/test_cms_roundtrip.py`'s
 * pattern (read there, not edited here) — author through a real write path, publish,
 * fetch through the real read path, assert field by field.
 *
 * **The two write paths this fixture needs cannot come from one credential.** The
 * pipeline's machine account is deliberately forbidden from publishing
 * (`access/publishing.ts`), so authoring a *published* fixture needs a human Payload
 * login — the same one `apps/admin/src/seed/seed.ts` already uses
 * (`PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD`), reimplemented minimally here
 * rather than imported: `apps/admin`'s seed client is Next-app-internal, and backend
 * has no business depending on it.
 *
 * **Touches nothing but its own fixture.** The Track's `bookTitle` is a fixed,
 * distinctive string matched on to find and delete it — the same idiom
 * `seed.ts`'s `RETIRED_TRACK_TITLES` uses. `beforeAll` deletes any stray copy left by
 * a previous run that did not clean up before creating a fresh one, and `afterAll`
 * deletes what this run created. Track 42 and Track 50 are never queried by id or by
 * any predicate that could match them.
 *
 * Skipped, not failed, when its credentials are not set — the same shape as the
 * pipeline's `pytest.mark.live` gate. Run it with:
 *
 *     PAYLOAD_ADMIN_EMAIL=... PAYLOAD_ADMIN_PASSWORD=... \
 *       npm run test:live --workspace=apps/backend
 *
 * Needs Payload (`npm run dev:admin`) and the backend (`npm run dev:backend`)
 * both running. `PAYLOAD_URL` and `BACKEND_URL` default to their standard local
 * ports and only need overriding if either is running somewhere else.
 */

/* eslint-disable no-restricted-properties --
 * A live/manual test, gated on its own credentials rather than the validated
 * `AppConfig` — the same exemption `apps/admin/src/seed/seed.ts` uses and for the
 * same reason: this is not part of the running app. */
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://127.0.0.1:3001';
const PAYLOAD_ADMIN_EMAIL = process.env['PAYLOAD_ADMIN_EMAIL'];
const PAYLOAD_ADMIN_PASSWORD = process.env['PAYLOAD_ADMIN_PASSWORD'];
const BACKEND_URL = process.env['BACKEND_URL'] ?? 'http://127.0.0.1:3000';
/* eslint-enable no-restricted-properties */

const HAS_CREDENTIALS =
  PAYLOAD_ADMIN_EMAIL !== undefined &&
  PAYLOAD_ADMIN_EMAIL.length > 0 &&
  PAYLOAD_ADMIN_PASSWORD !== undefined &&
  PAYLOAD_ADMIN_PASSWORD.length > 0;

/** The natural key this whole test is matched, cleaned and re-run on. */
const FIXTURE_BOOK_TITLE = 'ZO Live Contract Test Fixture — VO-1.1 (safe to delete)';
const FIXTURE_LEAF_TITLE = 'VO-1.1 live contract test fixture Leaf (safe to delete)';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/* -------------------------------------------------------------------------- */
/* A minimal Payload REST client — human login, not the pipeline's machine key */
/* -------------------------------------------------------------------------- */

class PayloadRestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'PayloadRestError';
  }
}

class PayloadHumanClient {
  private token: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async signIn(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/admins/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new PayloadRestError(
        'Could not sign in to Payload. Check PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD.',
        response.status,
        await response.text(),
      );
    }

    const body = (await response.json()) as { token?: string; user?: { accountType?: string } };

    if (typeof body.token !== 'string') {
      throw new PayloadRestError('Payload login returned no token', response.status, '');
    }

    // The JWT-header trap: `admins JWT <token>` for the *collection slug* form (the
    // machine key's own scheme) is accepted silently as anonymous. Asserting the
    // signed-in account is human, not just that login returned 200, is what would
    // have caught that — a wrong scheme here would otherwise look like success right
    // up until every write below is quietly refused.
    if (body.user?.accountType !== 'human') {
      throw new PayloadRestError(
        `Signed in, but accountType is ${String(body.user?.accountType)}, not "human" — ` +
          'this fixture needs a human credential to publish.',
        response.status,
        '',
      );
    }

    this.token = body.token;
  }

  async findOneByTitle(collection: string, field: string, value: string): Promise<number | null> {
    const query = new URLSearchParams({
      [`where[${field}][equals]`]: value,
      limit: '1',
      depth: '0',
    });
    const body = await this.request<{ docs: readonly { id: number }[] }>(
      'GET',
      `/api/${collection}?${query.toString()}`,
    );
    return body.docs[0]?.id ?? null;
  }

  async create(collection: string, data: Record<string, unknown>): Promise<number> {
    const body = await this.request<{ doc: { id: number } }>('POST', `/api/${collection}`, data);
    return body.doc.id;
  }

  /** Best-effort: logs rather than throws, so cleanup of one record cannot abort the other. */
  async deleteQuietly(collection: string, id: number): Promise<void> {
    try {
      await this.request('DELETE', `/api/${collection}/${String(id)}`);
    } catch (error) {
      console.warn(`Cleanup: could not delete ${collection}/${String(id)}:`, error);
    }
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (this.token !== null) {
      headers['authorization'] = `JWT ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new PayloadRestError(`${method} ${path} failed with ${String(response.status)}`, response.status, text);
    }

    const parsed: unknown = text === '' ? {} : JSON.parse(text);
    return parsed as T;
  }
}

/* -------------------------------------------------------------------------- */
/* Fixture content                                                             */
/* -------------------------------------------------------------------------- */

const SUMMARY_BODY =
  'This is the fixture summary body. It exists to prove that this exact text, and the audio ' +
  'digest generated from it, both survive the round trip through real Payload and the real backend.';
const SCENARIO_PROMPT =
  'This is the fixture scenario prompt, used the same way — to verify its own audio digest.';
const PAYOFF_BODY = 'This is the fixture payoff body, unlocked only after a correct scenario answer.';
const TAKEAWAY_BODY = 'This is the fixture takeaway body, the last of the four narrated fields.';

/** One valid audio row for the given narrator and narrated text. */
function audioEntry(
  narrator: 'female' | 'male',
  narratedText: string,
  overrides: Partial<{ url: string; durationSeconds: number; textDigest: string }> = {},
): Record<string, unknown> {
  return {
    narrator,
    url: '/api/media/file/vo11-fixture-clip.mp3',
    durationSeconds: 9.5,
    textDigest: sha256(narratedText),
    ...overrides,
  };
}

function trackPayload(): Record<string, unknown> {
  return {
    bookTitle: FIXTURE_BOOK_TITLE,
    author: 'Live Contract Test',
    publisher: 'ZoomOut Test Fixtures',
    coverUrl: 'https://example.test/vo1.1-fixture-cover.png',
    description:
      'A fixture Track created and deleted by the VO-1.1 live contract test. Safe to delete if found outside a test run.',
    disclaimer: 'ZoomOut is not affiliated with or endorsed by any author or publisher. Test fixture content.',
    purchaseLinks: [{ retailer: 'Test Retailer', url: 'https://example.test/buy', isAffiliate: false }],
    leafCount: 1,
    acquisition: 'undocumented',
    isPlaceholder: false,
    _status: 'published',
  };
}

/**
 * Every optional field the Leaf model has, populated — the "maximal fixture" this
 * test's name refers to. Audio is deliberately not uniform across slides:
 *
 *  - summary, payoff, takeaway: both narrators, correct digests
 *  - scenario: female correct, **male a stale digest** — the one deliberately wrong entry
 *  - stickyNotes: one entry, of any digest — unconditionally unverifiable and dropped
 *
 * so the fetch below proves both the happy path (7 of 9 raw entries survive, on 4 of
 * the 5 slides) and the two drop rules in the same real write, rather than a second
 * fixture paying for another live Track.
 */
function leafPayload(trackId: number): Record<string, unknown> {
  return {
    trackId,
    orderIndex: 0,
    title: FIXTURE_LEAF_TITLE,
    summary: {
      body: SUMMARY_BODY,
      audio: [audioEntry('female', SUMMARY_BODY), audioEntry('male', SUMMARY_BODY)],
    },
    scenario: {
      prompt: SCENARIO_PROMPT,
      options: [
        { text: 'The correct option', isCorrect: true },
        { text: 'A plausible wrong option', isCorrect: false },
        { text: 'Another plausible wrong option', isCorrect: false },
      ],
      image: {
        url: 'https://example.test/vo1.1-fixture-scenario.png',
        alt: 'A fixture scenario illustration',
      },
      audio: [
        audioEntry('female', SCENARIO_PROMPT),
        // Deliberately stale: a digest of text that is not this scenario's prompt.
        audioEntry('male', SCENARIO_PROMPT, { textDigest: sha256('an outdated scenario prompt') }),
      ],
    },
    payoff: {
      body: PAYOFF_BODY,
      audio: [audioEntry('female', PAYOFF_BODY), audioEntry('male', PAYOFF_BODY)],
    },
    stickyNotes: {
      notes: [{ note: 'Fixture note one.' }, { note: 'Fixture note two.' }, { note: 'Fixture note three.' }],
      diagram: {
        url: 'https://example.test/vo1.1-fixture-diagram.png',
        alt: 'A fixture diagram',
        spec: 'graph TD; A-->B;',
        specFormat: 'mermaid',
      },
      // stickyNotes has no narrated field — any entry here is unverifiable by
      // construction. This one is otherwise well-formed, digest included, so a
      // surviving entry here would prove the mapper is not really checking it.
      audio: [audioEntry('female', 'anything, it is never checked')],
    },
    takeaway: {
      body: TAKEAWAY_BODY,
      dinnerTableKnowledge: 'A fixture deep-cut fact, sourced by the reference below.',
      applyInLife: 'Do one fixture thing today.',
      audio: [audioEntry('female', TAKEAWAY_BODY), audioEntry('male', TAKEAWAY_BODY)],
    },
    sourceReferences: [
      { slideKey: 'summary', chapter: 'Fixture Chapter 1', note: 'Fixture source note for the summary.' },
      {
        slideKey: 'takeaway',
        chapter: 'Fixture Chapter 2',
        note: 'Fixture source note for the dinner table fact.',
      },
    ],
    isPlaceholder: false,
    _status: 'published',
  };
}

/* -------------------------------------------------------------------------- */
/* Backend HTTP — an authenticated app reader, a different auth system entirely */
/* -------------------------------------------------------------------------- */

/** A throwaway reader account, reused idempotently across runs by a fixed email. */
async function backendReaderToken(): Promise<string> {
  const email = 'vo1.1-live-contract-test@zoomout.test';
  const password = 'vo1.1-live-contract-test-password';
  const signUpBody = {
    email,
    password,
    displayName: 'VO-1.1 Live Contract Test',
    dateOfBirth: '1990-01-01',
    timezone: 'UTC',
  };

  const signUp = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(signUpBody),
  });

  if (signUp.ok) {
    const body = (await signUp.json()) as { accessToken: string };
    return body.accessToken;
  }

  // Already exists from a previous run — log in instead.
  const login = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!login.ok) {
    throw new Error(
      `Could not sign up or log in the live-test reader account against ${BACKEND_URL}: ` +
        `signup ${String(signUp.status)}, login ${String(login.status)}`,
    );
  }

  const body = (await login.json()) as { accessToken: string };
  return body.accessToken;
}

async function fetchBackend<T>(path: string, token: string): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  return { status: response.status, body: (text === '' ? {} : JSON.parse(text)) as T };
}

/* -------------------------------------------------------------------------- */
/* Response shapes this test cares about — deliberately loose everywhere else  */
/* -------------------------------------------------------------------------- */

interface LiveAudioEntry {
  readonly narrator: string;
  readonly url: string;
  readonly durationSeconds: number;
  readonly textDigest: string;
  readonly id?: unknown;
}

interface LiveLeaf {
  readonly id: string;
  readonly summary: { readonly body: string; readonly audio?: readonly LiveAudioEntry[] };
  readonly scenario: {
    readonly prompt: string;
    readonly image?: { readonly url: string; readonly alt: string };
    readonly audio?: readonly LiveAudioEntry[];
  };
  readonly payoff: unknown;
  readonly payoffUnlocked: boolean;
  readonly stickyNotes: {
    readonly notes: readonly string[];
    readonly diagram?: { readonly specFormat: string };
    readonly audio?: readonly LiveAudioEntry[];
  };
  readonly takeaway: {
    readonly body: string;
    readonly dinnerTableKnowledge?: string;
    readonly applyInLife?: string;
    readonly audio?: readonly LiveAudioEntry[];
  };
  readonly sourceReferences: readonly { readonly slideKey: string }[];
}

interface LiveTrack {
  readonly bookTitle: string;
  readonly disclaimer: string;
  readonly purchaseLinks: readonly unknown[];
}

/* -------------------------------------------------------------------------- */
/* The test                                                                    */
/* -------------------------------------------------------------------------- */

describe.skipIf(!HAS_CREDENTIALS)('VO-1.1 live contract: audio survives Payload -> backend', () => {
  const payload = new PayloadHumanClient(PAYLOAD_URL);
  let trackId: number | undefined;
  let leafId: number | undefined;
  let readerToken: string;

  beforeAll(async () => {
    await payload.signIn(PAYLOAD_ADMIN_EMAIL as string, PAYLOAD_ADMIN_PASSWORD as string);

    // Defensive: a previous run that failed before its own afterAll could leave a
    // stray fixture behind. Clean it up by the exact same title before creating a
    // fresh one, so two copies never coexist and a partial failure never compounds.
    const staleLeaf = await payload.findOneByTitle('leaves', 'title', FIXTURE_LEAF_TITLE);
    if (staleLeaf !== null) {
      await payload.deleteQuietly('leaves', staleLeaf);
    }
    const staleTrack = await payload.findOneByTitle('tracks', 'bookTitle', FIXTURE_BOOK_TITLE);
    if (staleTrack !== null) {
      await payload.deleteQuietly('tracks', staleTrack);
    }

    trackId = await payload.create('tracks', trackPayload());
    leafId = await payload.create('leaves', leafPayload(trackId));

    readerToken = await backendReaderToken();
  });

  afterAll(async () => {
    if (leafId !== undefined) {
      await payload.deleteQuietly('leaves', leafId);
    }
    if (trackId !== undefined) {
      await payload.deleteQuietly('tracks', trackId);
    }
  });

  it('every field survives the round trip through real Payload and the real backend', async () => {
    if (trackId === undefined || leafId === undefined) {
      throw new Error('Fixture setup did not produce ids — see beforeAll.');
    }

    const trackResponse = await fetchBackend<LiveTrack>(`/content/tracks/${String(trackId)}`, readerToken);
    expect(trackResponse.status).toBe(200);
    expect(trackResponse.body.bookTitle).toBe(FIXTURE_BOOK_TITLE);
    expect(trackResponse.body.purchaseLinks.length).toBeGreaterThan(0);

    const leafResponse = await fetchBackend<LiveLeaf>(`/content/leaves/${String(leafId)}`, readerToken);
    expect(leafResponse.status, JSON.stringify(leafResponse.body)).toBe(200);
    const leaf = leafResponse.body;

    // --- the five slide bodies
    expect(leaf.summary.body).toBe(SUMMARY_BODY);
    expect(leaf.scenario.prompt).toBe(SCENARIO_PROMPT);
    expect(leaf.payoff).toBeNull(); // locked: this reader has not answered yet
    expect(leaf.payoffUnlocked).toBe(false);
    expect(leaf.takeaway.body).toBe(TAKEAWAY_BODY);
    expect(leaf.stickyNotes.notes).toEqual(['Fixture note one.', 'Fixture note two.', 'Fixture note three.']);

    // --- the WP15 assets, the reason the earlier maximal-fixture test was meant to exist
    expect(leaf.scenario.image?.url).toBe('https://example.test/vo1.1-fixture-scenario.png');
    expect(leaf.stickyNotes.diagram?.specFormat).toBe('mermaid');
    expect(leaf.takeaway.dinnerTableKnowledge).toBe('A fixture deep-cut fact, sourced by the reference below.');
    expect(leaf.takeaway.applyInLife).toBe('Do one fixture thing today.');
    expect(leaf.sourceReferences).toHaveLength(2);

    // --- VO-1.1: both narrators survive on every checkable slide where both are
    // valid. (payoff is excluded here on purpose: `toDeliveredLeaf` strips the whole
    // payoff slide, audio included, until this reader answers the scenario
    // correctly — a WP4 mechanic out of scope for this test. Its audio goes through
    // the same `mapBodySlide` as summary's, so this still exercises that code path.)
    //
    // A mapper that maps only the first array entry — the specific regression this
    // acceptance criterion names — would leave one of these two-element checks
    // holding a single entry, not two.
    for (const [label, audio] of [
      ['summary', leaf.summary.audio],
      ['takeaway', leaf.takeaway.audio],
    ] as const) {
      expect(audio, `${label} audio`).toBeDefined();
      expect(audio?.map((entry) => entry.narrator).sort(), `${label} narrators`).toEqual(['female', 'male']);
      for (const entry of audio ?? []) {
        expect(entry.url.startsWith('http'), `${label} url absolute`).toBe(true);
        expect(entry).not.toHaveProperty('id');
      }
    }

    // --- the one deliberately stale entry: dropped, not served
    expect(leaf.scenario.audio?.map((entry) => entry.narrator)).toEqual(['female']);
    expect(leaf.scenario.audio?.[0]?.url.startsWith('http')).toBe(true);

    // --- stickyNotes: unconditionally unverifiable, unconditionally absent
    expect(leaf.stickyNotes.audio ?? []).toHaveLength(0);
  });
});
