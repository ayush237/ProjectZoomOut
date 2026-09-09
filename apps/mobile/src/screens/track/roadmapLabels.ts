/**
 * Where each Leaf's name sits beside the graph, and how much of it survives the trip.
 *
 * ## The problem this module exists to solve
 *
 * `design/claude_design/proto/graph.jsx` is the design source for this screen, and its
 * label treatment is signage: twelve point, semibold, uppercased, letter-spaced, hung in
 * the gutter beside each cell and joined to it by a hairline leader. That reads well
 * there because **every label in the mockup is one or two words** — *"First numbers"*,
 * *"Opening moves"*, *"Arbitrary anchors"* — which is a property of its fixtures, not of
 * the product.
 *
 * **Real Leaf titles are whole sentences.** Track 42's include *"Give every person more
 * in use value than you take in cash value"*: sixty-one characters against a gutter that
 * holds about fifteen. Uppercasing and letter-spacing the first fifteen characters of a
 * sentence does not make a label — it makes a fragment that has stopped being a title,
 * and it makes it louder. A faithful port of the mockup's label treatment, applied to
 * real content, is worse than what it replaces.
 *
 * ## What is not on the table
 *
 * **Rewording.** Not paraphrasing, not abbreviating, not "smart" shortening to a noun
 * phrase. Every generated line in this product is traceable to a source, and a label the
 * app composed for itself would be unsourced text sitting on a screen whose entire legal
 * footing is that ZoomOut points at books rather than rewriting them. See
 * `truncateTitle` in `roadmapModel.ts`, which this module reuses rather than
 * reimplementing: the visible text is always a prefix of the author's own, plus an
 * ellipsis.
 *
 * **Uppercasing the string.** The capitals are applied as a *style*
 * (`textTransform: 'uppercase'` on the `caption` token), never by transforming the text.
 * An uppercased string is a modified string: it would reach the screen reader, the test
 * tree and any future copy audit as something the author did not write. As a style it
 * reaches only the pixels.
 *
 * ## The decision, in three parts
 *
 * 1. **Two lines, wrapped on word boundaries; truncated only when two will not hold the
 *    title.** The mockup already wraps — its `lines` fixture is a pre-split array, and
 *    two is the most any of them uses. One line is what produced *"Real wealth comes
 *    from…"* on our screen; two produce *"REAL WEALTH COMES / FROM CREATING…"*, which is
 *    most of a clause for one extra line of height. Past two the gutter becomes a column
 *    of prose and the graph disappears behind it.
 *
 * 2. **The character budget is computed per node from the gutter it actually has and
 *    from the OS text scale** — never a constant. A cell at the outer edge of the
 *    meander has a wider gutter than one at the inner edge, and at accessibility text
 *    sizes the same gutter holds a third as many characters.
 *
 * 3. **Under a legibility floor the label is dropped, not shrunk to a stub.** Four
 *    characters of an uppercased sentence is noise, and at the largest Dynamic Type
 *    settings it also collides with its neighbours. Dropping it keeps the graph legible.
 *
 * **The title is never lost, only the decoration is.** Every node is an accessibility
 * node carrying its full, untruncated title at every text size, and the Leaf the reader
 * is up to keeps its card with the title in full. What degrades under pressure is the
 * table of contents down the margin, which is an affordance; what does not degrade is
 * the reader's ability to find out what a Leaf is called.
 */

import { truncateTitle, type LeafNodeState } from './roadmapModel';
import { HALO_RADIUS, LABEL_GAP, type RoadmapNodeGeometry } from './roadmapGeometry';

/** Two lines, per the decision above. */
export const MAX_LABEL_LINES = 2;

/**
 * Below this many characters per line, a label is dropped instead of drawn.
 *
 * Eight is about two short words, which is the point at which a fragment still names
 * something. Under it the gutter is holding syllables.
 */
export const MIN_LABEL_CHARS = 8;

/**
 * Average advance of one uppercased, letter-spaced `caption` character, in points.
 *
 * An estimate, not a measurement: React Native gives no synchronous text metrics, and a
 * layout that had to wait for `onTextLayout` would settle visibly one frame after the
 * graph drew. Nunito SemiBold's capitals run a little under two thirds of an em, and the
 * token adds 0.8 of tracking on top. **Calibrated by looking at the device**, which is
 * the only place this can be checked — see the WP22.2 completion report.
 */
export const CAPS_ADVANCE_RATIO = 0.72;

/** Vertical breathing room between two stacked labels, from `graph.jsx`'s `labelLayout`. */
const STACK_GAP = 7;

