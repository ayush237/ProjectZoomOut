'use client';

import { useField, useFieldPath, useFormFields } from '@payloadcms/ui';
import { useMemo } from 'react';

import {
  type AudioRowDigest,
  checkNarration,
  type NarrationCheck,
  narratedSlideAt,
  readAudioRows,
} from '../narration/staleNarration';
import { staleHeading, staleParagraphs, unavailableLine } from '../narration/narrationWarning';

/**
 * Renders after each narrated text field (`summary.body`, `scenario.prompt`,
 * `payoff.body`, `takeaway.body`): a warning while that slide's narration was made from
 * different words than the field now holds (GUARD-1 B).
 *
 * The backend serves a clip only if its `textDigest` is the sha256 of the slide's text,
 * and drops it otherwise with a log line nobody reads — Leaf 9's payoff was silent for two
 * weeks after a good edit and the admin said nothing. This is the admin saying so. The
 * comparison, and why it hashes in plain JavaScript, are in `narration/`; this file is
 * the glue between Payload's form state and that.
 *
 * **It only reads.** It never calls `setValue`, never marks the form dirty, and never
 * touches the read-only `audio` rows it compares against. It also never blocks saving or
 * publishing: editing a narrated sentence is legitimate, and the failure was that nobody
 * was told.
 *
 * **It is never silent.** If the check cannot be made — the form has no audio list under
 * this slide, or the hash throws — the editor sees a line saying so rather than nothing.
 *
 * It shows on load for a Leaf that is already stale, live while typing (the text comes
 * from `useField`, which updates on every keystroke), and goes when the text is put back.
 * The audio rows are read through `useFormFields` with a selector that returns a string,
 * so this re-renders when the rows change and not on every keystroke elsewhere in the
 * form. The status region is always mounted, empty when nothing is wrong, so a screen
 * reader announces the warning when it appears instead of missing an element that arrived
 * with its own content.
 */
export function NarrationStaleBanner(): React.JSX.Element {
  const path = useFieldPath();
  const { value: text } = useField<string | null>();
  const slide = narratedSlideAt(path);

  const rowsKey = useFormFields(([fields]) => {
    const rows = slide === undefined ? undefined : readAudioRows(fields, slide);

    return rows === undefined ? undefined : JSON.stringify(rows);
  });
  const orderIndex = useFormFields(([fields]) => {
    const value = fields['orderIndex']?.value;

    return typeof value === 'number' || typeof value === 'string' ? value : undefined;
  });

  const check = useMemo<NarrationCheck>(() => {
    if (slide === undefined) {
      return { status: 'unavailable', reason: `"${path}" is not one of the narrated fields` };
    }

    // `rowsKey` is what `JSON.stringify` made of `AudioRowDigest[]` a few lines up.
    const rows = rowsKey === undefined ? undefined : (JSON.parse(rowsKey) as AudioRowDigest[]);

    return checkNarration(text, rows);
  }, [slide, path, rowsKey, text]);

  return (
    <div role="status" aria-live="polite" data-narration-check={check.status} style={styles.region}>
      {check.status === 'stale' && slide !== undefined ? (
        <div style={styles.banner}>
          <strong style={styles.heading}>{staleHeading(slide)}</strong>
          {staleParagraphs({ slide, narrators: check.narrators, orderIndex }).map((paragraph) => (
            <p key={paragraph} style={styles.paragraph}>
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      {check.status === 'unavailable' ? (
        <p style={styles.unavailable}>{unavailableLine(check.reason)}</p>
      ) : null}
    </div>
  );
}

// Payload's own theme variables, so both themes are handled by Payload: its `--theme-warning-*`
// scale inverts in the dark theme (a pale panel with dark text becomes a dark panel with pale text).
const styles = {
  region: {
    marginTop: 8,
  },
  banner: {
    padding: '10px 12px',
    borderRadius: 4,
    border: '1px solid var(--theme-warning-400)',
    background: 'var(--theme-warning-100)',
    color: 'var(--theme-warning-900)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  heading: {
    display: 'block',
    fontWeight: 600,
  },
  paragraph: {
    margin: '6px 0 0',
  },
  unavailable: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 4,
    border: '1px dashed var(--theme-elevation-400)',
    color: 'var(--theme-elevation-700)',
    fontSize: 13,
    lineHeight: 1.45,
  },
} as const satisfies Record<string, React.CSSProperties>;
