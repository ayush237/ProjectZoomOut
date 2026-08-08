import type { CollectionBeforeChangeHook } from 'payload';

/**
 * Trims leading and trailing whitespace from every string in a document.
 *
 * The schema-freeze gate produced `" ; \n"` on `takeaway.dinnerTableKnowledge` and
 * `"concept 1 "` as a Leaf title. Payload does not trim, so that whitespace reaches
 * rendered output and makes otherwise-identical values distinct — which poisons any
 * later comparison or deduplication.
 *
 * **Leading and trailing only. Internal whitespace is never touched.** A payoff body
 * is multi-line and its blank lines are authored deliberately; collapsing them would
 * destroy formatting the author chose. This is the difference between cleaning input
 * and rewriting it.
 *
 * Recursion matters as much as the trim itself: both fields the gate caught were
 * nested, one inside a `group` and one inside an `array`. A hook that only walked the
 * top level would have missed the exact cases that motivated it.
 */
export const trimTextFields: CollectionBeforeChangeHook = ({ data }) => trimDeep(data);

/**
 * Returns a structurally identical value with every string trimmed.
 *
 * Rebuilds containers rather than mutating in place — Payload reuses the `data` object
 * across the hook chain, and a hook that mutates its input is a hook whose effect
 * depends on where it sits in that chain.
 */
function trimDeep<T>(value: T): T {
  return trimUnknown(value) as T;
}

/**
 * The recursion, over `unknown` rather than a generic.
 *
 * Kept separate so the single unavoidable assertion lives at the boundary in
 * `trimDeep`. Recursing on a generic would make every nested call return `any`, which
 * defeats the point of the strict settings this repo runs under.
 */
function trimUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return (value as unknown[]).map((entry) => trimUnknown(entry));
  }

  // `null` is a real, meaningful value here — Payload writes it for cleared optional
  // fields — so it is passed through untouched rather than coerced.
  if (value !== null && typeof value === 'object') {
    // Dates and other class instances must not be rebuilt as plain objects.
    if (value instanceof Date) {
      return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = trimUnknown(nested);
    }
    return result;
  }

  return value;
}
