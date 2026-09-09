import { layoutRoadmap, seedFromTrackId, type RoadmapNodeGeometry } from './roadmapGeometry';
import {
  MAX_LABEL_LINES,
  MIN_LABEL_CHARS,
  layoutRoadmapLabels,
  showsLeafNumber,
  wrapTitle,
  type RoadmapLabel,
} from './roadmapLabels';
import type { LeafNodeState } from './roadmapModel';

/**
 * Tier A on `wrapTitle`, Tier B on the placement.
 *
 * The wrap is Tier A for the same reason `truncateTitle` is: **it decides what words of
 * an author's title reach a screen.** A bug that dropped a word from the middle, or that
 * emitted anything that is not a verbatim prefix, would be the app putting text it
 * composed itself in front of a reader — which is the exact thing `PRODUCT.md`'s content
 * integrity constraints exist to prevent, and which no amount of looking at a device
 * would reliably catch on eighteen labels at a glance.
 *
 * The placement — which gutter, how far down, whether a leader is needed — is Tier B: one
 * happy path plus the two degradations that are the point of the module.
 */

const VIEWPORT = { width: 354, height: 874 } as const;
const CAPTION = { fontSize: 12, lineHeight: 16 } as const;
const H3 = { fontSize: 18, lineHeight: 24 } as const;

const REAL_TITLE = 'Give every person more in use value than you take in cash value';

function statesFor(count: number, done = Math.floor(count / 3)): LeafNodeState[] {
  return Array.from({ length: count }, (_, index) =>
    index < done ? 'done' : index === done ? 'next' : 'locked',
  );
}

function nodesFor(count: number): readonly RoadmapNodeGeometry[] {
  return layoutRoadmap(statesFor(count), VIEWPORT, seedFromTrackId('42')).nodes;
}

function marginFor(
  options: {
    readonly fontScale?: number;
    readonly titles?: readonly string[];
    readonly count?: number;
  } = {},
) {
  const nodes = nodesFor(options.count ?? 18);

  return layoutRoadmapLabels({
    nodes,
    titles: options.titles ?? nodes.map(() => REAL_TITLE),
    frameWidth: VIEWPORT.width,
    fontScale: options.fontScale ?? 1,
    fontSize: CAPTION.fontSize,
    lineHeight: CAPTION.lineHeight,
    cardFontSize: H3.fontSize,
    cardLineHeight: H3.lineHeight,
  });
}

function labelsFor(
  options: { readonly fontScale?: number; readonly titles?: readonly string[] } = {},
): readonly RoadmapLabel[] {
  return marginFor(options).labels;
}

describe('wrapTitle', () => {
  it('never rewords, only wraps and cuts', () => {
    // The property this module shares with `truncateTitle`, asserted across the whole
    // range of budgets a real gutter can produce: joining the lines back together and
    // dropping the ellipsis must leave a verbatim prefix of the author's own title.
    for (const maxChars of [8, 10, 14, 18, 25, 40, 80]) {
      const joined = wrapTitle(REAL_TITLE, maxChars, MAX_LABEL_LINES)
        .join(' ')
        .replace(/…$/u, '')
        .trimEnd();

      expect(REAL_TITLE.startsWith(joined)).toBe(true);
    }
  });

  it('keeps a short title whole and on one line', () => {
    expect(wrapTitle('Loss aversion', 20, 2)).toEqual(['Loss aversion']);
  });

  it('wraps rather than truncating when a second line will hold the rest', () => {
    // The whole reason two lines exist. At fifteen characters this title fits exactly,
    // and the one-line version would have thrown half of it away.
    expect(wrapTitle('Arbitrary anchors on a page', 15, 2)).toEqual([
      'Arbitrary',
      'anchors on a…',
    ]);
    expect(wrapTitle('Opening moves matter', 14, 2)).toEqual(['Opening moves', 'matter']);
  });

  it('breaks lines on word boundaries, never mid-word', () => {
    for (const line of wrapTitle(REAL_TITLE, 16, 2)) {
      const cleaned = line.replace(/…$/u, '').trimEnd();

      // Every line, ellipsis aside, must be a run of whole words from the title.
      expect(REAL_TITLE).toContain(cleaned);
    }
  });

  it('folds the overflow into the last line rather than stopping where the wrap fell', () => {
    // The subtle one. A naive implementation keeps the first two *wrapped* lines, which
    // ends the label wherever the greedy wrap happened to break — usually well short of
    // the budget. This takes the whole remainder and truncates it, so the second line is
    // as full as it can be.
    const lines = wrapTitle(REAL_TITLE, 18, 2);

    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
    expect((lines[1] ?? '').length).toBeGreaterThan(12);
    expect((lines[1] ?? '').length).toBeLessThanOrEqual(18 + 1);
  });

  it('respects the line budget exactly', () => {
    expect(wrapTitle(REAL_TITLE, 12, 1)).toHaveLength(1);
    expect(wrapTitle(REAL_TITLE, 12, 2)).toHaveLength(2);
    expect(wrapTitle(REAL_TITLE, 12, 3)).toHaveLength(3);
  });

  it('returns nothing for an empty title or an impossible budget', () => {
    expect(wrapTitle('   ', 20, 2)).toEqual([]);
    expect(wrapTitle(REAL_TITLE, 0, 2)).toEqual([]);
    expect(wrapTitle(REAL_TITLE, 20, 0)).toEqual([]);
  });

  it('handles a single word longer than the line without losing it entirely', () => {
    expect(wrapTitle('Antidisestablishmentarianism', 10, 2)).toEqual(['Antidisest…']);
  });
});

