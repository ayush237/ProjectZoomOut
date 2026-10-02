"""VO-4.1 A3 — the stale-audio check: free, read-only, and not green because it is blind. Tier A.

**Seen red against the real shape of a drifted Leaf before it is trusted.** Leaf 9's payoff is
built here from the two actual sentences: the one its attached audio was narrated from and the
one the Leaf says now, and their digests are asserted to be the ones the CMS database showed
(`13c9a963…` stored, `66262e04…` current). A fixture that only *looked* like Leaf 9 could be
matched by a check that was blind to the real thing.

A check that says "nothing is stale" is only worth reading if it could have said otherwise, so
the compared counts are part of what is asserted, and so is every way it could fail to look: an
anonymous key (an anonymous 200 shows no drafts), a Track that is not the run's, a draft that is
a different version from the published one.
"""

from __future__ import annotations

import ast
import copy
import inspect
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets.narration import NARRATED_FIELDS, text_digest
from zoomout_pipeline.graph.narration_stale import (
    DRAFT,
    LIVE,
    LeafCheck,
    StaleEntry,
    check_leaf,
    summary,
)

from .narration_fakes import FakePayload, leaf_doc

# What Leaf 9's attached audio was narrated from, and what the Leaf says now. ZoomOut's own prose.
NARRATED = (
    "This combination illustrates Taleb's 'barbell strategy': pairing extreme caution with small, "
    "calculated risks. Keeping most of your savings safe prevents ruin, while a secondary income "
    "stream and small investments expose you to massive potential gains if your main industry "
    "faces a downturn."
)
CURRENT = (
    "This combination illustrates Taleb's 'barbell strategy': pairing extreme caution with small, "
    "calculated risks. Keeping most of your savings safe prevents ruin, while a secondary income "
    "stream, paired with small investments, exposes you to massive potential gains if your main "
    "industry faces a downturn."
)


def test_the_two_sentences_are_the_ones_the_cms_showed() -> None:
    """The fixture is Leaf 9's real shape or this fails: these are the digests read from the CMS
    database, stored `13c9a963…` against current `66262e04…`."""
    assert text_digest(NARRATED).startswith("13c9a963")
    assert text_digest(CURRENT).startswith("66262e04")


# ------------------------------------------------------------------------------ documents


def clean(
    doc: dict[str, Any], *, narrators: tuple[str, ...] = ("female", "male")
) -> dict[str, Any]:
    """Every narrated slide carries a row per narrator, each digest of the slide's own text."""
    for group, field in NARRATED_FIELDS.values():
        doc[group]["audio"] = [
            {
                "narrator": narrator,
                "url": f"/api/media/file/x-{group}-{narrator}.mp3",
                "durationSeconds": 10.0,
                "textDigest": text_digest(doc[group][field]),
            }
            for narrator in narrators
        ]
    return doc


def leaf_nine() -> dict[str, Any]:
    """Leaf 9 as it is: the payoff says CURRENT and its audio says NARRATED. Nothing else is off."""
    doc = clean(leaf_doc(order=9, leaf_id=271))
    doc["payoff"]["body"] = CURRENT
    for row in doc["payoff"]["audio"]:
        row["textDigest"] = text_digest(NARRATED)
    return doc


def with_draft(doc: dict[str, Any]) -> dict[str, Any]:
    """The same Leaf as a pending draft: a copy, status draft."""
    drafted = copy.deepcopy(doc)
    drafted["_status"] = "draft"
    return drafted


# =============================================================================== the pure check


def test_leaf_nines_actual_shape_is_stale_in_both_voices_in_the_published_version() -> None:
    doc = leaf_nine()

    result = check_leaf(order=9, live=doc, latest=doc)

    assert [(e.slide, e.narrator, e.version) for e in result.stale] == [
        ("payoff", "female", LIVE),
        ("payoff", "male", LIVE),
    ]
    assert {e.stored[:8] for e in result.stale} == {"13c9a963"}
    assert {e.current[:8] for e in result.stale} == {"66262e04"}
    assert (result.live_compared, result.draft_compared) == (8, 0)
    assert not result.pending_draft, "the newest version is the published one: no pending draft"


def test_a_clean_leaf_is_clean_and_says_how_much_it_looked_at() -> None:
    doc = clean(leaf_doc(order=4))

    result = check_leaf(order=4, live=doc, latest=doc)

    assert result.stale == ()
    assert (result.live_compared, result.draft_compared) == (8, 0)


