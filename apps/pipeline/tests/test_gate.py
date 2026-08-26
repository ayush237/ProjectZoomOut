"""Gate 1 — the file is the plan, and edits to it are what the run continues with."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from zoomout_pipeline.graph.gate import GateFileError, read_plan_file, write_plan_file
from zoomout_pipeline.graph.structure_check import check_structure
from zoomout_pipeline.models import MAX_LEAVES, MIN_LEAVES

from .conftest import make_plan


def _write(tmp_path: Path, **overrides: object) -> Path:
    plan = make_plan(leaves=20, chapter_count=17)
    kwargs: dict[str, object] = {
        "path": tmp_path / "leaf-plan.yaml",
        "run_id": "run-test",
        "title": "The Science of Getting Rich",
        "author": "W. D. Wattles",
        "chapter_count": 17,
        "chapter_titles": [f"Chapter {i}" for i in range(17)],
        "plan": plan,
        "check": check_structure(plan, chapter_count=17),
        "escalation": None,
        "min_leaves": MIN_LEAVES,
        "max_leaves": MAX_LEAVES,
    }
    kwargs.update(overrides)
    return write_plan_file(**kwargs)  # type: ignore[arg-type]


def test_round_trips_a_plan(tmp_path: Path) -> None:
    path = _write(tmp_path)

    plan, approved = read_plan_file(path)

    assert approved is False, "a freshly written plan is never pre-approved"
    assert len(plan.leaves) == 20


def test_an_edited_title_is_what_comes_back(tmp_path: Path) -> None:
    """The founder is editing, not just accepting."""
    path = _write(tmp_path)

    raw = yaml.safe_load(path.read_text())
    raw["leaves"][3]["title"] = "Gratitude is a mechanism, not a mood"
    raw["approved"] = True
    path.write_text(yaml.safe_dump(raw, sort_keys=False))

    plan, approved = read_plan_file(path)

    assert approved is True
    assert plan.leaves[3].title == "Gratitude is a mechanism, not a mood"


def test_the_header_carries_the_structure_verdict_and_the_chapter_list(tmp_path: Path) -> None:
    plan = make_plan(leaves=17, mirror=True, chapter_count=17)
    path = _write(
        tmp_path,
        plan=plan,
        check=check_structure(plan, chapter_count=17),
        escalation="cap reached",
    )

    text = path.read_text()
    assert "Structure check: FAILED" in text
    assert "ESCALATED" in text
    assert "0: Chapter 0" in text, "the writer needs the chapter list to set source_chapters"


def test_a_gap_in_order_is_rejected_with_the_file_named(tmp_path: Path) -> None:
    """The likeliest hand-edit mistake: deleting a Leaf and leaving a hole in `order`."""
    path = _write(tmp_path)
    raw = yaml.safe_load(path.read_text())
    del raw["leaves"][5]
    path.write_text(yaml.safe_dump(raw, sort_keys=False))

    with pytest.raises(GateFileError) as error:
        read_plan_file(path)

    assert str(path) in str(error.value)


def test_a_missing_file_is_an_error_not_an_empty_plan(tmp_path: Path) -> None:
    with pytest.raises(GateFileError):
        read_plan_file(tmp_path / "nope.yaml")