/** How far a label's centre may drift from its node before it needs a leader line. */
const LEADER_THRESHOLD = 9;

export interface RoadmapLabel {
  readonly index: number;
  readonly side: 'left' | 'right';
  /** The author's own words, wrapped. Cased as they wrote them; uppercased by style. */
  readonly lines: readonly string[];
  /** Top of the text block, in graph coordinates. */
  readonly top: number;
  readonly height: number;
  /** The text's anchor edge — its right edge on the left side, its left edge on the right. */
  readonly x: number;
  /** A cubic path joining node to label, or null when the label sits level with its node. */
  readonly leader: string | null;
}

export interface RoadmapLabelInput {
  readonly nodes: readonly RoadmapNodeGeometry[];
  /** Titles in node order. A missing entry simply gets no label. */
  readonly titles: readonly string[];
  readonly frameWidth: number;
  /** The OS text-size multiplier. 1 at the default setting. */
  readonly fontScale: number;
  /** The `caption` token's unscaled size and leading. */
  readonly fontSize: number;
  readonly lineHeight: number;
  /** The `h3` token's, for the next Leaf's card. */
  readonly cardFontSize: number;
  readonly cardLineHeight: number;
}

/**
 * The callout under the Leaf the reader is up to.
 *
 * **Half the frame, not all of it**, and this is the port's correction rather than a
 * refinement. `graph.jsx` gives the card a fixed 174 of its 390 and then *searches* for
 * somewhere to put it — six candidate heights against both sides, scored by how much of
 * the drawing each would bury, with any label it still covers hidden outright. Ours was
 * a full-width block pinned under the node, which on real content sat squarely on top of
 * four labels at once.
 *
 * What is ported here is the scoring and the hiding, not the search: the vertical
 * position stays under the node, where a reader looking at their own cell will look for
 * it, and only the side is chosen — by which one buries fewer labels. That is the part
 * of `placeCard` that was doing the work.
 */
export interface RoadmapCard {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly side: 'left' | 'right';
}

export interface RoadmapMargin {
  readonly labels: readonly RoadmapLabel[];
  /** Null when the Track is finished, or has no next Leaf to point at. */
  readonly card: RoadmapCard | null;
}

/** The card's share of the frame, from `graph.jsx`'s 174 of 390. */
const CARD_WIDTH_FRACTION = 174 / 390;
/** Its inner padding plus the eyebrow line above the title. */
const CARD_CHROME_LINES = 1;
const CARD_PADDING = 16;
/** How far below the aura the card hangs. */
const CARD_OFFSET = 8;
/** The title on the card wraps to at most this, matching the component's `numberOfLines`. */
const CARD_TITLE_LINES = 3;
/** The card clears the next cell's aura rather than the cell itself. */
const HALO_CLEARANCE = HALO_RADIUS;

/**
 * Lays out every side label: which gutter, how many lines, how far down, and its leader.
 *
 * **The Leaf the reader is up to gets no side label**, exactly as in the source: it
 * carries its full title on a card instead, which is the one place on this screen a
 * whole sentence has room to be read.
 */
export function layoutRoadmapLabels(input: RoadmapLabelInput): RoadmapMargin {
  const { nodes, titles, frameWidth, fontScale, fontSize, lineHeight } = input;

  const advance = fontSize * fontScale * CAPS_ADVANCE_RATIO;
  // React Native scales `fontSize` and leaves an absolute `lineHeight` alone, so the
  // *stacking* height has to come from the scaled size or labels overlap the moment a
  // reader sizes text up. This is layout arithmetic, not a fix to the known clipping
  // defect in `design/typography.ts`, which is logged and deliberately unaddressed.
  const scaledLine = Math.max(lineHeight, fontSize * fontScale * 1.2);

  const sides: Record<'left' | 'right', RoadmapLabel[]> = { left: [], right: [] };

  for (const node of nodes) {
    if (node.state === 'next') {
      continue;
    }

    const title = titles[node.index];

    if (title === undefined || title.trim() === '') {
      continue;
    }

    const side = node.labelSide;
    const anchorX =
      side === 'left'
        ? node.centre.x - node.radius - LABEL_GAP
        : node.centre.x + node.radius + LABEL_GAP;

    // The room this particular label has, from its own anchor to the frame edge.
    const gutter = side === 'left' ? anchorX : frameWidth - anchorX;
    const maxChars = Math.floor(gutter / Math.max(advance, 0.5));

    if (maxChars < MIN_LABEL_CHARS) {
      continue;
    }

    const lines = wrapTitle(title, maxChars, MAX_LABEL_LINES);

    if (lines.length === 0) {
      continue;
    }

    sides[side].push({
      index: node.index,
      side,
      lines,
      top: node.centre.y - (lines.length * scaledLine) / 2,
      height: lines.length * scaledLine,
      x: anchorX,
      leader: null,
    });
  }

  const placed: RoadmapLabel[] = [];

  for (const side of ['left', 'right'] as const) {
    // Each gutter is packed independently, top to bottom: a label may be pushed down out
    // of the way of the one above it, and the leader line is what re-attaches it to its
    // own cell once it has moved.
    const column = [...sides[side]].sort((a, b) => a.top - b.top);
    let previousBottom = -Infinity;

    for (const label of column) {
      const top = Math.max(label.top, previousBottom + STACK_GAP);
      previousBottom = top + label.height;

      const node = nodes.find((candidate) => candidate.index === label.index);

      placed.push({
        ...label,
        top,
        leader: node === undefined ? null : leaderPath(node, label.side, label.x, top + label.height / 2),
      });
    }
  }

  const card = layoutCard(input, placed);

  return {
    // Anything the card would bury is dropped rather than drawn underneath it. Half a
    // label showing from behind an opaque card is worse than no label: it reads as a
    // rendering fault, where an absent one reads as a margin that simply has a gap.
    labels: card === null ? placed : placed.filter((label) => !overlaps(label, card)),
    card,
  };
}

