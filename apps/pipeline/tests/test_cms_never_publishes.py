"""Tier A — the pipeline writes drafts and never publishes.

The arrangement the whole content model rests on: Payload's publish-time validation is the
last gate and is deliberately independent of anything the pipeline believes. That
independence is worth nothing if the pipeline can publish.

The refusal happens before any request is sent, so these need no Payload and no credentials.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from zoomout_pipeline.cms.client import (
    PayloadClient,
    PayloadError,
    PayloadPublishAttemptError,
)
from zoomout_pipeline.cms.mapper import DRAFT_STATUS
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.models import (
    Acquisition,
    BookProvenance,
    GeneratedExtras,
    SourceFormat,
)


def client() -> PayloadClient:
    return PayloadClient(base_url="http://127.0.0.1:9", api_key="unused")


@pytest.mark.parametrize("status", ["published", "PUBLISHED", None, "", "draft "])
def test_writing_a_track_that_is_not_a_draft_is_refused(status: object) -> None:
    """Anything that is not exactly `draft` is refused — including `None`, which is what a
    payload built by hand and missing `_status` would carry."""
    payload: dict[str, object] = {"bookTitle": "A book"}
    if status is not None:
        payload["_status"] = status

    with pytest.raises(PayloadPublishAttemptError):
        client().create_track(payload)


@pytest.mark.parametrize("status", ["published", None])
def test_writing_a_leaf_that_is_not_a_draft_is_refused(status: object) -> None:
    payload: dict[str, object] = {"title": "A leaf"}
    if status is not None:
        payload["_status"] = status

    with pytest.raises(PayloadPublishAttemptError):
        client().create_leaf(payload)


def test_a_draft_gets_past_the_guard_and_is_only_stopped_by_the_network() -> None:
    """The guard must not be refusing everything.

    A test that only ever asserts rejection passes just as well against a client that
    refuses all writes, which would prove nothing about the rule it is named for. This one
    shows a draft reaches the transport — where it fails for an unrelated reason, because the
    base URL points at a closed port.
    """
    with pytest.raises(PayloadError) as error:
        client().create_track({"bookTitle": "A book", "_status": DRAFT_STATUS})

    assert not isinstance(error.value, PayloadPublishAttemptError)


def test_the_client_has_no_way_to_publish() -> None:
    """Enforced by absence as well as by a guard.

    A method that does not exist cannot be called by mistake in WP19, when somebody is
    adding the review surface and reaches for the obvious verb.
    """
    surface = {name for name in dir(PayloadClient) if not name.startswith("_")}

    assert not {name for name in surface if "publish" in name.lower()}
    assert surface == {
        "create_track",
        "create_leaf",
        "update_leaf_draft",
        "upload_media",
        "find_leaf",
        "find_track",
        "get_track",
        "get_leaf",
    }, (
        "The surface is asserted exactly so that adding a method is a deliberate act. If "
        "this fails because you added one, check it cannot publish and then update the set."
    )


def test_the_node_uses_the_injected_client_rather_than_building_one(
    deps: NodeDependencies, tmp_path: Path
) -> None:
    """Tests must never reach the real CMS, and this is what enforces it.

    Before this, the moment `write_drafts_to_cms` joined the graph a resume test ran to
    completion and wrote a 22-Leaf "A Test Book" Track into real Payload — twice, because
    the durability test builds its dependencies in a subprocess where the fixture does not
    reach. Nothing was wrong with the node. Nothing had stopped the test from calling it.
    """
    from zoomout_pipeline.graph.cms_node import make_write_drafts_node
    from zoomout_pipeline.graph.state import PipelineState
    from zoomout_pipeline.models import GeneratedLeafRecord

    from .conftest import make_generated_leaf

    state = PipelineState(
        run_id="run-cms",
        source_path=str(tmp_path / "book.epub"),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        provenance=_provenance_for_test(),
        generated={
            "0": GeneratedLeafRecord(
                order=0,
                title="A Leaf",
                leaf=make_generated_leaf(),
                extras=GeneratedExtras(),
                cited_chunk_ids=[],
            )
        },
    )

    result = make_write_drafts_node(deps)(state)

    stub = deps.payload_client
    assert result["cms_track_id"] == 9001, "the injected stub must have served the write"
    assert getattr(stub, "created_tracks", None), "the stub recorded no Track"
    assert getattr(stub, "created_leaves", None), "the stub recorded no Leaf"
    assert stub.created_tracks[0]["_status"] == DRAFT_STATUS  # type: ignore[union-attr]


def test_a_preset_track_id_is_written_into_rather_than_creating_a_second_track(
    deps: NodeDependencies, tmp_path: Path
) -> None:
    """WP20's `--cms-track-id`: regenerating a Track must not fork it.

    Track 42's text was regenerated from scratch, and a run that created its own Track
    would have left two Tracks of one book in the CMS — with the founder reviewing
    whichever they happened to open, and publishing a coin flip.

    The assertion that matters is `created_tracks == []`. Asserting only that the returned
    id is 42 would pass just as happily if the node created Track 42 all over again.
    """
    from zoomout_pipeline.graph.cms_node import make_write_drafts_node
    from zoomout_pipeline.graph.state import PipelineState
    from zoomout_pipeline.models import GeneratedLeafRecord

    from .conftest import make_generated_leaf

    state = PipelineState(
        run_id="run-cms-preset",
        source_path=str(tmp_path / "book.epub"),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        provenance=_provenance_for_test(),
        cms_track_id=42,
        generated={
            "0": GeneratedLeafRecord(
                order=0,
                title="A Leaf",
                leaf=make_generated_leaf(),
                extras=GeneratedExtras(),
                cited_chunk_ids=[],
            )
        },
    )

    result = make_write_drafts_node(deps)(state)
    stub = deps.payload_client

    assert result["cms_track_id"] == 42, "the preset Track must be the one written into"
    assert stub.created_tracks == [], (  # type: ignore[union-attr]
        "no Track may be created when one was named — that is the whole point of the flag"
    )
    assert stub.created_leaves, "the Leaves still have to be written somewhere"  # type: ignore[union-attr]
    assert stub.created_leaves[0]["trackId"] == 42  # type: ignore[union-attr]


def _provenance_for_test() -> BookProvenance:
    from datetime import UTC, datetime

    return BookProvenance(
        title="A Test Book",
        author="A Test Author",
        source="test.epub",
        file_hash="test",
        source_format=SourceFormat.EPUB,
        acquisition=Acquisition.PUBLIC_DOMAIN,
        ingested_at=datetime(2026, 8, 27, tzinfo=UTC),
    )


@pytest.mark.parametrize("status", ["published", "PUBLISHED"])
def test_patching_a_leaf_cannot_smuggle_a_publish(status: str) -> None:
    """`_status` is forced to draft on the way out, so a patch naming `published` is
    overwritten rather than honoured — and the guard runs on the result either way."""
    with pytest.raises(PayloadError) as error:
        client().update_leaf_draft(leaf_id=1, patch={"_status": status, "title": "x"})

    # It failed at the transport (closed port), not at the guard — because the forced draft
    # status made it a legal write. The point is that it can never become a publish.
    assert not isinstance(error.value, PayloadPublishAttemptError)
