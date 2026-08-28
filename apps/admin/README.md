# ZoomOut CMS (Payload)

Content authoring for Tracks and Leaves. Runs on port 3001.

```bash
npm run dev --workspace=apps/admin
```

Reachable at both `http://localhost:3001/admin` and `http://127.0.0.1:3001/admin`. The
second one needs `allowedDevOrigins` in `next.config.ts` — without it Next refuses the
admin UI's own JavaScript chunks and the page renders blank with nothing in the console
explaining why.

## Accounts

Two kinds, separated by `accountType` on the `admins` collection.

| | Human | Machine |
|---|---|---|
| Signs in with | email + password | an API key |
| Can publish | yes | **no** |
| Can write drafts | yes | yes |
| Can touch published content | yes | **no** |

### Creating a human operator

```bash
PAYLOAD_ADMIN_EMAIL=you@example.com PAYLOAD_ADMIN_PASSWORD=... \
  npm run create-admin --workspace=apps/admin
```

Re-running it against an existing email resets that password and clears any login
lockout. It never deletes an account.

### Creating the pipeline's API key

```bash
npm run create-pipeline-key --workspace=apps/admin
```

Creates `pipeline-bot@zoomout.local` as a machine account and prints its key **once**:

```
Authorization: admins API-Key <key>
```

Payload stores only a hash, so the key cannot be read back. Copy it into the pipeline's
environment. **Do not commit it** — it belongs in `apps/pipeline`'s `.env`, which is
gitignored.

Re-running the script **rotates** the key: the old one stops working immediately.

### Revoking the key

Untick **Enable API Key** on the account in the admin UI, or delete the account. Either
clears the stored hash and the key stops authenticating at once. Neither touches any
human's password — that separation is the point of the machine account existing.

> Turning the flag off directly in the database does **not** revoke the key. Payload
> clears the key hash as part of its own update; flipping the column by hand leaves the
> hash in place and the key keeps working. Revoke through Payload.

## Why a machine account cannot publish

`src/access/publishing.ts`. A machine may create drafts and may update through
Payload's draft mechanism (`?draft=true`), which writes to the versions table. It can
never write the published row, so it cannot publish, cannot unpublish, and cannot edit
live content — regardless of what the code holding the key does.

The pipeline's own client also refuses to send anything but a draft. That belt is worth
keeping; it just is not the thing being relied on.
