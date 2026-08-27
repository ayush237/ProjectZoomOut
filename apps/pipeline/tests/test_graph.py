"""The graph: wiring, the capped revision cycle, and the human gate."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
import yaml
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from zoomout_pipeline.graph.build import compile_graph
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.nodes import StructureRejectedError
from zoomout_pipeline.graph.state import MAX_BREAKDOWN_ATTEMPTS, PipelineState
from zoomout_pipeline.llm.client import LLMError
from zoomout_pipeline.models import Acquisition, BookAnalysis

from .conftest import ScriptedLLM, leaf_generation_defaults, make_plan


def _run(
    deps: NodeDependencies, epub: Path, *, run_id: str = "run-test"
) -> tuple[Any, RunnableConfig, dict[str, Any]]:
    graph = compile_graph(deps, InMemorySaver())
    config: RunnableConfig = {"configurable": {"thread_id": run_id}}
    state = PipelineState(
        run_id=run_id, source_path=str(epub), acquisition=Acquisition.PUBLIC_DOMAIN
    )
    return graph, config, graph.invoke(state, config)


def test_happy_path_reaches_the_gate_and_stops(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """Tier B — ingest, analyze and breakdown wire together and stop at gate 1."""
    llm = ScriptedLLM([analysis, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)])
    graph, config, result = _run(replace(deps, llm=llm), sample_epub)

    assert "__interrupt__" in result, "the run must pause at the human gate, not finish"

    state = PipelineState.model_validate(graph.get_state(config).values)
    assert state.chunk_count > 0
    assert state.analysis is not None
    assert state.plan is not None
    assert len(state.plan.leaves) == 22
    assert state.structure_check is not None and state.structure_check.passed
    assert state.approved is False
    assert state.escalation is None
    assert [call["node"] for call in llm.calls] == ["analyze", "breakdown"]


def test_the_plan_file_is_written_for_the_human(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    llm = ScriptedLLM([analysis, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)])
    scoped = replace(deps, llm=llm)
    _run(scoped, sample_epub)

    path = Path(scoped.settings.runs_dir) / "run-test" / "leaf-plan.yaml"
    assert path.exists()
    body = yaml.safe_load(path.read_text())
    assert body["approved"] is False
    assert len(body["leaves"]) == 22


def test_the_revision_cycle_terminates_at_the_cap(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """Tier A — a breakdown that never satisfies the check escalates rather than looping.

    R7: reviewer-to-generator cycles are the classic place a graph runs away. The script
    here never produces an acceptable plan, so an uncapped graph would spin forever.
    """
    mirroring = [make_plan(leaves=17, mirror=True, chapter_count=17) for _ in range(10)]
    llm = ScriptedLLM([analysis, *mirroring])

    graph, config, result = _run(replace(deps, llm=llm), sample_epub)

    breakdown_calls = [call for call in llm.calls if call["node"] == "breakdown"]
    assert len(breakdown_calls) == MAX_BREAKDOWN_ATTEMPTS

    state = PipelineState.model_validate(graph.get_state(config).values)
    assert state.breakdown_attempts == MAX_BREAKDOWN_ATTEMPTS
    assert state.escalation is not None, "the human must be told the check never passed"
    assert state.structure_check is not None and not state.structure_check.passed
    assert "__interrupt__" in result, "escalation goes to the human, it does not abort"


def test_a_revision_gets_the_findings_as_feedback(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """The second attempt must be told what was wrong, or it is just a retry."""
    llm = ScriptedLLM(
        [
            analysis,
            make_plan(leaves=17, mirror=True, chapter_count=17),
            make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17),
        ]
    )
    _run(replace(deps, llm=llm), sample_epub)

    revision = [call for call in llm.calls if call["node"] == "breakdown"][1]
    assert "rejected by the automated structure check" in revision["prompt"]
    assert "one chapter" in revision["prompt"]


def test_a_run_resumes_from_the_edited_file(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """Tier A adjacent — founder edits are what the run continues with."""
    llm = ScriptedLLM(
        [analysis, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)],
        defaults=leaf_generation_defaults(),
    )
    scoped = replace(deps, llm=llm)
    graph, config, _ = _run(scoped, sample_epub)

    path = Path(scoped.settings.runs_dir) / "run-test" / "leaf-plan.yaml"
    body = yaml.safe_load(path.read_text())
    body["leaves"][0]["title"] = "An edited title the model never produced"
    body["approved"] = True
    path.write_text(yaml.safe_dump(body, sort_keys=False))

    graph.invoke(Command(resume=True), config)

    state = PipelineState.model_validate(graph.get_state(config).values)
    assert state.approved is True
    assert state.plan is not None
    assert state.plan.leaves[0].title == "An edited title the model never produced"


def test_resuming_without_approval_is_refused(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    llm = ScriptedLLM([analysis, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)])
    graph, config, _ = _run(replace(deps, llm=llm), sample_epub)

    with pytest.raises(StructureRejectedError, match="approved: false"):
        graph.invoke(Command(resume=True), config)


def test_an_approved_plan_that_still_mirrors_the_book_is_refused(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """The legal gate is pass/fail and is not waived by approval at the gate.

    Gate 1 exists to improve the plan, not to override the original-structure requirement.
    """
    mirroring = [make_plan(leaves=17, mirror=True, chapter_count=17) for _ in range(10)]
    llm = ScriptedLLM([analysis, *mirroring])
    scoped = replace(deps, llm=llm)
    graph, config, _ = _run(scoped, sample_epub)

    path = Path(scoped.settings.runs_dir) / "run-test" / "leaf-plan.yaml"
    body = yaml.safe_load(path.read_text())
    body["approved"] = True
    path.write_text(yaml.safe_dump(body, sort_keys=False))

    with pytest.raises(StructureRejectedError, match="mirrors the book"):
        graph.invoke(Command(resume=True), config)


def test_resuming_does_not_overwrite_the_edited_file(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """LangGraph re-executes the node on resume; writing unconditionally would eat edits."""
    llm = ScriptedLLM(
        [analysis, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)],
        defaults=leaf_generation_defaults(),
    )
    scoped = replace(deps, llm=llm)
    graph, config, _ = _run(scoped, sample_epub)

    path = Path(scoped.settings.runs_dir) / "run-test" / "leaf-plan.yaml"
    body = yaml.safe_load(path.read_text())
    body["leaves"][1]["concept"] = "edited concept"
    body["approved"] = True
    path.write_text(yaml.safe_dump(body, sort_keys=False))

    graph.invoke(Command(resume=True), config)

    assert yaml.safe_load(path.read_text())["leaves"][1]["concept"] == "edited concept"


def test_a_malformed_plan_is_retried_with_the_error_as_feedback(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """Output that is not a valid plan is a revision case, not a crash.

    Seen on the first live run: the model returned 10 Leaves against a 15-30 range, the
    schema correctly rejected it, and the whole run died. A model asked again with no
    explanation tends to produce the same output.
    """

    class BadThenGood(ScriptedLLM):
        def __init__(self) -> None:
            super().__init__([analysis, make_plan(leaves=22, chapters_per_leaf=3)])
            self._failed = False

        def generate_structured(self, **kwargs: Any) -> Any:
            if kwargs["node"] == "breakdown" and not self._failed:
                self._failed = True
                self.calls.append({"node": "breakdown", "prompt": kwargs["prompt"]})
                raise LLMError("breakdown: returned JSON that is not a valid LeafPlan: got 10")
            return super().generate_structured(**kwargs)

    llm = BadThenGood()
    graph, config, result = _run(replace(deps, llm=llm), sample_epub)

    assert "__interrupt__" in result, "the run should recover and reach the gate"

    retry = [call for call in llm.calls if call["node"] == "breakdown"][1]
    assert "did not parse into a valid plan" in retry["prompt"]
    assert "got 10" in retry["prompt"], "the retry must be told what was actually wrong"

    state = PipelineState.model_validate(graph.get_state(config).values)
    assert state.last_error is None, "a recovered run should not carry the stale error"
    assert state.plan is not None


def test_repeated_malformed_output_stops_at_the_cap(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """No valid plan after the cap stops with a clear error rather than looping."""

    class AlwaysBad(ScriptedLLM):
        def generate_structured(self, **kwargs: Any) -> Any:
            if kwargs["node"] == "breakdown":
                self.calls.append({"node": "breakdown", "prompt": kwargs["prompt"]})
                raise LLMError("breakdown: not a valid LeafPlan")
            return super().generate_structured(**kwargs)

    llm = AlwaysBad([analysis])

    with pytest.raises(LLMError, match="no valid plan"):
        _run(replace(deps, llm=llm), sample_epub)

    assert len([c for c in llm.calls if c["node"] == "breakdown"]) == MAX_BREAKDOWN_ATTEMPTS


def test_a_late_parse_failure_escalates_the_last_good_plan(
    deps: NodeDependencies, sample_epub: Path, analysis: BookAnalysis
) -> None:
    """A plan that failed the structure check still beats no plan at all.

    Seen on the first Vertex run: attempt 2 produced a valid but chapter-mirroring plan,
    attempt 3 returned unparseable JSON, and the run died — discarding work a human could
    have edited into shape. Escalation exists so the human gets something to act on.
    """

    class MirrorThenGarbage(ScriptedLLM):
        def __init__(self) -> None:
            super().__init__([analysis, make_plan(leaves=17, mirror=True, chapter_count=17)])

        def generate_structured(self, **kwargs: Any) -> Any:
            if kwargs["node"] == "breakdown" and not self._responses:
                self.calls.append({"node": "breakdown", "prompt": kwargs["prompt"]})
                raise LLMError("breakdown: not a valid LeafPlan")
            return super().generate_structured(**kwargs)

    llm = MirrorThenGarbage()
    graph, config, result = _run(replace(deps, llm=llm), sample_epub)

    assert "__interrupt__" in result, "the human must get the plan, not a stack trace"

    state = PipelineState.model_validate(graph.get_state(config).values)
    assert state.plan is not None, "the last valid plan must survive"
    assert state.escalation is not None
    assert state.structure_check is not None and not state.structure_check.passed
