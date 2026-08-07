import type { Access } from 'payload';

/**
 * Read access for content collections — the mechanism behind takedown.
 *
 * An authenticated admin sees everything, drafts included; that is the editor.
 * Everyone else sees only documents whose `_status` is `published`.
 *
 * This is what makes `LEGAL.md`'s hours-to-takedown obligation achievable: pulling a
 * Track is one click of Unpublish, and the constraint below drops it from every
 * subsequent API response with no deploy, no migration and no cache to bust. It is
 * enforced here rather than by each caller remembering to filter, because a
 * requirement that depends on every future caller behaving is not a control.
 */
export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) {
    return true;
  }

  return {
    _status: {
      equals: 'published',
    },
  };
};
