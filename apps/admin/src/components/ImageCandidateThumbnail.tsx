'use client';

import { Button, useField, useFieldPath } from '@payloadcms/ui';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders after `imageCandidates[].url`'s text input: a live thumbnail so a reviewer
 * can compare the three candidates without opening each URL in a new tab (WP15.6),
 * plus a button that writes the candidate straight into `scenario.image` (WP15.7) so
 * picking one is a click rather than two copy-pastes.
 *
 * `url`/`alt` stay plain text fields underneath, unchanged — this reads their live
 * form values via `useField`, it does not touch `imageCandidates`' schema. The write
 * side targets `scenario.image.url` and `scenario.image.alt` as two independent
 * leaf-level `setValue` calls, never the `scenario` or `scenario.image` group object
 * as a whole — Payload's form state is a flat path-keyed map, so this cannot touch
 * `scenario.image.width`/`.height` (untouched, both fields this package doesn't
 * write to) or `scenario.prompt`/`scenario.options` (untouched, siblings of `image`
 * rather than of `url`/`alt`). Verified live, not just reasoned through — see the
 * WP15.7 completion report for the re-fetched-document proof.
 *
 * `useFieldPath`/`useField`'s path option are Payload's documented (if marked
 * experimental) mechanism for a component to read or write another field: used here
 * both for the sibling `alt` read (WP15.6) and the cross-group `scenario.image`
 * write (WP15.7).
 *
 * Failure detection polls the element rather than trusting `onError`: verified live
 * that a same-machine (or already-cached) failed load can resolve — `complete: true`,
 * `naturalWidth: 0` — without the `error` event ever reaching a listener attached
 * here, React prop or a manually-attached one alike. `complete`/`naturalWidth` are
 * correct regardless of when the failure actually happened, which is what makes this
 * the reliable signal rather than a fallback for a rare edge case.
 */
export function ImageCandidateThumbnail(): React.JSX.Element | null {
  const urlPath = useFieldPath();
  const { value: url } = useField<string>();
  const { value: alt } = useField<string>({ path: urlPath.replace(/\.url$/u, '.alt') });
  const { setValue: setScenarioImageUrl } = useField<string>({ path: 'scenario.image.url' });
  const { setValue: setScenarioImageAlt } = useField<string>({ path: 'scenario.image.alt' });
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setBroken(false);
    const img = imgRef.current;

    if (!img) {
      return;
    }

    const poll = window.setInterval(() => {
      if (img.complete) {
        setBroken(img.naturalWidth === 0);
        window.clearInterval(poll);
      }
    }, 150);

    return () => window.clearInterval(poll);
  }, [url]);

  if (!url) {
    return null;
  }

  const applyCandidate = (): void => {
    setScenarioImageUrl(url);
    setScenarioImageAlt(alt ?? '');
  };

  return (
    <>
      {/* Always mounted, never conditionally swapped for the fallback below — so
          `imgRef` never goes stale. It stayed null across a later poll, once, when
          a broken URL was edited straight to a different broken one (WP15.6, live). */}
      <img
        ref={imgRef}
        src={url}
        alt={alt ?? ''}
        style={broken ? styles.hidden : styles.thumb}
      />
      {broken ? <p style={styles.broken}>Image failed to load.</p> : null}
      <div style={styles.buttonRow}>
        <Button buttonStyle="secondary" size="small" onClick={applyCandidate}>
          Use this candidate
        </Button>
      </div>
    </>
  );
}

const styles = {
  thumb: {
    display: 'block',
    marginTop: 8,
    maxWidth: 220,
    maxHeight: 160,
    objectFit: 'contain',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-150)',
  },
  hidden: {
    display: 'none',
  },
  broken: {
    marginTop: 8,
    fontSize: 13,
    color: 'var(--theme-elevation-500)',
  },
  buttonRow: {
    marginTop: 8,
  },
} as const satisfies Record<string, React.CSSProperties>;
