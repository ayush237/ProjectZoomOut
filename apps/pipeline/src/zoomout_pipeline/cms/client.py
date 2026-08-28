"""A minimal Payload REST client.

Deliberately small: create a draft Track, create draft Leaves, read either back. It is not a
general CMS SDK, and every method it does not have is a method that cannot accidentally
publish something.

**The never-publish guarantee is enforced here, not remembered.** Every payload is checked
for `_status: "draft"` before it is sent, and the client has no publish method at all. The
pipeline writing drafts and Payload's publish-time validation being the last independent gate
is the arrangement the whole content model rests on.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any
from uuid import uuid4

from zoomout_pipeline.cms.mapper import DRAFT_STATUS
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

DEFAULT_TIMEOUT_SECONDS = 30


class PayloadError(RuntimeError):
    """A CMS call failed, or was refused before it was made."""


class PayloadPublishAttemptError(PayloadError):
    """Something tried to write a non-draft. Refused.

    Its own type so a test can assert this specific refusal rather than any old error, and
    so it can never be mistaken for a transport failure in a log.
    """


def _assert_draft(payload: dict[str, Any], *, what: str) -> None:
    status = payload.get("_status")
    if status != DRAFT_STATUS:
        raise PayloadPublishAttemptError(
            f"refusing to write {what} with _status={status!r}. The pipeline writes drafts "
            "and never publishes — publishing is a human decision at a gate this code has no "
            "way to reach."
        )


class PayloadClient:
    """Talks to Payload over REST, as an authenticated operator."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        if not base_url:
            raise PayloadError("No Payload URL. Set ZOOMOUT_PIPELINE_PAYLOAD_URL.")
        if not api_key:
            raise PayloadError(
                "No Payload API key. Set ZOOMOUT_PIPELINE_PAYLOAD_API_KEY — provisioned by "
                "`npm run create-pipeline-key --workspace=apps/admin` (WP15.2). The founder "
                "holds it; it is not in the repo."
            )
        self._base = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout_seconds

    # ------------------------------------------------------------------ transport

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        url = f"{self._base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if authenticated:
            # `admins API-Key` — the format Payload's useAPIKey auth expects, not JWT/Bearer.
            # WP15.2 provisioned this as a machine account that can create and update drafts
            # and is refused everything that would publish, unpublish or edit a live document
            # (verified there against every vector, not just documented).
            headers["Authorization"] = f"admins API-Key {self._api_key}"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                return dict(json.loads(response.read().decode() or "{}"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode()[:500]
            raise PayloadError(f"{method} {path} failed: {error.code} {detail}") from error
        except urllib.error.URLError as error:
            raise PayloadError(
                f"{method} {path} could not reach Payload at {self._base}: {error.reason}"
            ) from error

    # --------------------------------------------------------------------- writes

    def create_track(self, payload: dict[str, Any]) -> int:
        _assert_draft(payload, what="a Track")
        result = self._request("POST", "/api/tracks", body=payload)
        track_id = _extract_id(result)
        _log.info("payload.track_created", track_id=track_id, status=payload.get("_status"))
        return track_id

    def create_leaf(self, payload: dict[str, Any]) -> int:
        _assert_draft(payload, what="a Leaf")
        result = self._request("POST", "/api/leaves", body=payload)
        leaf_id = _extract_id(result)
        _log.info(
            "payload.leaf_created",
            leaf_id=leaf_id,
            order=payload.get("orderIndex"),
            references=len(payload.get("sourceReferences", [])),
        )
        return leaf_id

    # ---------------------------------------------------------------------- reads

    def get_track(self, track_id: int, *, draft: bool = True) -> dict[str, Any]:
        return self._get_document("tracks", track_id, draft=draft)

    def get_leaf(self, leaf_id: int, *, draft: bool = True) -> dict[str, Any]:
        return self._get_document("leaves", leaf_id, draft=draft)

    def upload_media(self, *, data: bytes, filename: str, alt: str) -> dict[str, Any]:
        """Upload one image to Payload's media collection.

        `alt` is required by the collection and by the shared schema, so it is a parameter
        rather than an option — WP15 made an asset without alt text unpublishable, which
        means an image with no alt is not a degraded asset but a Leaf that cannot ship.

        Multipart is hand-rolled because this is the only multipart call in the package and
        a dependency for one request would be a poor trade.
        """
        if not alt.strip():
            raise PayloadError(
                f"refusing to upload {filename} with empty alt text — an asset without alt "
                "cannot be published, so uploading one just moves the failure later"
            )

        boundary = f"----zoomout{uuid4().hex}"
        # Payload expects the document's own fields as a single JSON part named `_payload`,
        # alongside the binary `file`. Sending them as separate form fields looks reasonable
        # and is silently ignored — the upload then fails on `alt` being required, which
        # reads as a bug in the alt text rather than in the encoding.
        document = json.dumps({"alt": alt})
        body = b"".join(
            [
                f"--{boundary}\r\n".encode(),
                b'Content-Disposition: form-data; name="_payload"\r\n\r\n',
                document.encode(),
                f"\r\n--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
                b"Content-Type: image/png\r\n\r\n",
                data,
                f"\r\n--{boundary}--\r\n".encode(),
            ]
        )

        request = urllib.request.Request(
            f"{self._base}/api/media",
            data=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Authorization": f"admins API-Key {self._api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                result = dict(json.loads(response.read().decode() or "{}"))
        except urllib.error.HTTPError as error:
            raise PayloadError(
                f"uploading {filename} failed: {error.code} {error.read().decode()[:400]}"
            ) from error

        doc = result.get("doc", result)
        _log.info("payload.media_uploaded", media_id=doc.get("id"), filename=filename)
        return dict(doc)

    def update_leaf_draft(self, *, leaf_id: int, patch: dict[str, Any]) -> dict[str, Any]:
        """Patch a Leaf's **draft** version.

        `_status` is forced to draft on the way out and the payload goes through the same
        guard as a create, so there is no path here that publishes — including one that
        patches `_status` itself.
        """
        body = {**patch, "_status": DRAFT_STATUS}
        _assert_draft(body, what="a Leaf update")

        # `draft=true` matters: without it Payload patches the published version, and a
        # document that has only ever been a draft has none.
        query = urllib.parse.urlencode({"draft": "true"})
        result = self._request("PATCH", f"/api/leaves/{leaf_id}?{query}", body=body)
        _log.info("payload.leaf_updated", leaf_id=leaf_id, fields=sorted(patch))
        return dict(result.get("doc", result))

    def find_leaf(self, *, track_id: int, order_index: int) -> int | None:
        """The existing draft Leaf at this position, if there is one.

        Idempotency asked of the CMS rather than of our own memory. A write interrupted
        partway leaves Leaves in Payload that the run has no record of — its node returns
        its bookkeeping only on success — so a retry that trusted local state would create
        a second copy of everything it had already written. Asking what is there cannot go
        stale in the same way.
        """
        query = urllib.parse.urlencode(
            {
                "where[trackId][equals]": str(track_id),
                "where[orderIndex][equals]": str(order_index),
                "draft": "true",
                "depth": "0",
                "limit": "1",
            }
        )
        result = self._request("GET", f"/api/leaves?{query}")
        docs = result.get("docs")
        if not isinstance(docs, list) or not docs:
            return None
        return int(docs[0]["id"])

    def find_track(self, *, file_hash_title: str) -> int | None:
        """An existing draft Track with this exact title, if there is one."""
        query = urllib.parse.urlencode(
            {
                "where[bookTitle][equals]": file_hash_title,
                "draft": "true",
                "depth": "0",
                "limit": "1",
                "sort": "-id",
            }
        )
        result = self._request("GET", f"/api/tracks?{query}")
        docs = result.get("docs")
        if not isinstance(docs, list) or not docs:
            return None
        return int(docs[0]["id"])

    def _get_document(self, collection: str, doc_id: int, *, draft: bool) -> dict[str, Any]:
        """Read one document.

        `draft=True` matters more than it looks: without it Payload resolves the *published*
        version, and a document that has only ever been a draft has none — so a round-trip
        check that forgot the flag would report the write as missing rather than as a draft.
        """
        query = urllib.parse.urlencode({"draft": "true" if draft else "false", "depth": "0"})
        return self._request("GET", f"/api/{collection}/{doc_id}?{query}")


def _extract_id(result: dict[str, Any]) -> int:
    doc = result.get("doc", result)
    raw = doc.get("id") if isinstance(doc, dict) else None
    if raw is None:
        raise PayloadError(f"Payload response carried no id: {json.dumps(result)[:200]}")
    return int(raw)
