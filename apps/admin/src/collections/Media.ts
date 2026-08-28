import { machinesNeverDelete } from '../access/publishing';
import type { CollectionConfig } from 'payload';

/**
 * Uploaded images — scenario illustrations and sticky-note diagrams (WP15).
 *
 * **Set up now, before anything generates an asset**, because the Phase 2 pipeline
 * writes into this collection: giving it a home the app already reads means the
 * pipeline's output has somewhere to land instead of becoming a second storage
 * decision made under time pressure.
 *
 * **`alt` is required at the collection level.** The shared schema already makes an
 * asset without alt text unrepresentable, and the publish rules enforce it again on
 * the Leaf — this is the third gate, and it is the one that catches an image the
 * moment it is uploaded rather than when someone tries to publish a Leaf using it.
 * The three exist for the reason WP1 recorded: a single shared predicate means one
 * bug defeats every gate.
 *
 * Read access is public for the same reason the content collections are: the backend
 * calls Payload anonymously over private networking, and an image the app cannot
 * fetch is an image that does not render.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'alt',
    description:
      'Illustrations and diagrams used on Leaf slides. Every image needs alt text — it is what a reader using VoiceOver gets instead of the picture.',
  },
  access: {
    read: () => true,
    /**
     * The pipeline uploads here, so it keeps create and update — but an image a Leaf
     * points at is content, and a machine deleting one breaks that Leaf as surely as
     * deleting the Leaf would. There is no draft/publish distinction to scope against
     * in this collection, so `delete` is the only rule it needs.
     */
    delete: machinesNeverDelete,
  },
  upload: {
    /**
     * Images only, and deliberately not `image/*`: SVG is an image type that can carry
     * script, and this collection is written to by an automated pipeline in Phase 2.
     */
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'What the image shows, for a reader who cannot see it. Describe the content, not the file.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      admin: {
        description:
          'Optional attribution. Generated illustrations need none; anything sourced elsewhere does.',
      },
    },
  ],
};