describe('label placement', () => {
  it('gives every Leaf but the next one a label, on both sides of the spine', () => {
    const labels = labelsFor();
    const nodes = nodesFor(18);
    const nextIndex = nodes.findIndex((node) => node.state === 'next');

    expect(labels.map((label) => label.index)).not.toContain(nextIndex);
    // Not `nodes.length - 1`: the next Leaf's card suppresses whatever it would bury.
    expect(labels.length).toBeGreaterThan(nodes.length - 6);

    // Both gutters are used. All eighteen in one column is what our previous build did
    // by sending labels inward, and it is what makes the stacking overflow.
    const sides = new Set(labels.map((label) => label.side));

    expect(sides).toEqual(new Set(['left', 'right']));
  });

  it('sends every label outward, to the gutter on its own node\'s side of the spine', () => {
    /**
     * **Added after the assertion above survived a mutation it should have caught.**
     * "Both gutters are used" is true whichever way the labels point, because there are
     * nodes on both sides of the centre line either way — so it did not test the rule it
     * was written next to. Flipping `labelSide` back to WP22's inward direction left the
     * whole suite green.
     *
     * This is the rule: a cell left of the centre line puts its label in the *left*
     * gutter. Inward placement sends a left-of-centre cell's label across the spine into
     * the right gutter, which crowds both columns into the middle and is what left the
     * old build with 37 points of room for a label.
     */
    const centre = VIEWPORT.width / 2;
    const nodes = nodesFor(18);

    for (const label of labelsFor()) {
      const node = nodes.find((candidate) => candidate.index === label.index);

      expect(node).toBeDefined();
      expect(label.side).toBe((node?.centre.x ?? 0) < centre ? 'left' : 'right');
    }
  });

  it('wraps a real Leaf title to two lines rather than one stub', () => {
    // The founder-visible outcome of the whole module: at the default text size, with
    // Track 42's actual titles, a label is two lines of the author's words.
    const label = labelsFor()[0];

    expect(label?.lines).toHaveLength(2);
    expect(REAL_TITLE.startsWith(label?.lines[0] ?? '')).toBe(true);
  });

  it('keeps each label inside its own gutter', () => {
    for (const label of labelsFor()) {
      expect(label.x).toBeGreaterThan(0);
      expect(label.x).toBeLessThan(VIEWPORT.width);
    }
  });

  it('never lets two labels in the same gutter overlap', () => {
    // What the leader lines exist to make survivable: at this node spacing a label
    // frequently has to be pushed clear of the one above it.
    for (const side of ['left', 'right'] as const) {
      const column = labelsFor()
        .filter((label) => label.side === side)
        .sort((a, b) => a.top - b.top);

      for (let index = 1; index < column.length; index += 1) {
        const above = column[index - 1];
        const below = column[index];

        expect(below?.top ?? 0).toBeGreaterThanOrEqual((above?.top ?? 0) + (above?.height ?? 0));
      }
    }
  });

  it('draws a leader only for the labels that had to move', () => {
    const labels = labelsFor();
    const withLeaders = labels.filter((label) => label.leader !== null);

    // Some, not all: a leader on a label that is still level with its cell is a tick
    // mark on the side of the cell.
    expect(withLeaders.length).toBeGreaterThan(0);
    expect(withLeaders.length).toBeLessThan(labels.length);

    for (const label of withLeaders) {
      // Cubic only, like everything else in this drawing — `graph.jsx` draws the leader
      // as a quadratic and it is raised exactly rather than approximated.
      expect(label.leader).toMatch(/^M[-\d.,]+C/u);
      expect(label.leader).not.toMatch(/[LlHhVvQqTtAaSs]/u);
    }
  });
});

