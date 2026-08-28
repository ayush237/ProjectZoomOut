'use client';

import { useField, useFieldPath } from '@payloadcms/ui';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders after `imageCandidates[].url`'s text input: a live thumbnail so a reviewer
 * can compare the three candidates without opening each URL in a new tab (WP15.6).
 *
 * Purely presentational. `url`/`alt` stay plain text fields underneath, unchanged —
 * this reads their live form values via `useField`, it does not touch the schema.
 *
 * `useFieldPath`/`useField`'s path option are Payload's documented (if marked
 * experimental) mechanism for a component to read a sibling field: derived here to
 * read `alt` for the thumbnail's own `alt` attribute, since a reviewer using a screen
 * reader on this screen deserves the same accessible image WP15's alt-text rule was
 * written for.
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
} as const satisfies Record<string, React.CSSProperties>;
