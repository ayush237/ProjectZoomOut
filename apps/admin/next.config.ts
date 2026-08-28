import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * The repo root, not this app's directory.
 *
 * npm workspaces hoist `next` to the root `node_modules`. Payload's stock template
 * sets `turbopack.root` to the app folder — correct for a standalone project, wrong
 * here: Next then treats `apps/admin` as the filesystem boundary, refuses to resolve
 * above it, and the build fails with "Could not find the Next.js package".
 */
const workspaceRoot = path.resolve(dirname, '../..')

const nextConfig: NextConfig = {
  /**
   * Next 16 refuses `/_next/*` requests whose `Origin` is not allowlisted, and Payload
   * loads its admin chunks `crossorigin` — so those requests carry an `Origin` header.
   * `localhost` is allowed by default; `127.0.0.1` is not, despite being the same host.
   *
   * The failure that produces is what earns the comment: the admin UI 403s **one of
   * its own JavaScript chunks** and renders a blank page, with nothing in the console
   * naming a cause. Undiagnosable from the browser, so one line of config gets seven
   * of explanation.
   */
  allowedDevOrigins: ['127.0.0.1'],

  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  // Payload's template carries a `webpack.resolve.extensionAlias` block that maps
  // `.js` imports onto `.ts` sources. It is dropped here for two reasons: Next 16
  // builds with Turbopack, which never reads it, and this workspace uses extensionless
  // relative imports (the correct form under `moduleResolution: bundler`) so there is
  // nothing left for it to map. Keeping it would only be untyped dead config.
  turbopack: {
    root: workspaceRoot,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
