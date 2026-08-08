import type { CollectionConfig } from 'payload';

import { publishedOrAuthenticated } from '../access/published';
import { trimTextFields } from '../hooks/trimText';
import { validateBeforeChange } from '../hooks/validateBeforeChange';
import { validateTrack } from '../validation/trackRules';
import type { TrackDocumentInput } from '../validation/types';

/**
 * A Track is one book's complete learning path.
 *
 * Field names mirror `packages/shared/src/content.ts` exactly. That is not cosmetic:
 * WP3's `ContentRepository` maps these API responses straight onto the shared `Track`
 * type, and a rename here is a silent breakage there.
 *
 * There is deliberately no `status` field. Publish state is Payload's own
 * draft/published mechanism, which is what powers takedown — see `access/published.ts`.
 */
export const Tracks: CollectionConfig = {
  slug: 'tracks',

  admin: {
    useAsTitle: 'bookTitle',
    defaultColumns: ['bookTitle', 'author', 'isPlaceholder', '_status', 'updatedAt'],
    description:
      'One book, one Track. A Track cannot be published without a non-endorsement disclaimer and at least one purchase link.',
  },

  access: {
    read: publishedOrAuthenticated,
  },

  versions: {
    drafts: true,
  },

  hooks: {
    // Trim before validate — see the note on the Leaves collection.
    beforeChange: [trimTextFields, validateBeforeChange<TrackDocumentInput>('tracks', validateTrack)],
  },

  fields: [
    {
      name: 'bookTitle',
      type: 'text',
      required: true,
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'publisher',
      type: 'text',
      admin: {
        description: 'For self-published titles, use "Independently published".',
      },
    },
    {
      name: 'coverUrl',
      type: 'text',
      admin: {
        description: 'URL of the book cover image.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'disclaimer',
      type: 'textarea',
      admin: {
        description:
          'Non-endorsement disclaimer, shown on the Track. Required to publish — this supports the fair-use position and is not optional copy.',
      },
    },
    {
      name: 'purchaseLinks',
      type: 'array',
      minRows: 1,
      admin: {
        description:
          'Where a reader can buy the book. At least one complete link is required to publish: ZoomOut is positioned as a complement to the book, not a substitute for it.',
      },
      fields: [
        { name: 'retailer', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'isAffiliate', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'leafCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description:
          'How many Leaves this Track is intended to have. Target is 15–30; ~20 is the Phase 1 planning figure.',
      },
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
