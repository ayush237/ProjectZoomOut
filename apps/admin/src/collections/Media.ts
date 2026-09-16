import { machinesNeverDelete } from '../access/publishing';
import type { CollectionConfig } from 'payload';

/**
 * Uploaded media — scenario illustrations, sticky-note diagrams, and (VO-1) slide
 * voiceover audio.
 *
 * **Set up now, before anything generates an asset**, because the Phase 2 pipeline
 * writes into this collection: giving it a home the app already reads means the
 * pipeline's output has somewhere to land instead of becoming a second storage
 * decision made under time pressure.
 *
 * **`alt` is required at the collection level.** The shared schema already makes an
 * image asset without alt text unrepresentable, and the publish rules enforce it again
 * on the Leaf — this is the third gate, and it is the one that catches an image the
 * moment it is uploaded rather than when someone tries to publish a Leaf using it.
 * The three exist for the reason WP1 recorded: a single shared predicate means one
 * bug defeats every gate. **`audioRefSchema` carries no `alt` field**, so this
 * requirement is inert for an audio upload — an admin still has to type something to
 * satisfy it, but nothing downstream reads it for audio. Flagged in VO-1's completion
 * report, not fixed here: whether audio needs its own accessibility field (a
 * transcript) is a product decision, not this package's.
 *
 * **Image-only processing (resize, focal point, dimension probing) is gated by
 * Payload's own `canResizeImage`/`isImage` mimetype checks in its upload pipeline**,
 * not by anything in this config — so an audio upload skips all of it automatically
 * rather than failing or needing a parallel "don't do this for audio" branch here.
 *
 * Read access is public for the same reason the content collections are: the backend
 * calls Payload anonymously over private networking, and a file the app cannot fetch
 * does not reach a reader.
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
     * Images, plus the one audio type the voiceover pipeline produces (VO-1).
     * Deliberately an explicit list rather than `image/*` or `audio/*`: SVG is an
     * image type that can carry script, and this collection is written to by an
     * automated pipeline, so the list stays exact instead of admitting whatever a
     * future model or format happens to emit.
     *
     * `audio/mpeg` only, not `audio/mp4`/`audio/wav`/`audio/ogg` — Google Cloud TTS is
     * the pipeline's only audio producer today (VO-1 handoff) and emits mp3. A narrower
     * list is the safer default; widen it if a second audio producer needs to.
     */
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg'],
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
