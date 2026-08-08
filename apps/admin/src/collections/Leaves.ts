import { SLIDE_KEYS } from '@zoomout/shared';
import type { CollectionConfig, Field } from 'payload';

import { publishedOrAuthenticated } from '../access/published';
import { trimTextFields } from '../hooks/trimText';
import { validateBeforeChange } from '../hooks/validateBeforeChange';
import { validateLeaf } from '../validation/leafRules';
import type { LeafDocumentInput } from '../validation/types';

/**
 * A Leaf is one atomic learning unit: five slides, in a fixed order.
 *
 * The five slides are five named `group` fields — not a blocks or repeater array.
 * This is the single most important modelling decision in the content model, and it
 * mirrors the same decision in `packages/shared/src/content.ts`. A repeater would make
 * "exactly these five, in this order" an authoring convention enforced by nobody; as
 * groups it is structural, in the database, the API and the generated types.
 */

/**
 * Per-slide audio reference, reserved for Phase 2 voiceover.
 *
 * Hidden from the admin UI rather than omitted: the column and the API shape exist
 * from day one, so enabling audio later is a data migration rather than a schema
 * change across three workspaces — but the founder authoring content today is not
 * shown a field they must leave empty.
 */
const audioField: Field = {
  name: 'audio',
  type: 'group',
  admin: {
    hidden: true,
    description: 'Reserved for Phase 2 voiceover. Unused in Phase 1.',
  },
  fields: [
    { name: 'url', type: 'text' },
    { name: 'durationSeconds', type: 'number', min: 0 },
  ],
};

export const Leaves: CollectionConfig = {
  slug: 'leaves',

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'trackId', 'orderIndex', 'isPlaceholder', '_status'],
    description:
      'One learning unit: Summary → Scenario → Payoff → Sticky Notes → Takeaway. All five must be filled in before publishing.',
  },

  access: {
    read: publishedOrAuthenticated,
  },

  versions: {
    drafts: true,
  },

  hooks: {
    // Order matters: trim first, then validate. Otherwise a whitespace-only field
    // reads as present to the rules and is stored blank — which is precisely how
    // `" ; \n"` and a note-only source reference got through the schema-freeze gate.
    beforeChange: [trimTextFields, validateBeforeChange<LeafDocumentInput>('leaves', validateLeaf)],
  },

  fields: [
    {
      name: 'trackId',
      type: 'relationship',
      relationTo: 'tracks',
      required: true,
      admin: {
        description: 'The Track this Leaf belongs to.',
      },
    },
    {
      name: 'orderIndex',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Position within the Track, starting at 0.',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },

    /* ---------------------------------------------------------------------- */
    /* The five slides                                                        */
    /* ---------------------------------------------------------------------- */

    {
      name: 'summary',
      type: 'group',
      label: '1 · Summary',
      admin: { description: 'Short, fast-to-read framing of the concept.' },
      fields: [{ name: 'body', type: 'textarea' }, audioField],
    },

    {
      name: 'scenario',
      type: 'group',
      label: '2 · Scenario',
      admin: {
        description:
          'A relatable situation with three answer options. Exactly one must be correct — that is the gate that unlocks the Payoff slide.',
      },
      fields: [
        { name: 'prompt', type: 'textarea' },
        {
          name: 'options',
          type: 'array',
          minRows: 3,
          maxRows: 3,
          admin: {
            description: 'Exactly three. Tick exactly one as correct.',
          },
          fields: [
            { name: 'text', type: 'text' },
            {
              name: 'isCorrect',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Never sent to the app with the options — the server decides correctness.',
              },
            },
          ],
        },
        audioField,
      ],
    },

    {
      name: 'payoff',
      type: 'group',
      label: '3 · Payoff',
      admin: {
        description: 'The deeper explanation, unlocked only after a correct answer.',
      },
      fields: [{ name: 'body', type: 'textarea' }, audioField],
    },

    {
      name: 'stickyNotes',
      type: 'group',
      label: '4 · Sticky Notes',
      admin: { description: 'Key points, shown as notes on a board.' },
      fields: [
        {
          name: 'notes',
          type: 'array',
          // Bounded 2–6, ruled at the schema-freeze gate (2026-08-08). One note is
          // not a recap; more than six stops fitting the board in WP8. Mirrors the
          // same bound in `stickyNotesSlideSchema`.
          minRows: 2,
          maxRows: 6,
          admin: { description: 'Between 2 and 6 notes.' },
          fields: [{ name: 'note', type: 'text' }],
        },
        audioField,
      ],
    },

    {
      name: 'takeaway',
      type: 'group',
      label: '5 · Takeaway',
      admin: { description: 'The one thing to remember, plus an optional deep-cut fact.' },
      fields: [
        { name: 'body', type: 'textarea' },
        {
          name: 'dinnerTableKnowledge',
          type: 'textarea',
          admin: {
            description:
              'Optional deep-cut fact. Cannot be saved without a Source Reference on the "takeaway" slide — an unsourced claim attributed to a real author is the highest-severity risk in the product.',
          },
        },
        audioField,
      ],
    },

    /* ---------------------------------------------------------------------- */
    /* Traceability                                                            */
    /* ---------------------------------------------------------------------- */

    {
      name: 'sourceReferences',
      type: 'array',
      admin: {
        description:
          'Where each factual claim comes from. Required for Dinner Table Knowledge, and the audit trail the fair-use position rests on.',
      },
      // A nested array on the Leaf rather than a separate collection, deliberately: a
      // beforeChange hook only sees the document it is saving, so the Dinner Table
      // Knowledge invariant would be unenforceable across a relationship.
      fields: [
        {
          name: 'slideKey',
          type: 'select',
          required: true,
          options: SLIDE_KEYS.map((key) => ({ label: key, value: key })),
        },
        { name: 'chapter', type: 'text' },
        { name: 'page', type: 'text' },
        { name: 'quote', type: 'textarea' },
        {
          name: 'note',
          type: 'textarea',
          required: true,
          admin: { description: 'What in the book supports this. Required.' },
        },
      ],
    },

    {
      name: 'isPlaceholder',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'Mock content. Defaults to ON so nothing reaches production by accident — untick only for real, fact-checked content.',
      },
    },
  ],
};
