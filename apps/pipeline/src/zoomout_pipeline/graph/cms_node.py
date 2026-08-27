"""Writing the finished Track into Payload as drafts.

This is §3.3's `publish_to_cms`, **renamed**. The node writes drafts and must never publish,
and a node called `publish_to_cms` that must not publish is the kind of name that eventually
gets believed. The spec's intent is unchanged; only the label is.

Payload's own publish-time validation — exactly one correct option, DTK sourced, all five
slides, disclaimer and purchase link, cover image — remains the last gate, and it is
deliberately independent of anything the pipeline believes.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.cms.mapper import leaf_payload, track_payload
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.nodes import Node
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)


def _passages_for_record(
    deps: NodeDependencies, passage_refs: dict[str, int]
) -> dict[int, Passage]:
    """Reload the passages a Leaf cited, under the handles the model actually used.

    Driven by the stored `ref -> chunk_id` mapping rather than by position. Renumbering
    handles from a sorted id list drops the high ones and re-points the rest at the wrong
    chapters — see the note on `GeneratedLeafRecord.passage_refs`.
    """
    chunk_ids = sorted(set(passage_refs.values()))
    if not chunk_ids:
        return {}

    with deps.connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, chapter_index, chapter_title, position_in_chapter, text
            FROM book_chunks WHERE id = ANY(%s)
            """,
            (chunk_ids,),
        )
        rows = {int(str(r["id"])): r for r in cur.fetchall()}

    passages: dict[int, Passage] = {}
    for ref, chunk_id in sorted(passage_refs.items()):
        row = rows.get(chunk_id)
        if row is None:
            continue
        passages[chunk_id] = Passage(
            ref=ref,
            chunk_id=chunk_id,
            chapter_index=int(str(row["chapter_index"])),
            chapter_title=str(row["chapter_title"]),
            position_in_chapter=int(str(row["position_in_chapter"])),
            text=str(row["text"] or ""),
            distance=0.0,
        )
    return passages


def make_write_drafts_node(deps: NodeDependencies, client: PayloadClient | None = None) -> Node:
    """Build the node. The client is constructed on first use unless one is injected.

    Lazily, because graph construction happens constantly — in tests, in `status`, in `cost`
    — and none of that should require a CMS login. A run that actually reaches this node
    without credentials fails here, with a message naming the variables to set.
    """

    def write_drafts_to_cms(state: PipelineState) -> dict[str, Any]:
        nonlocal client
        if client is None:
            client = deps.payload_client
        if client is None:
            client = PayloadClient(
                base_url=deps.settings.payload_url,
                email=deps.settings.payload_email,
                password=deps.settings.payload_password,
            )

        log = _log.bind(run_id=state.run_id, node="write_drafts_to_cms")

        if state.provenance is None:
            raise RuntimeError("the CMS write was reached without provenance")
        if not state.generated:
            raise RuntimeError("the CMS write was reached with no generated Leaves")

        description = (
            state.analysis.central_argument
            if state.analysis is not None
            else f"A ZoomOut Track drawn from {state.provenance.title}."
        )

        track_id = state.cms_track_id
        if track_id is None:
            track_id = client.create_track(
                track_payload(
                    provenance=state.provenance,
                    acquisition=state.acquisition,
                    leaf_count=len(state.generated),
                    description=description,
                )
            )
            log.info("cms.track_written", track_id=track_id, acquisition=state.acquisition.value)
        else:
            log.info("cms.track_reused", track_id=track_id)

        leaf_ids = dict(state.cms_leaf_ids)
        for key in sorted(state.generated, key=lambda k: int(k)):
            if key in leaf_ids:
                continue

            record = state.generated[key]

            # Ask Payload rather than trusting local bookkeeping. This node returns its
            # record of what it wrote only on success, so an interrupted write leaves Leaves
            # in the CMS that state knows nothing about — and a retry would duplicate every
            # one of them. Seen for real: a write stopped at Leaf 11 of 18.
            existing = client.find_leaf(track_id=track_id, order_index=record.order)
            if existing is not None:
                log.info("cms.leaf_exists", order=record.order, leaf_id=existing)
                leaf_ids[key] = existing
                continue

            leaf_id = client.create_leaf(
                leaf_payload(
                    record=record,
                    track_id=track_id,
                    passages=_passages_for_record(deps, record.passage_refs),
                )
            )
            leaf_ids[key] = leaf_id

        log.info("cms.complete", track_id=track_id, leaves=len(leaf_ids))
        return {"cms_track_id": track_id, "cms_leaf_ids": leaf_ids}

    return write_drafts_to_cms


__all__ = ["UUID", "make_write_drafts_node"]
