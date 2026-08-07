/* Payload's Next.js integration boilerplate.
 *
 * Payload regenerates files under `(payload)/` and stamps them "do not modify". This
 * one is modified anyway, deliberately: the upstream template tracks Payload's
 * unreleased `main` branch and imports `generatePayloadViewport`, which does not exist
 * in the pinned 3.87.0 release. If a future Payload upgrade regenerates this file,
 * check that import first.
 */
import config from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