/**
 * Where the next Leaf's card goes, and which side it takes.
 *
 * Returns null when there is no next Leaf — a finished book has nothing to point at, and
 * neither does one whose progress could not be read.
 */
function layoutCard(input: RoadmapLabelInput, labels: readonly RoadmapLabel[]): RoadmapCard | null {
  const { nodes, titles, frameWidth, fontScale, cardFontSize, cardLineHeight } = input;
  const next = nodes.find((node) => node.state === 'next');

  if (next === undefined) {
    return null;
  }

  /**
   * **The card widens as text grows, up to the whole frame.**
   *
   * `graph.jsx` fixes it at 174 of 390, and at the default text size that is right — a
   * narrow card leaves the gutters to the labels. But the labels are the first thing to
   * go when a reader sizes text up, and once they are gone the gutters are empty: a card
   * still pinned to 45% of the frame then truncates its title to two characters beside
   * two columns of nothing. Taking the room the labels vacated is the only reading of
   * the source's intent that survives Dynamic Type.
   */
  const width = Math.min(
    frameWidth,
    Math.round(frameWidth * CARD_WIDTH_FRACTION * Math.max(1, fontScale)),
  );
  const title = titles[next.index] ?? '';
  const inner = width - CARD_PADDING * 2;
  const charsPerLine = Math.max(
    1,
    Math.floor(inner / Math.max(cardFontSize * fontScale * 0.52, 0.5)),
  );
  const titleLines = Math.min(
    CARD_TITLE_LINES,
    Math.max(1, wrapTitle(title, charsPerLine, CARD_TITLE_LINES).length),
  );

  // An estimate, and deliberately a slight over-estimate: erring long drops one more
  // label than strictly necessary, erring short leaves one peeking out from under an
  // opaque card. The first is invisible, the second looks like a bug.
  const eyebrow = Math.max(input.lineHeight, input.fontSize * fontScale * 1.2);
  const titleLine = Math.max(cardLineHeight, cardFontSize * fontScale * 1.2);
  const height = CARD_PADDING + CARD_CHROME_LINES * eyebrow + titleLines * titleLine;
  const y = next.centre.y + HALO_CLEARANCE + CARD_OFFSET;

  // `placeCard`'s cost function, reduced to the term that was carrying it: how much of
  // the margin each side would bury. Ties go left, which is the order `graph.jsx`
  // evaluates them in.
  const cost = (side: 'left' | 'right'): number => {
    const rect = { x: side === 'left' ? 0 : frameWidth - width, y, width, height, side };

    return labels.filter((label) => overlaps(label, rect)).length;
  };

  const side: 'left' | 'right' = cost('left') <= cost('right') ? 'left' : 'right';

  return { x: side === 'left' ? 0 : frameWidth - width, y, width, height, side };
}

/**
 * Whether a label's block intersects the card.
 *
 * A label is anchored at one edge and runs away from its node, so its horizontal extent
 * is the whole gutter on that side — which is what it is allowed to occupy and what the
 * component lays it out into.
 */
function overlaps(label: RoadmapLabel, card: RoadmapCard): boolean {
  const left = label.side === 'left' ? 0 : label.x;
  const right = label.side === 'left' ? label.x : Infinity;

  return (
    label.top < card.y + card.height &&
    label.top + label.height > card.y &&
    left < card.x + card.width &&
    right > card.x
  );
}