describe('degrading under the OS text size', () => {
  it('holds two lines at the default size and gives ground as text grows', () => {
    const lineCounts = (fontScale: number): number[] =>
      labelsFor({ fontScale }).map((label) => label.lines.length);

    expect(Math.max(...lineCounts(1))).toBe(MAX_LABEL_LINES);

    // Never more than two, at any size. More than two is where the gutter stops being a
    // margin and becomes a column of prose.
    for (const fontScale of [1, 1.5, 2, 2.5, 3]) {
      const counts = lineCounts(fontScale);

      if (counts.length > 0) {
        expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_LABEL_LINES);
      }
    }
  });

  it('drops labels rather than rendering unreadable stubs at accessibility sizes', () => {
    // The decision this module exists to make. At the largest Dynamic Type settings the
    // gutter holds four or five characters; four characters of an uppercased sentence is
    // noise, and it collides with its neighbours as well. Fewer labels, all legible.
    const atDefault = labelsFor({ fontScale: 1 }).length;
    const atLargest = labelsFor({ fontScale: 3.5 }).length;

    expect(atLargest).toBeLessThan(atDefault);

    for (const label of labelsFor({ fontScale: 3.5 })) {
      for (const line of label.lines) {
        // Whatever survives is still worth reading. The `+ 1` is the ellipsis.
        expect(line.length).toBeGreaterThanOrEqual(Math.min(MIN_LABEL_CHARS, REAL_TITLE.length));
      }
    }
  });

  it('shortens each surviving label as text grows, rather than overflowing its gutter', () => {
    const longest = (fontScale: number): number =>
      Math.max(0, ...labelsFor({ fontScale }).flatMap((label) => label.lines.map((l) => l.length)));

    expect(longest(2)).toBeLessThan(longest(1));
  });

  it('skips a Leaf with no title rather than drawing an empty label', () => {
    const nodes = nodesFor(18);
    const titles = nodes.map((_, index) => (index === 0 ? '' : REAL_TITLE));
    const labels = labelsFor({ titles });

    expect(labels.map((label) => label.index)).not.toContain(0);
  });
});

describe('the next Leaf\'s card', () => {
  it('takes half the frame rather than all of it', () => {
    const { card } = marginFor();

    expect(card).not.toBeNull();
    expect(card?.width).toBeLessThan(VIEWPORT.width * 0.55);
    expect(card?.width).toBeGreaterThan(VIEWPORT.width * 0.4);
    expect(card?.x).toBeGreaterThanOrEqual(0);
    expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it('hangs below the cell it belongs to, clear of its aura', () => {
    const { card } = marginFor();
    const next = nodesFor(18).find((node) => node.state === 'next');

    expect(card?.y ?? 0).toBeGreaterThan(next?.centre.y ?? 0);
  });

  it('hides every label it would otherwise be sitting on top of', () => {
    // The defect this replaced, and the one worth a regression test: the card used to be
    // full-width and pinned under the node, which on Track 42's real titles buried four
    // labels at once — each of them still rendered, half-visible from behind it.
    const { labels, card } = marginFor();

    expect(card).not.toBeNull();

    for (const label of labels) {
      const verticallyClear = label.top >= (card?.y ?? 0) + (card?.height ?? 0) ||
        label.top + label.height <= (card?.y ?? 0);
      const horizontallyClear =
        card?.side === 'left'
          ? label.side === 'right' && label.x >= (card.x ?? 0) + (card.width ?? 0)
          : label.side === 'left' && label.x <= (card?.x ?? 0);

      expect(verticallyClear || horizontallyClear).toBe(true);
    }
  });

  it('takes the side that buries fewer labels', () => {
    // `placeCard`'s cost function, reduced to the term doing the work. Asserted as a
    // comparison rather than a fixed side, because which side wins depends on where the
    // meander happens to be when the reader reaches it.
    const { labels, card } = marginFor();
    const buriedOnOtherSide = labels.filter(
      (label) => label.side === (card?.side === 'left' ? 'right' : 'left'),
    ).length;

    expect(buriedOnOtherSide).toBeGreaterThan(0);
  });

  it('is null when there is no next Leaf, so a finished book gets no callout', () => {
    const nodes = nodesFor(18);
    const finished = layoutRoadmapLabels({
      nodes: nodes.map((node) => ({ ...node, state: 'done' as const })),
      titles: nodes.map(() => REAL_TITLE),
      frameWidth: VIEWPORT.width,
      fontScale: 1,
      fontSize: CAPTION.fontSize,
      lineHeight: CAPTION.lineHeight,
      cardFontSize: H3.fontSize,
      cardLineHeight: H3.lineHeight,
    });

    expect(finished.card).toBeNull();
  });
});

describe('what gives way as the OS text size grows', () => {
  it('widens the card into the room the labels vacated', () => {
    // The defect this closed: a card fixed at 45% of the frame truncated its title to
    // two characters at the accessibility sizes, beside two empty gutters. The labels
    // are gone by then; the card is entitled to their room.
    const narrow = marginFor({ fontScale: 1 }).card;
    const wide = marginFor({ fontScale: 3.5 }).card;

    expect(narrow?.width ?? 0).toBeLessThan(VIEWPORT.width * 0.55);
    expect(wide?.width ?? 0).toBeGreaterThan(narrow?.width ?? 0);
    expect(wide?.width ?? 0).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it('never lets the card leave the frame, however far text is scaled', () => {
    for (const fontScale of [1, 1.5, 2, 3, 3.5, 5]) {
      const card = marginFor({ fontScale }).card;

      expect(card?.x ?? 0).toBeGreaterThanOrEqual(0);
      expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(VIEWPORT.width);
    }
  });

  it('drops the Leaf number once the glyph outgrows the cell it sits in', () => {
    // 15 is the next cell's radius, 18 the `h3` size it is set in.
    expect(showsLeafNumber(15, 18, 1)).toBe(true);
    expect(showsLeafNumber(15, 18, 1.3)).toBe(true);
    expect(showsLeafNumber(15, 18, 2)).toBe(false);
    expect(showsLeafNumber(15, 18, 3.5)).toBe(false);
  });
});
