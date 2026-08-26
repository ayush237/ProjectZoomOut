"""Gate 1 — the human review of the Leaf plan, as a file.

The proposal's §5 put gate 1 in Payload. **Overruled for WP16** by the handoff, for two
reasons worth keeping written down: a Payload custom admin view lives in `apps/admin`,
which this session does not own, and building CMS review UI before the pipeline has
produced anything worth reviewing is backwards. The Payload surface arrives with gate 2 in
WP19 and gets built once, for both.

So the gate is a YAML file. The pipeline writes it, interrupts, and reads it back on
resume. **The file is the plan** — edits made in it are what the run continues with, so the
founder is editing rather than merely accepting. That is the higher-leverage review by far:
the Leaf list determines everything downstream and fixing it here is free.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from zoomout_pipeline.graph.structure_check import StructureCheckResult
from zoomout_pipeline.models import LeafPlan, PlannedLeaf


class GateFileError(RuntimeError):
    """The plan file is missing, unparseable, or no longer a valid plan."""


_HEADER = """\
# ZoomOut — Leaf plan for review (human gate 1)
#
# This file IS the plan. Edit it freely: change titles, rewrite concepts, reorder,
# merge, split, delete. What you leave here is what the run continues with.
#
# To approve:  set `approved: true` below, save, then run
#     zoomout-pipeline resume --run-id {run_id}
#
# Rules the plan must still satisfy after your edits:
#   * {min_leaves}-{max_leaves} Leaves
#   * `order` contiguous from 0 (renumber if you reorder or delete)
#   * every Leaf lists the chapters it draws on, in `source_chapters` (0-based)
#   * it must not mirror the book's own chapter structure - checked again on resume
#
# Book:     {title} - {author}
# Chapters: {chapter_count}
# Run:      {run_id}
{structure_block}"""


def _structure_block(check: StructureCheckResult | None, escalation: str | None) -> str:
    if check is None:
        return "#\n"

    lines = [
        "#",
        f"# Structure check: {'PASSED' if check.passed else 'FAILED'}",
        f"#   Leaves drawing on one chapter only: {check.single_chapter_leaf_ratio:.0%}",
        f"#   Steps following the book's order:   {check.sequential_pair_ratio:.0%}",
        f"#   {check.leaf_count} Leaves against {check.chapter_count} chapters",
    ]
    for finding in check.findings:
        lines.append(f"#   ! {finding}")
    if escalation:
        lines += [
            "#",
            "# ESCALATED: the revision cap was reached with the check still failing.",
            "# This plan cannot be approved as it stands - it has to be edited until the",
            "# check passes. The check is a legal requirement (LEGAL.md), not a style note.",
        ]
    lines.append("#")
    return "\n".join(lines) + "\n"


def write_plan_file(
    *,
    path: Path,
    run_id: str,
    title: str,
    author: str,
    chapter_count: int,
    chapter_titles: list[str],
    plan: LeafPlan,
    check: StructureCheckResult | None,
    escalation: str | None,
    min_leaves: int,
    max_leaves: int,
) -> Path:
    """Write the plan out for a human to edit."""
    path.parent.mkdir(parents=True, exist_ok=True)

    header = _HEADER.format(
        run_id=run_id,
        title=title,
        author=author,
        chapter_count=chapter_count,
        min_leaves=min_leaves,
        max_leaves=max_leaves,
        structure_block=_structure_block(check, escalation),
    )

    chapter_comment = "# The book's own chapters, for reference when setting source_chapters:\n"
    chapter_comment += "\n".join(f"#   {i}: {t}" for i, t in enumerate(chapter_titles)) + "\n#\n"

    body: dict[str, Any] = {
        "run_id": run_id,
        "approved": False,
        "leaves": [
            {
                "order": leaf.order,
                "title": leaf.title,
                "concept": leaf.concept,
                "source_chapters": leaf.source_chapters,
            }
            for leaf in sorted(plan.leaves, key=lambda item: item.order)
        ],
    }

    path.write_text(
        header + chapter_comment + yaml.safe_dump(body, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return path


def read_plan_file(path: Path) -> tuple[LeafPlan, bool]:
    """Read the plan back, with whatever the human changed.

    Returns the plan and whether it was approved. Validation errors are raised with the
    file path in the message: this is a hand-edited file and the most likely failure is a
    human one — a deleted Leaf leaving a gap in `order`, most often.
    """
    if not path.exists():
        raise GateFileError(f"{path} does not exist; the gate has nothing to read")

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as error:
        raise GateFileError(f"{path} is not valid YAML: {error}") from error

    if not isinstance(raw, dict):
        raise GateFileError(f"{path} should contain a mapping, not {type(raw).__name__}")

    approved = bool(raw.get("approved", False))
    entries = raw.get("leaves")
    if not isinstance(entries, list):
        raise GateFileError(f"{path}: `leaves` must be a list")

    try:
        plan = LeafPlan(leaves=[PlannedLeaf.model_validate(entry) for entry in entries])
    except Exception as error:
        raise GateFileError(f"{path}: the edited plan is not valid — {error}") from error

    return plan, approved
