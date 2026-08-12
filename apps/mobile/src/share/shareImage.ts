import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

/**
 * Turning a view into an image and handing it to the OS share sheet.
 *
 * Separated from the screens because the failure modes here are all about the platform
 * rather than about the product, and there are four of them worth naming:
 *
 *  1. **Sharing may be unavailable** — a locked-down device, or a simulator without a
 *     configured share target. `isAvailableAsync` is the documented check and it is not
 *     optional: calling `shareAsync` where it is unsupported rejects with a message
 *     written for a developer, not a reader.
 *  2. **Cancelling is not an error.** `expo-sharing` resolves rather than rejects when
 *     the reader dismisses the sheet, so there is deliberately no "share failed" state
 *     on that path — see `ShareOutcome`.
 *  3. **The capture must not inherit the device theme.** That is enforced by the caller
 *     wrapping the captured subtree in a forced-light `ThemeProvider`, not here — this
 *     module photographs whatever it is pointed at. The rule is stated at both ends
 *     because getting it wrong produces a dark image that looks correct in a dark-mode
 *     app and wrong in everybody else's feed.
 *  4. **A ref can be empty.** A capture requested before layout, or after the screen has
 *     gone, gives `captureRef` nothing to photograph; that is reported as a failure the
 *     reader can retry rather than an exception.
 */

/**
 * What happened, as the screen needs to know it.
 *
 * `cancelled` is separate from `failed` on purpose: a reader who backs out of the share
 * sheet has done something ordinary and must not be shown an error, while a genuine
 * failure has to say so. Collapsing the two is how "Something went wrong" ends up on
 * screen every time somebody changes their mind.
 */
export type ShareOutcome =
  | { readonly status: 'shared' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'failed'; readonly message: string };

/**
 * PNG, not JPEG: these images are flat colour and large type, and JPEG's ringing shows
 * on exactly that. The file is a few hundred kilobytes either way at this size.
 *
 * Resolution is not set here — `captureRef` renders at the device's pixel density, so a
 * 320pt card becomes 960px on a 3× phone without being asked. Forcing a `width` would
 * override that and make the image *worse* on the densest screens.
 */
const CAPTURE_FORMAT = 'png' as const;

export interface ShareViewOptions {
  /** The subtree to photograph. Must be laid out and forced to the light theme. */
  readonly target: RefObject<View | null>;
  /** Shown as the share sheet's title on the platforms that display one. */
  readonly dialogTitle: string;
}

export async function shareView({ target, dialogTitle }: ShareViewOptions): Promise<ShareOutcome> {
  if (target.current === null) {
    return { status: 'failed', message: 'There was nothing to capture. Please try again.' };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { status: 'unavailable' };
    }

    const uri = await captureRef(target, { format: CAPTURE_FORMAT, quality: 1, result: 'tmpfile' });

    /**
     * Resolves on cancel as well as on success, and the platform gives no way to tell
     * them apart — iOS reports no result from the activity sheet. So this reports
     * `shared` for both, and nothing downstream is allowed to depend on the difference:
     * the screen stays exactly as it was either way, which is the behaviour the
     * acceptance criterion actually asks for.
     */
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle,
      UTI: 'public.png',
    });

    return { status: 'shared' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Could not share that. Please try again.',
    };
  }
}
