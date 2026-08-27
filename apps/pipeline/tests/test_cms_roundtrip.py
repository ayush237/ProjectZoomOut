"""The maximal-fixture round-trip, against real Payload.

**This is the test WP15's defect exists to justify.** That package shipped a backend mapper
carrying none of its three new fields, and 932 passing tests could not see it — because a
dropped optional field is indistinguishable from a field that legitimately has none. Source
references, Dinner Table Knowledge and apply-in-life are all optional fields.

It runs against **real Payload**, not a stand-in, deliberately: a stand-in is written from
the same understanding as the code under test and inherits its blind spots. The only thing
that can contradict that understanding is the real server.

Marked `live` and excluded from the normal gate. Run it with:

    uv run pytest -m live -k roundtrip
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import pytest

from zoomout_pipeline.cms.client import PayloadClient, PayloadError
from zoomout_pipeline.cms.mapper import DRAFT_STATUS, leaf_payload, track_payload
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.models import (
    Acquisition,
    BookProvenance,
    Citation,
    Claim,
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    ScenarioOptionDraft,
    SlideKey,
    SourceFormat,
)

pytestmark = pytest.mark.live

FIXTURE_QUOTE = "There is a thinking stuff from which all things are made."

PASSAGE = Passage(
    ref="P1",
    chunk_id=901,
    chapter_index=4,
    chapter_title="CHAPTER IV. The First Principle",
    position_in_chapter=2,
    text=f"{FIXTURE_QUOTE} It permeates and fills the interspaces of the universe.",
    distance=0.05,
)


@pytest.fixture
def client() -> PayloadClient:
    email = os.environ.get("ZOOMOUT_PIPELINE_PAYLOAD_EMAIL", "")
    password = os.environ.get("ZOOMOUT_PIPELINE_PAYLOAD_PASSWORD", "")
    if not email or not password:
        pytest.skip(
            "Set ZOOMOUT_PIPELINE_PAYLOAD_EMAIL and ZOOMOUT_PIPELINE_PAYLOAD_PASSWORD to run "
            "the round-trip against real Payload."
        )

    built = PayloadClient(
        base_url=os.environ.get("ZOOMOUT_PIPELINE_PAYLOAD_URL", "http://localhost:3001"),
        email=email,
        password=password,
    )
    try:
        built.get_track(1)
    except PayloadError as error:
        if "could not reach" in str(error):
            pytest.skip(f"Payload is not running: {error}")
    return built


def _maximal_record() -> GeneratedLeafRecord:
    """A Leaf with every field the pipeline can produce, all populated.

    Deliberately maximal: the failure this guards against is a field silently not arriving,
    and a field that is empty in the fixture cannot demonstrate that it survived.
    """
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="The book describes an original thinking substance.",
            citations=[Citation(passage_ref="P1", note="the passage introduces it")],
        ),
        Claim(
            slide_key=SlideKey.PAYOFF,
            text="It is described as filling the universe.",
            citations=[
                Citation(passage_ref="P1", note="verbatim from the passage", quote=FIXTURE_QUOTE)
            ],
        ),
        Claim(
            slide_key=SlideKey.TAKEAWAY,
            text="The claim is presented as a first principle.",
            citations=[Citation(passage_ref="P1", note="the chapter frames it as foundational")],
        ),
    ]

    return GeneratedLeafRecord(
        order=0,
        title="WP17 round-trip fixture — every optional field populated",
        leaf=GeneratedLeaf(
            summary_body="A summary body.",
            scenario_prompt="A scenario prompt with a real dilemma.",
            scenario_options=[
                ScenarioOptionDraft(text="The correct option", is_correct=True),
                ScenarioOptionDraft(text="A plausible wrong option", is_correct=False),
                ScenarioOptionDraft(text="Another plausible wrong option", is_correct=False),
            ],
            payoff_body="A payoff body that explains why.",
            sticky_notes=["Note one", "Note two", "Note three"],
            takeaway_body="A takeaway body.",
            claims=claims,
        ),
        extras=GeneratedExtras(
            dinner_table_knowledge="A deep-cut fact worth repeating.",
            apply_in_life="One concrete thing to do tomorrow.",
            claims=[],
        ),
        cited_chunk_ids=[901],
    )


def _provenance() -> BookProvenance:
    return BookProvenance(
        title="WP17 round-trip fixture Track",
        author="W. D. Wattles",
        source="pg59844.epub",
        file_hash="roundtrip-fixture",
        source_format=SourceFormat.EPUB,
        acquisition=Acquisition.PUBLIC_DOMAIN,
        ingested_at=datetime(2026, 8, 27, tzinfo=UTC),
    )


def test_every_field_survives_the_round_trip(client: PayloadClient) -> None:
    """Write a maximal Leaf, read it back, and check each field individually.

    Asserted field by field rather than by comparing whole documents: Payload adds its own
    keys and normalises others, so a whole-document comparison would fail for reasons that
    are not the thing under test, and would be relaxed until it stopped failing.
    """
    track_id = client.create_track(
        track_payload(
            provenance=_provenance(),
            acquisition=Acquisition.PUBLIC_DOMAIN,
            leaf_count=1,
            description="A round-trip fixture Track.",
        )
    )

    record = _maximal_record()
    leaf_id = client.create_leaf(
        leaf_payload(record=record, track_id=track_id, passages={901: PASSAGE})
    )

    track = client.get_track(track_id)
    leaf: dict[str, Any] = client.get_leaf(leaf_id)

    # --- the Track
    assert track["acquisition"] == "public-domain", "R6's provenance must survive the write"
    assert track["_status"] == DRAFT_STATUS, "the pipeline must never publish"
    assert track["isPlaceholder"] is False

    # --- the five slides
    assert leaf["summary"]["body"] == "A summary body."
    assert leaf["scenario"]["prompt"] == "A scenario prompt with a real dilemma."
    assert leaf["payoff"]["body"] == "A payoff body that explains why."
    assert leaf["takeaway"]["body"] == "A takeaway body."

    # --- the answer key
    options = leaf["scenario"]["options"]
    assert len(options) == 3
    assert sum(1 for option in options if option["isCorrect"]) == 1

    # --- sticky notes, stored as rows
    notes = [row["note"] for row in leaf["stickyNotes"]["notes"]]
    assert notes == ["Note one", "Note two", "Note three"]

    # --- the WP15-shaped optional fields: the actual reason this test exists
    assert leaf["takeaway"]["dinnerTableKnowledge"] == "A deep-cut fact worth repeating."
    assert leaf["takeaway"]["applyInLife"] == "One concrete thing to do tomorrow."

    # --- the audit trail, also optional fields
    references = leaf["sourceReferences"]
    assert len(references) == 3, "one per claim; none may be dropped in transit"
    assert {r["slideKey"] for r in references} == {"summary", "payoff", "takeaway"}
    for reference in references:
        assert reference["note"], "every reference needs a note"
        assert reference["chapter"], "and at least one locator"
    quoted = [r for r in references if r.get("quote")]
    assert len(quoted) == 1
    assert quoted[0]["quote"] == FIXTURE_QUOTE, "a quote must survive character for character"

    # --- and the Leaf is a draft
    assert leaf["_status"] == DRAFT_STATUS


def test_a_draft_is_not_served_to_anonymous_readers(client: PayloadClient) -> None:
    """The independence the whole arrangement rests on.

    A draft the pipeline wrote must be invisible until a human publishes it. This is checked
    against the API without credentials rather than by reasoning about Payload's access
    rules — the same distinction WP15.1 found the hard way, where a draft `acquisition` sat
    in `_tracks_v` while anonymous REST kept serving the published value.
    """
    import json
    import urllib.error
    import urllib.request

    track_id = client.create_track(
        track_payload(
            provenance=_provenance(),
            acquisition=Acquisition.PUBLIC_DOMAIN,
            leaf_count=0,
            description="A draft that readers must not see.",
        )
    )

    base = os.environ.get("ZOOMOUT_PIPELINE_PAYLOAD_URL", "http://localhost:3001")
    try:
        with urllib.request.urlopen(f"{base}/api/tracks/{track_id}", timeout=15) as response:
            document = json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        assert error.code in (403, 404), f"unexpected status for an unpublished draft: {error.code}"
        return

    assert document.get("_status") != "published", (
        "an anonymous reader was served a Track the pipeline drafted and no human published"
    )
