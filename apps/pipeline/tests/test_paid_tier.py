"""The paid-tier constraint.

Google's free tier uses submitted content to improve its products, so a work somebody else
owns must never go through it. Until WP32 that was prose: `config.py` said `require_paid_tier`
"turns that from a memory into a check", the function did not exist, and `paid_tier` was a
bool no code read.

**The load-bearing test here is `test_no_call_is_made_when_the_transport_is_refused`.** An
exception is not the requirement — a run that raises *after* sending eight Leaves of a
copyrighted book has satisfied every other assertion in this file and failed the only one
that matters. So the client is a counting fake, and the count must be zero.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from zoomout_pipeline.config import (
    FREE_TIER_ACQUISITIONS,
    FreeTierForbiddenError,
    PipelineSettings,
    require_paid_tier,
)
from zoomout_pipeline.models import Acquisition, Transport

CLOSED = (Acquisition.PURCHASED, Acquisition.LICENSED, Acquisition.UNDOCUMENTED)


def _free_tier(tmp_path: Path) -> PipelineSettings:
    return PipelineSettings(
        database_url="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline_test",
        gemini_api_key="test-key",
        use_vertex=False,
        runs_dir=tmp_path / "runs",
    )


def _vertex(tmp_path: Path) -> PipelineSettings:
    return PipelineSettings(
        database_url="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline_test",
        use_vertex=True,
        vertex_project="zoomout-vertex",
        runs_dir=tmp_path / "runs",
    )


# ------------------------------------------------------------------------------ refusing


@pytest.mark.parametrize("acquisition", CLOSED)
def test_a_book_somebody_else_owns_is_refused_on_the_free_tier(
    acquisition: Acquisition, tmp_path: Path
) -> None:
    with pytest.raises(FreeTierForbiddenError) as raised:
        require_paid_tier(acquisition, _free_tier(tmp_path))

    message = str(raised.value)
    assert acquisition.value in message
    # `require_known_author` is the shape being copied, and the part worth copying is that
    # the refusal names the fix rather than only the problem.
    assert "ZOOMOUT_PIPELINE_USE_VERTEX=true" in message
    assert "--acquisition public-domain" in message


def test_undocumented_is_refused_because_unknown_is_not_permission(tmp_path: Path) -> None:
    """The status that most needs saying out loud.

    `undocumented` is the honest answer for a file whose provenance nobody wrote down, and
    Ikigai carries it. It is *not* a claim that the book is free of copyright, so it belongs
    on the closed side — and a check written as "refuse the two obviously-owned statuses"
    would have let exactly the book this package was written for through.
    """
    with pytest.raises(FreeTierForbiddenError):
        require_paid_tier(Acquisition.UNDOCUMENTED, _free_tier(tmp_path))


# ------------------------------------------------------------------------------ allowing


def test_public_domain_still_runs_on_the_free_tier(tmp_path: Path) -> None:
    record = require_paid_tier(Acquisition.PUBLIC_DOMAIN, _free_tier(tmp_path))

    assert record.transport is Transport.DEVELOPER_API
    assert record.project is None
    assert record.acquisition is Acquisition.PUBLIC_DOMAIN


@pytest.mark.parametrize("acquisition", [*CLOSED, Acquisition.PUBLIC_DOMAIN])
def test_any_book_runs_on_vertex(acquisition: Acquisition, tmp_path: Path) -> None:
    """Vertex does not train on submitted prompts, so nothing is refused there."""
    record = require_paid_tier(acquisition, _vertex(tmp_path))

    assert record.transport is Transport.VERTEX
    assert record.project == "zoomout-vertex"


def test_the_allowed_set_is_a_whitelist_of_one(tmp_path: Path) -> None:
    """A fifth acquisition status added later must be refused until somebody thinks about it.

    Written as "what may" rather than "what may not" precisely because every other member of
    `Acquisition` means a work somebody else owns, so the safe default for an unknown new one
    is the closed side.
    """
    assert {Acquisition.PUBLIC_DOMAIN} == FREE_TIER_ACQUISITIONS
    assert set(Acquisition) - FREE_TIER_ACQUISITIONS == set(CLOSED)


# ------------------------------------------------------- the one that actually matters


class _CountingClient:
    """Counts calls it should never receive."""

    def __init__(self) -> None:
        self.calls = 0

    def generate_structured(self, **_: object) -> object:
        self.calls += 1
        raise AssertionError("a model was called for a book that must not reach this tier")

    def embed(self, **_: object) -> object:
        self.calls += 1
        raise AssertionError("a book was embedded on a tier that trains on submitted content")


def test_no_call_is_made_when_the_transport_is_refused(tmp_path: Path) -> None:
    """**The load-bearing test.** Raising is not the requirement; not sending is.

    A guard that fires at Leaf 9 with a quota error has already put eight Leaves' worth of
    somebody else's book through a tier that trains on it, and every other assertion in this
    file would still be green.
    """
    client = _CountingClient()
    settings = _free_tier(tmp_path)

    with pytest.raises(FreeTierForbiddenError):
        record = require_paid_tier(Acquisition.PURCHASED, settings)
        # Unreachable. Present so the test fails loudly if the refusal is ever downgraded to
        # a warning that returns a record and lets the caller carry on.
        client.generate_structured(prompt="x", model=record.transport.value)

    assert client.calls == 0


def test_the_check_runs_before_the_client_is_built(tmp_path: Path) -> None:
    """`run` resolves the transport before `run_context()`, not inside a node.

    Structural rather than behavioural: building the client is where the API key is read and
    the transport is chosen, so a check after it would be describing a decision already made.
    """
    source = Path("src/zoomout_pipeline/cli.py").read_text(encoding="utf-8")
    body = source.split("def run(", 1)[1].split("@app.command()", 1)[0]

    assert body.index("require_paid_tier(") < body.index("with run_context()")


# --------------------------------------------------------------- the guard has one home


def test_no_command_loads_a_checkpoint_outside_the_two_helpers() -> None:
    """This project's recurring defect is a guard carried to one place and not its twin.

    Seven commands open a run before calling a model. If any of them validates a checkpoint
    by hand, it has skipped `open_run_for_models` and the constraint does not hold for it —
    silently, and exactly the way `paid_tier` failed. So the rule is structural: checkpoints
    are turned into a `PipelineState` in `read_run_state` and nowhere else.

    `_report` is excluded by name: it validates the dict the graph *returned*, not a
    checkpoint read back from the database.
    """
    source = Path("src/zoomout_pipeline/cli.py").read_text(encoding="utf-8")
    sites = [
        line.strip() for line in source.splitlines() if "PipelineState.model_validate(" in line
    ]

    assert len(sites) == 2, sites
    assert any("snapshot.values" in line for line in sites), "read_run_state's own call"
    assert any("model_validate(result)" in line for line in sites), "_report's call"


def test_the_stale_comment_is_gone() -> None:
    """`config.py:26` promised a function that did not exist for four packages.

    A comment describing a guard that is not there is worse than no comment: three completion
    reports cited it as evidence the constraint was enforced.
    """
    config = Path("src/zoomout_pipeline/config.py").read_text(encoding="utf-8")

    assert "require_paid_tier" in config
    assert re.search(r"^def require_paid_tier\(", config, re.MULTILINE)
    assert "paid_tier: bool" not in config, "the flag nothing read must not survive the check"


def test_every_type_the_state_carries_is_allowed_through_the_checkpointer() -> None:
    """**Found by running it, and it would have stayed found by nobody.**

    `TransportRecord` round-trips through the checkpointer even when it is missing from
    `_CHECKPOINTED_TYPES` — the serializer falls back to a plain dict and Pydantic rebuilds
    it — so the values were right and `status` printed them correctly. The only symptom was
    two lines of `Blocked deserialization` on every read, which is exactly the kind of thing
    that gets skimmed past for a year.

    So the rule is checked rather than remembered: anything reachable from `PipelineState`
    is on the allowlist. This walks the annotations rather than listing them, because a list
    that has to be updated by hand is the failure it is trying to prevent.
    """
    import typing
    from enum import Enum

    from pydantic import BaseModel

    from zoomout_pipeline.graph.build import _CHECKPOINTED_TYPES
    from zoomout_pipeline.graph.state import PipelineState

    allowed = set(_CHECKPOINTED_TYPES)
    seen: set[type] = set()
    missing: set[str] = set()

    def walk(model: type[BaseModel]) -> None:
        if model in seen:
            return
        seen.add(model)
        for field in model.model_fields.values():
            for arg in _unwrap(field.annotation):
                if isinstance(arg, type) and issubclass(arg, BaseModel):
                    if arg not in allowed:
                        missing.add(arg.__name__)
                    walk(arg)
                elif isinstance(arg, type) and issubclass(arg, Enum) and arg not in allowed:
                    missing.add(arg.__name__)

    def _unwrap(annotation: object) -> list[object]:
        args = typing.get_args(annotation)
        if not args:
            return [annotation]
        return [inner for arg in args for inner in _unwrap(arg)]

    walk(PipelineState)

    assert not missing, (
        f"{sorted(missing)} are reachable from PipelineState but missing from "
        "_CHECKPOINTED_TYPES. They will round-trip through a dict fallback and log "
        "'Blocked deserialization' on every checkpoint read."
    )
