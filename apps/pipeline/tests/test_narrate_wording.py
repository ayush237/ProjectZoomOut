"""VO-4.1 leftovers (e), (j) and (o): what the source says about itself. Tier B.

Three small things that were wrong in the text around the code and not in the code, each pinned so
the old text cannot come back unnoticed.
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path

from zoomout_pipeline import cli
from zoomout_pipeline.graph import narration_nodes

SOURCE_ROOT = Path(__file__).resolve().parent.parent / "src"


def test_clip_key_says_it_is_the_only_place_for_leaf_narration_and_names_the_other() -> None:
    """(e) The greeting library builds its own cache key (`graph/greeting_nodes.py`), so "the only
    place it is built" was untrue. It is the only place for Leaf narration."""
    doc = " ".join((narration_nodes.clip_key.__doc__ or "").replace("*", "").split())

    assert "the only place it is built for Leaf narration" in doc
    assert "greeting" in doc and "graph/greeting_nodes.py" in doc


def test_nothing_in_the_source_claims_the_key_is_built_in_exactly_one_place() -> None:
    """The unqualified claim, wherever it is made: "the only place it is built" with nothing after
    it saying which narration. (The one sentence that now says it says "for Leaf narration".)"""
    unqualified = re.compile(
        r"only\s+place\s+(?:the\s+)?(?:cache's\s+)?(?:key|it)\s+is\s+built(?!\s+for)"
    )
    found = [
        str(path.relative_to(SOURCE_ROOT))
        for path in SOURCE_ROOT.rglob("*.py")
        if unqualified.search(" ".join(path.read_text(encoding="utf-8").replace("*", "").split()))
    ]

    assert found == [], found


def test_the_unqualified_claim_scan_can_see_the_old_sentence() -> None:
    unqualified = re.compile(
        r"only\s+place\s+(?:the\s+)?(?:cache's\s+)?(?:key|it)\s+is\s+built(?!\s+for)"
    )

    assert unqualified.search("the raw cache's key for one attempt - the only place it is built.")
    assert not unqualified.search("the only place it is built for Leaf narration.")


def test_checked_cms_is_typed_as_returning_the_payload_client() -> None:
    """(j) It returned `tuple[Any, ...]`, so `_Narration.client` lost its type and everything that
    used it was unchecked. The annotation is read here; that `session.client` really is a
    `PayloadClient` as far as `mypy --strict` can see is the gate's."""
    returns = str(inspect.signature(cli._checked_cms).return_annotation)

    assert returns.startswith("tuple[PayloadClient,"), returns
    assert "Any, dict" not in returns


def test_the_module_docstring_keeps_the_render_list_together_and_the_plan_after_it() -> None:
    """(o) The Plan section sat in the middle of the Render list, and "Bounded regeneration", which
    is a Render bullet, came after it as though it belonged to the Plan."""
    doc = narration_nodes.__doc__ or ""
    render = doc.index("## Render")
    plan = doc.index("## Plan")
    attach = doc.index("## Attach")

    assert render < doc.index("**Bounded regeneration.**") < plan < attach
    for bullet in (
        "Cached by what was asked",
        "On disk before anything can fail",
        "Unable to spend",
    ):
        assert render < doc.index(bullet) < plan, bullet
    assert doc.index("Bounded regeneration") > doc.index("Unable to spend, on request")
