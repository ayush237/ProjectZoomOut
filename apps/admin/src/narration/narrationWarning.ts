import {
  NARRATOR_IDS,
  NARRATOR_LABELS,
  type NarratedSlideKey,
  type NarratorId,
} from '@zoomout/shared';

/**
 * What the stale-narration banner says (GUARD-1 B).
 *
 * Plain functions returning strings, kept out of the component so the wording — which is
 * the whole of the feature's usefulness — can be tested without rendering anything. The
 * banner tells an editor four things: which slide, who goes silent, that nothing is lost,
 * and what to do about it. It never tells them they cannot proceed: editing a narrated
 * sentence is legitimate, and the failure this exists for was that nobody was told, not
 * that someone edited.
 */

/** The names the Leaf form uses for its groups (`1 · Summary` and so on), without the numbering. */
const SLIDE_LABELS: Readonly<Record<NarratedSlideKey, string>> = {
  summary: 'Summary',
  scenario: 'Scenario',
  payoff: 'Payoff',
  takeaway: 'Takeaway',
};

export function slideLabel(slide: NarratedSlideKey): string {
  return SLIDE_LABELS[slide];
}

/**
 * A narrator as the editor knows them: the reader-facing name and the id the pipeline and
 * the CMS use, e.g. `Lara (female)`. An id that is not a known narrator is shown as it is.
 */
export function narratorName(id: string): string {
  // The cast is the narrowing: `includes` has just established `id` is one of the ids.
  return (NARRATOR_IDS as readonly string[]).includes(id)
    ? `${NARRATOR_LABELS[id as NarratorId].name} (${id})`
    : id;
}

/** `A`, `A and B`, `A, B and C`. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

export function staleHeading(slide: NarratedSlideKey): string {
  return `The ${slideLabel(slide)} narration no longer matches this text`;
}

/**
 * The paragraphs under the heading. `orderIndex` is the Leaf's own, as the form holds it
 * (`narrate --leaf` takes it); `undefined` while the form does not have one yet.
 */
export function staleParagraphs(input: {
  readonly slide: NarratedSlideKey;
  readonly narrators: readonly string[];
  readonly orderIndex: number | string | null | undefined;
}): readonly string[] {
  const who = joinNames(input.narrators.map(narratorName));
  const leaf = input.orderIndex === null || input.orderIndex === undefined ? '<orderIndex>' : String(input.orderIndex);

  return [
    `Readers will get no narration on the ${slideLabel(input.slide)} slide, in ${who}, once this is published — the audio was made from different words.`,
    `The clips stay in the CMS, and the slide plays again when the Leaf is re-narrated. Re-narrating is a pipeline step: narrate --leaf ${leaf}.`,
    'This does not stop you saving or publishing.',
  ];
}

/** The line shown when the check could not be made — never nothing. */
export function unavailableLine(reason: string): string {
  return `Narration check unavailable here: ${reason}. Whether the audio on this slide still matches its text could not be checked.`;
}