/**
 * The hairline from a cell to a label that has drifted away from it.
 *
 * Omitted when the label still sits level with its node, which is most of them — a
 * leader drawn to a label that has not moved is a tick mark on the side of a cell.
 *
 * `graph.jsx` draws this as a quadratic. Everything else in this drawing is cubic, by a
 * rule with a test behind it, so the quadratic is raised exactly rather than
 * approximated: a cubic with controls at `p + 2/3(q - p)` is the same curve.
 */
function leaderPath(
  node: RoadmapNodeGeometry,
  side: 'left' | 'right',
  anchorX: number,
  labelCentreY: number,
): string | null {
  if (Math.abs(labelCentreY - node.centre.y) <= LEADER_THRESHOLD) {
    return null;
  }

  const startX = side === 'left' ? node.centre.x - node.radius * 0.9 : node.centre.x + node.radius * 0.9;
  const start = { x: startX, y: node.centre.y };
  const end = { x: side === 'left' ? anchorX + 2 : anchorX - 2, y: labelCentreY };
  const control = {
    x: side === 'left' ? anchorX + 6 : anchorX - 6,
    y: (node.centre.y + labelCentreY) / 2,
  };

  const c1 = {
    x: start.x + (2 / 3) * (control.x - start.x),
    y: start.y + (2 / 3) * (control.y - start.y),
  };
  const c2 = {
    x: end.x + (2 / 3) * (control.x - end.x),
    y: end.y + (2 / 3) * (control.y - end.y),
  };

  return `M${start.x.toFixed(2)},${start.y.toFixed(2)}C${c1.x.toFixed(2)},${c1.y.toFixed(
    2,
  )} ${c2.x.toFixed(2)},${c2.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
}

/**
 * Greedy word wrap, with the overflow folded into an ellipsis on the last line.
 *
 * **Every line is a verbatim run of the author's words**, and the only thing this adds
 * to the title is the ellipsis. When the title will not fit, the last line is not the
 * last *wrapped* line — it is the whole remaining text truncated, so the break still
 * lands on a word boundary rather than wherever the wrap happened to fall.
 */
export function wrapTitle(
  title: string,
  maxChars: number,
  maxLines: number,
): readonly string[] {
  const words = title.trim().split(/\s+/u).filter((word) => word.length > 0);

  if (words.length === 0 || maxChars <= 0 || maxLines <= 0) {
    return [];
  }

  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current !== '') {
      wrapped.push(current);
    }

    current = word;
  }

  if (current !== '') {
    wrapped.push(current);
  }

  // A word longer than the whole line has no boundary to break on, so greedy wrapping
  // leaves it sitting over its budget — and it would render straight out of the gutter
  // and across the graph. The line it lands on is therefore the last one that can be
  // shown, whether or not the line budget has been reached.
  const overflow = wrapped.slice(0, maxLines).findIndex((line) => line.length > maxChars);

  if (wrapped.length <= maxLines && overflow === -1) {
    return wrapped;
  }

  const keep = overflow === -1 ? maxLines - 1 : overflow;
  const kept = wrapped.slice(0, keep);
  const remainder = wrapped.slice(keep).join(' ');

  return [...kept, truncateTitle(remainder, maxChars)];
}

/**
 * Whether a state's label is drawn at all, and how loudly.
 *
 * Split out so the component does not decide it inline: `done` and `revisit` are Leaves
 * the reader has read and can be shown in full voice, `locked` is a book they have not
 * opened and stays muted. Same rule the previous build applied through `labelFor`, kept
 * across the port.
 */
export function labelIsReached(state: LeafNodeState): boolean {
  return state === 'done' || state === 'revisit' || state === 'next';
}


/**
 * Whether the Leaf number will fit inside the cell that carries it.
 *
 * `graph.jsx` sets it in SVG at a fixed 15px, which cannot happen here: `Text.tsx` is the
 * only component allowed to touch `allowFontScaling` and it never disables it, so this
 * glyph scales with the OS setting like every other. At the accessibility sizes it grows
 * past the 30-point cell and renders as a clipped sliver.
 *
 * Same rule the labels follow, for the same reason: **under a legibility floor, drop it
 * rather than draw a stub.** Nothing is lost when it goes — the cell keeps its aura, its
 * fill and its breathing ring, the card beneath it still says "Leaf 3 · next", and the
 * node's accessibility label still reads the number and the title out in full.
 */
export function showsLeafNumber(radius: number, fontSize: number, fontScale: number): boolean {
  return fontSize * fontScale <= radius * 1.6;
}
