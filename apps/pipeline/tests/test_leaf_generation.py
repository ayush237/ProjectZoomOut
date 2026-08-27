"""Per-Leaf generation: wiring, the revision cycle, and what never happens.

Tier B for the node wiring; Tier A for the two guarantees that matter — an ungrounded Leaf
never reaches the finished set, and the revision cycle terminates.
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any

import psycopg
import pytest

from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.leaf_nodes import (
    format_passages,
    make_draft_leaf_node,
    make_extra_content_node,
    make_ground_check_node,
    route_after_ground_check,
)
from zoomout_pipeline.graph.nodes import ingest_book
from zoomout_pipeline.graph.state import MAX_LEAF_ATTEMPTS, PipelineState
from zoomout_pipeline.models import (
    Acquisition,
    Citation,
    Claim,
    GeneratedExtras,
    LeafPlan,
    PlannedLeaf,
    SlideKey,
)

from .conftest import ScriptedLLM, make_generated_leaf


def _state(deps: NodeDependencies, epub: Path, **overrides: Any) -> PipelineState:
    """A state positioned at the start of Leaf generation, with a real ingested book."""
    result = ingest_book(
        deps=deps, run_id="r", source_path=epub, acquisition=Acquisition.PUBLIC_DOMAIN
    )
    base = PipelineState(
        run_id="r",
        source_path=str(epub),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        book_id=str(result.book_id),
        provenance=result.provenance,
        chapter_titles=result.chapter_titles,
        chunk_count=result.chunk_count,
        approved=True,
        plan=LeafPlan(
            leaves=[
                PlannedLeaf(
                    order=i,
                    title=f"Leaf {i}",
                    concept=f"Concept {i}",
                    source_chapters=[i % 3, (i + 1) % 3],
                )
                for i in range(15)
            ]
        ),
    )
    return base.model_copy(update=overrides)


def test_draft_leaf_retrieves_and_records_passage_ids(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """Tier B. And note what lands in state: ids, never passage text."""
    llm = ScriptedLLM(
        [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
    )
    scoped = replace(deps, llm=llm)
    state = _state(scoped, sample_epub)

    update = make_draft_leaf_node(scoped)(state)

    assert update["current_passage_ids"], "the Leaf must have retrieved something to cite"
    assert all(isinstance(i, int) for i in update["current_passage_ids"])
    assert "passages" not in update, "passage text must never enter checkpointed state"

    prompt = llm.calls[0]["prompt"]
    assert "P1" in prompt, "the model must be shown citable handles"


def test_retrieval_is_confined_to_the_chapters_the_plan_declared(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    """A Leaf must not cite a chapter its own plan never claimed to draw on."""
    llm = ScriptedLLM(
        [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
    )
    scoped = replace(deps, llm=llm)
    state = _state(scoped, sample_epub, leaf_cursor=1)  # plan says chapters [1, 2]

    update = make_draft_leaf_node(scoped)(state)

    with db_connection.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT chapter_index FROM book_chunks WHERE id = ANY(%s)",
            (update["current_passage_ids"],),
        )
        chapters = {int(str(r["chapter_index"])) for r in cur.fetchall()}

    assert chapters <= {1, 2}, f"retrieval escaped the declared chapters: {chapters}"


def test_a_grounded_leaf_is_filed_and_the_cursor_advances(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    scoped = replace(
        deps,
        llm=ScriptedLLM(
            [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
        ),
    )
    state = _state(scoped, sample_epub)
    state = state.model_copy(update=make_draft_leaf_node(scoped)(state))
    state = state.model_copy(update=make_extra_content_node(scoped)(state))

    update = make_ground_check_node(scoped)(state)

    assert "0" in update["generated"], "a passing Leaf must be filed under its order"
    assert update["leaf_cursor"] == 1
    assert update["current_draft"] is None, "the in-flight Leaf must be cleared"


def test_an_ungrounded_leaf_is_never_filed(deps: NodeDependencies, sample_epub: Path) -> None:
    """Tier A. The verdict is not negotiable — a failing Leaf goes back, never forward."""
    invented = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="A claim citing a passage that does not exist.",
                citations=[Citation(passage_ref="P99", note="invented")],
            )
        ]
    )
    scoped = replace(
        deps,
        llm=ScriptedLLM([], defaults={"draft_leaf": invented, "extra_content": GeneratedExtras()}),
    )
    state = _state(scoped, sample_epub)
    state = state.model_copy(update=make_draft_leaf_node(scoped)(state))
    state = state.model_copy(update=make_extra_content_node(scoped)(state))

    update = make_ground_check_node(scoped)(state)

    assert "generated" not in update, "an ungrounded Leaf must not be filed"
    assert update["grounding_feedback"], "the redraft must be told what failed"
    assert update["leaf_attempts"] == 1


def test_the_leaf_revision_cycle_terminates_and_escalates(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """Tier A. Bounded, with a human at the end rather than another round."""
    invented = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Still invented.",
                citations=[Citation(passage_ref="P99", note="invented")],
            )
        ]
    )
    scoped = replace(
        deps,
        llm=ScriptedLLM([], defaults={"draft_leaf": invented, "extra_content": GeneratedExtras()}),
    )
    state = _state(scoped, sample_epub, leaf_attempts=MAX_LEAF_ATTEMPTS - 1)
    state = state.model_copy(update=make_draft_leaf_node(scoped)(state))
    state = state.model_copy(update=make_extra_content_node(scoped)(state))

    update = make_ground_check_node(scoped)(state)

    assert "generated" not in update, "escalation must not smuggle the Leaf through"
    assert update["leaf_escalations"]["0"], "the human must be told which Leaf failed and why"
    assert update["leaf_cursor"] == 1, "the run continues to the next Leaf"


def test_the_redraft_prompt_carries_the_grounding_findings(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """A retry that is not told what failed is a second roll of the dice."""
    llm = ScriptedLLM(
        [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
    )
    scoped = replace(deps, llm=llm)
    state = _state(scoped, sample_epub, grounding_feedback="- [summary] cites 'P99' — invented")

    make_draft_leaf_node(scoped)(state)

    assert "rejected by the grounding check" in llm.calls[0]["prompt"]
    assert "P99" in llm.calls[0]["prompt"]


def test_a_grounded_leaf_marks_its_passages_cited(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    """Cited passages survive `purge_raw_text` — marking them is what makes retention safe."""
    scoped = replace(
        deps,
        llm=ScriptedLLM(
            [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
        ),
    )
    state = _state(scoped, sample_epub)
    state = state.model_copy(update=make_draft_leaf_node(scoped)(state))

    cited_claim = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="A supported claim.",
                citations=[Citation(passage_ref="P1", note="supported")],
            )
        ]
    )
    state = state.model_copy(
        update={"current_draft": cited_claim, "current_extras": GeneratedExtras()}
    )

    make_ground_check_node(scoped)(state)

    with db_connection.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM book_chunks WHERE is_cited")
        assert int(str(cur.fetchone()["n"])) >= 1  # type: ignore[index]


@pytest.mark.parametrize(
    ("feedback", "cursor", "expected"),
    [
        ("something failed", 0, "draft_leaf"),
        (None, 3, "draft_leaf"),
        (None, 15, "done"),
    ],
)
def test_routing_after_the_gate(feedback: str | None, cursor: int, expected: str) -> None:
    state = PipelineState(
        run_id="r",
        source_path="x.epub",
        acquisition=Acquisition.PUBLIC_DOMAIN,
        grounding_feedback=feedback,
        leaf_cursor=cursor,
        plan=LeafPlan(
            leaves=[
                PlannedLeaf(order=i, title=f"L{i}", concept="c", source_chapters=[0, 1])
                for i in range(15)
            ]
        ),
    )

    assert route_after_ground_check(state) == expected


def test_passage_handles_are_positional_and_stable() -> None:
    """Citations are positional, so a reload in a different order would re-point every one."""
    from zoomout_pipeline.db.retrieval import Passage

    passages = [
        Passage(
            f"P{i}",
            chunk_id=i * 10,
            chapter_index=1,
            chapter_title="C",
            position_in_chapter=i,
            text=f"text {i}",
            distance=0.0,
        )
        for i in range(1, 4)
    ]

    block = format_passages(passages)

    assert block.index("P1") < block.index("P2") < block.index("P3")


def test_a_resumed_track_does_not_regenerate_finished_leaves(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """The idempotency that matters once a Track takes twenty minutes.

    A run killed at Leaf 12 must restart at Leaf 12. Regenerating the first eleven would be
    the most expensive accidental repeat in WP17, and — unlike re-embedding — it would also
    produce *different* text, so the Leaves a human already read would silently change.
    """
    llm = ScriptedLLM(
        [], defaults={"draft_leaf": make_generated_leaf(), "extra_content": GeneratedExtras()}
    )
    scoped = replace(deps, llm=llm)

    state = _state(scoped, sample_epub)
    draft, extras, ground = (
        make_draft_leaf_node(scoped),
        make_extra_content_node(scoped),
        make_ground_check_node(scoped),
    )

    # Generate the first two Leaves.
    for _ in range(2):
        state = state.model_copy(update=draft(state))
        state = state.model_copy(update=extras(state))
        state = state.model_copy(update=ground(state))

    assert set(state.generated) == {"0", "1"}
    assert state.leaf_cursor == 2
    calls_after_two = len([c for c in llm.calls if c["node"] == "draft_leaf"])

    # Simulate a restart: the checkpointed state is all a new process gets.
    resumed = PipelineState.model_validate(state.model_dump())
    resumed = resumed.model_copy(update=draft(resumed))

    assert resumed.leaf_cursor == 2, "the cursor must not rewind on resume"
    assert set(resumed.generated) == {"0", "1"}, "finished Leaves must survive untouched"
    assert len([c for c in llm.calls if c["node"] == "draft_leaf"]) == calls_after_two + 1, (
        "resuming should draft the third Leaf, not redo the first two"
    )


def test_scenario_options_are_shuffled_away_from_the_model_s_position_bias() -> None:
    """The unlock gate must not be answerable by position.

    A real 18-Leaf Track put the correct option second in 15 of 18 Leaves and never third —
    "always pick B" scored 83% without reading. That makes active recall, which PRODUCT.md
    calls the product thesis, decorative.
    """
    from zoomout_pipeline.graph.leaf_nodes import shuffle_options

    positions: list[int] = []
    for order in range(24):
        leaf = make_generated_leaf()  # correct option is always first as generated
        shuffled = shuffle_options(leaf, seed=f"run:{order}")
        positions.append(next(i for i, o in enumerate(shuffled.scenario_options) if o.is_correct))

    assert len(set(positions)) == 3, f"the correct answer must move around; got {set(positions)}"
    assert max(positions.count(p) for p in {0, 1, 2}) < 20, "and not pile up in one slot"


def test_shuffling_is_deterministic_for_the_same_leaf() -> None:
    """A regenerated Leaf must shuffle identically, or diffs become noise."""
    from zoomout_pipeline.graph.leaf_nodes import shuffle_options

    first = shuffle_options(make_generated_leaf(), seed="run-a:3")
    second = shuffle_options(make_generated_leaf(), seed="run-a:3")

    assert [o.text for o in first.scenario_options] == [o.text for o in second.scenario_options]


def test_shuffling_preserves_exactly_one_correct_option() -> None:
    from zoomout_pipeline.graph.leaf_nodes import shuffle_options

    shuffled = shuffle_options(make_generated_leaf(), seed="run-b:1")

    assert sum(1 for o in shuffled.scenario_options if o.is_correct) == 1
    assert len(shuffled.scenario_options) == 3