def test_a_leaf_with_no_pending_draft_is_reported_once_not_twice() -> None:
    """Comparing the published version with itself would count every stale entry twice."""
    doc = leaf_nine()

    result = check_leaf(order=9, live=doc, latest=copy.deepcopy(doc))

    assert len(result.stale) == 2 and {e.version for e in result.stale} == {LIVE}


def test_a_draft_that_fixes_a_stale_published_entry_leaves_the_published_one_reported() -> None:
    """The published Leaf is what readers get, and a pending draft is not published: the stale
    entries stay on the list until the draft is, and say which version they are in."""
    live = leaf_nine()
    fixed = with_draft(leaf_nine())
    for row in fixed["payoff"]["audio"]:
        row["textDigest"] = text_digest(CURRENT)

    result = check_leaf(order=9, live=live, latest=fixed)

    assert result.pending_draft
    assert [(e.slide, e.version) for e in result.stale] == [("payoff", LIVE), ("payoff", LIVE)]
    assert (result.live_compared, result.draft_compared) == (8, 8)


def test_a_draft_whose_own_text_was_edited_under_its_audio_is_stale_in_the_draft() -> None:
    live = clean(leaf_doc(order=2))
    edited = with_draft(live)
    edited["takeaway"]["body"] += " And then somebody changed it."

    result = check_leaf(order=2, live=live, latest=edited)

    assert [(e.slide, e.narrator, e.version) for e in result.stale] == [
        ("takeaway", "female", DRAFT),
        ("takeaway", "male", DRAFT),
    ]


def test_a_stored_digest_is_compared_the_way_the_backend_compares_it() -> None:
    """The backend trims and lower-cases before it compares, so a digest in capitals with a
    trailing space is not dropped there and must not be called stale here."""
    doc = clean(leaf_doc(order=4))
    for row in doc["summary"]["audio"]:
        row["textDigest"] = "  " + str(row["textDigest"]).upper() + " \n"

    assert check_leaf(order=4, live=doc, latest=doc).stale == ()


def test_an_entry_with_no_digest_is_stale_because_the_backend_drops_it_too() -> None:
    doc = clean(leaf_doc(order=4))
    del doc["scenario"]["audio"][0]["textDigest"]
    doc["scenario"]["audio"][1]["textDigest"] = None

    result = check_leaf(order=4, live=doc, latest=doc)

    assert [e.stored for e in result.stale] == ["", ""]
    assert all("(none)" in e.line() for e in result.stale)


def test_audio_beside_a_field_with_no_text_is_stale_not_silently_fine() -> None:
    doc = clean(leaf_doc(order=4))
    del doc["payoff"]["body"]

    result = check_leaf(order=4, live=doc, latest=doc)

    assert [e.slide for e in result.stale] == ["payoff", "payoff"]
    assert {e.current for e in result.stale} == {"(no text)"}


def test_a_slide_with_no_audio_has_nothing_to_be_stale_and_nothing_is_counted_for_it() -> None:
    doc = clean(leaf_doc(order=4))
    doc["payoff"]["audio"] = []

    result = check_leaf(order=4, live=doc, latest=doc)

    assert result.stale == () and result.live_compared == 6


def test_the_line_names_leaf_slide_narrator_version_and_eight_hex_of_each_digest() -> None:
    entry = StaleEntry(
        order=9,
        slide="payoff",
        narrator="female",
        version=LIVE,
        stored=text_digest(NARRATED),
        current=text_digest(CURRENT),
    )

    assert entry.line().split() == [
        "leaf", "9", "payoff", "female", "live", "stored", "13c9a963", "current", "66262e04",
    ]  # fmt: skip


def _checks(*, stale: int, leaves: int) -> list[LeafCheck]:
    return [
        LeafCheck(order=o, pending_draft=False, live_compared=8, draft_compared=0, stale=())
        for o in range(leaves - stale)
    ]


def test_the_summary_line_counts_slides_and_leaves_not_just_entries() -> None:
    nine = check_leaf(order=9, live=leaf_nine(), latest=leaf_nine())
    two = leaf_nine()
    two["order"] = 2
    ten = check_leaf(order=10, live=leaf_nine(), latest=with_draft(leaf_nine()))

    assert summary([nine]) == "1 stale slide in 1 Leaf — 2 audio entries (live 2, draft 0)"
    assert summary(_checks(stale=0, leaves=18)) == "no stale slides in 18 Leaves"
    assert summary(_checks(stale=0, leaves=1)) == "no stale slides in 1 Leaf"
    # Stale in the published version AND in its own draft: one slide, four entries.
    drafted = with_draft(leaf_nine())
    result = check_leaf(order=10, live=leaf_nine(), latest=drafted)
    assert summary([result]) == "1 stale slide in 1 Leaf — 4 audio entries (live 2, draft 2)"
    assert summary([nine, ten]).startswith("2 stale slides in 2 Leaves — 6 audio entries")


# ============================================================================= the command


class Cms(FakePayload):
    """A fake Payload that knows who it is and which Leaves a Track has, and writes nothing."""

    def __init__(
        self, *leaves: dict[str, Any], email: str | None = "pipeline-bot@zoomout.local"
    ) -> None:
        super().__init__(*leaves)
        self.email = email

    def whoami(self) -> dict[str, Any]:
        return {"email": self.email, "accountType": "machine"} if self.email else {}

    def list_leaves(self, *, track_id: int) -> list[dict[str, Any]]:
        return [copy.deepcopy(self.latest(leaf_id)) for leaf_id in self.live]

    def update_leaf_draft(self, *, leaf_id: int, patch: dict[str, Any]) -> dict[str, Any]:
        raise AssertionError("the stale check wrote to a Leaf")

    def upload_media(self, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("the stale check uploaded a file")


class ExplodingGraph:
    """The run's checkpoint, which this command may read and must not write."""

    def update_state(self, *_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("the stale check wrote to the run's state")


def run_stale(
    monkeypatch: pytest.MonkeyPatch,
    cms: Cms,
    *,
    leaf_ids: dict[str, int] | None = None,
    extra: list[str] | None = None,
) -> Any:
    state = SimpleNamespace(
        cms_track_id=50,
        cms_leaf_ids=(
            {str(doc["orderIndex"]): int(doc["id"]) for doc in cms.live.values()}
            if leaf_ids is None
            else leaf_ids
        ),
    )

    @contextmanager
    def fake_run_context() -> Iterator[tuple[ExplodingGraph, Any]]:
        yield ExplodingGraph(), SimpleNamespace(settings=None, payload_client=cms)

    monkeypatch.setattr(cli, "run_context", fake_run_context)
    monkeypatch.setattr(cli, "read_run_state", lambda _graph, _run_id: state)
    return CliRunner().invoke(cli.app, ["narration-stale", "--run-id", "ikigai", *(extra or [])])


def a_book() -> list[dict[str, Any]]:
    """Leaves 0-8 and 10-11 clean, and Leaf 9 as it really is."""
    return [
        *(clean(leaf_doc(order=o, leaf_id=262 + o)) for o in range(9)),
        leaf_nine(),
        *(clean(leaf_doc(order=o, leaf_id=262 + o)) for o in (10, 11)),
    ]


def test_it_is_red_against_leaf_nines_actual_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    """**The test the handoff asks for before the check is trusted**: the real shape, through the
    command, in a book of twelve Leaves whose other eleven are fine."""
    result = run_stale(monkeypatch, Cms(*a_book()))
    out = result.output

    assert result.exit_code == 1, out
    assert out.count("stored 13c9a963") == 2
    assert "leaf  9  payoff    female live" in out and "leaf  9  payoff    male   live" in out
    assert "current 66262e04" in out
    assert "1 stale slide in 1 Leaf — 2 audio entries (live 2, draft 0)" in out
    assert "dropped by the backend rather than served" in out
    # Not blind: it says what it looked at, which is every entry of every Leaf.
    assert "compared   : 96 audio entries — 96 in the published versions, 0 in 0 pending" in out
    # Only Leaf 9 is named.
    assert out.count("stored ") == 2


def test_it_is_green_on_clean_leaves_and_still_shows_what_it_looked_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    book = [clean(leaf_doc(order=o, leaf_id=262 + o)) for o in range(4)]

    result = run_stale(monkeypatch, Cms(*book))

    assert result.exit_code == 0, result.output
    assert "no stale slides in 4 Leaves" in result.output
    assert "compared   : 32 audio entries" in result.output
    assert "stored " not in result.output


def test_it_reads_a_pending_draft_as_well_as_the_published_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Leaf 5's draft was edited under its audio; Leaf 9's published audio is stale and its
    draft fixes it. Both are in the answer, each marked with the version it is in."""
    book = [clean(leaf_doc(order=o, leaf_id=262 + o)) for o in (5, 6)] + [leaf_nine()]
    cms = Cms(*book)
    edited = with_draft(cms.live[267])
    edited["summary"]["body"] += " Edited in the draft."
    cms.draft[267] = edited
    fixed = with_draft(leaf_nine())
    for row in fixed["payoff"]["audio"]:
        row["textDigest"] = text_digest(CURRENT)
    cms.draft[271] = fixed

    result = run_stale(monkeypatch, cms)
    out = result.output

    assert result.exit_code == 1, out
    assert "leaf  5  summary   female draft" in out and "leaf  5  summary   male   draft" in out
    assert "leaf  9  payoff    female live" in out, "the published entry stays on the list"
    assert "2 stale slides in 2 Leaves — 4 audio entries (live 2, draft 2)" in out
    assert "Publishing a pending draft that carries matching audio fixes a stale published" in out
    assert "in 2 pending drafts" in out


def test_it_cannot_construct_anything_that_spends_or_write_anything(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**Exploding fakes.** The speech client, the listening model, the budget and the narration
    session are all made to fail if they are so much as constructed; the CMS refuses every write
    and the run's checkpoint refuses an update. The command still has to finish and say 'stale'."""

    def boom(name: str) -> Any:
        def exploded(*_args: Any, **_kwargs: Any) -> None:
            raise AssertionError(f"the stale check constructed {name}")

        return exploded

    monkeypatch.setattr("zoomout_pipeline.assets.speech.SpeechClient", boom("SpeechClient"))
    monkeypatch.setattr("zoomout_pipeline.graph.narration_nodes.Guard", boom("Guard"))
    monkeypatch.setattr("zoomout_pipeline.assets.budget.NarrationBudget", boom("NarrationBudget"))
    monkeypatch.setattr(cli, "_Narration", boom("_Narration"))
    cms = Cms(*a_book())

    result = run_stale(monkeypatch, cms)

    assert result.exit_code == 1, result.output
    assert isinstance(result.exception, SystemExit), result.exception
    assert cms.patches == [] and cms.uploads == []
    assert "AssertionError" not in result.output


def test_the_command_never_names_a_paid_client_a_write_or_the_narration_session() -> None:
    """The same claim, as a property of the source: no name in the command's body that could
    spend or write. Complements the exploding fakes, which only see what a test happens to run."""
    tree = ast.parse(inspect.getsource(cli))
    command = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "narration_stale"
    )
    forbidden = {
        "SpeechClient",
        "Guard",
        "NarrationBudget",
        "_Narration",
        "render_line",
        "attach_leaf_narration",
        "update_leaf_draft",
        "upload_media",
        "update_state",
        "open_run_for_narration",
        "open_run_for_models",
        "record_narration_transport",
        "RunLedger",
    }
    names = {n.id for n in ast.walk(command) if isinstance(n, ast.Name)} | {
        n.attr for n in ast.walk(command) if isinstance(n, ast.Attribute)
    }

    assert names & forbidden == set()
    assert "read_run_state" in names and "_checked_cms" in names, "and it does use the safe doors"


def test_an_anonymous_key_is_refused_before_a_single_leaf_is_read(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An anonymous 200 shows no drafts, so a check run as nobody would say "clean" about a Track
    with a stale draft in it. It is refused instead."""
    cms = Cms(*a_book(), email=None)

    result = run_stale(monkeypatch, cms)

    assert result.exit_code == 1
    assert "ANONYMOUS" in result.output
    assert cms.calls == [], "not one Leaf was read"
    assert "no stale slides" not in result.output


def test_a_track_whose_leaves_are_not_the_runs_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    cms = Cms(*a_book())

    result = run_stale(monkeypatch, cms, leaf_ids={"0": 262, "1": 999})

    assert result.exit_code == 1
    assert "Refusing to check a Track whose Leaves are not the ones this run knows" in result.output
    assert cms.calls == []


def test_a_run_with_no_leaves_in_payload_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    result = run_stale(monkeypatch, Cms(*a_book()), leaf_ids={})

    assert result.exit_code == 1 and "has no Leaves in Payload to check" in result.output


def test_it_is_a_command_of_its_own_and_not_a_flag_on_narrate() -> None:
    """So the code that can spend is never constructed by it, and so `narrate --help` is not the
    place anybody looks for it."""
    import typer.main

    group: Any = typer.main.get_command(cli.app)
    narrate_flags = {flag for param in group.commands["narrate"].params for flag in param.opts}

    assert "narration-stale" in group.commands
    assert not any("stale" in flag for flag in narrate_flags)
    docs = inspect.getdoc(cli.narration_stale) or ""
    assert "Free and read-only" in docs and "cannot spend or write" in docs
    assert (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8").count(
        "narration-stale"
    ) >= 2
