"""VO-4.1 leftover (l) — `_checked_cms`, the identity-and-Track check `narrate` and the stale check
share, tested on its own. Tier A.

VO-4.1 pulled it out of `_Narration` so the stale check could have it without building a speech
client, and it was tested only by what the two commands did around it. It is the check that turns
"Payload served this key as nobody" and "this is a different Track" into a refusal, and a wrong
auth scheme is served as anonymous with a 200 and an empty Track reads as "nothing to do": so it
gets its own tests, and `_Narration` is shown to go through it.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest
import typer

from zoomout_pipeline import cli
from zoomout_pipeline.cost import RunCost
from zoomout_pipeline.models import Acquisition, Transport, TransportRecord


class Client:
    """Payload, as far as the check asks it anything, and a record of what it was asked."""

    def __init__(self, *, identity: dict[str, Any], leaves: list[dict[str, Any]]) -> None:
        self.identity = identity
        self.leaves = leaves
        self.calls: list[str] = []

    def whoami(self) -> dict[str, Any]:
        self.calls.append("whoami")
        return self.identity

    def list_leaves(self, *, track_id: int) -> list[dict[str, Any]]:
        self.calls.append(f"list_leaves {track_id}")
        return self.leaves


def _leaves(*ids: int) -> list[dict[str, Any]]:
    return [{"id": leaf_id, "orderIndex": index} for index, leaf_id in enumerate(ids)]


def _state(**leaf_ids: int) -> Any:
    return SimpleNamespace(cms_leaf_ids={key: value for key, value in leaf_ids.items()})


def _deps(client: Client | None, **settings: Any) -> Any:
    return SimpleNamespace(settings=SimpleNamespace(**settings), payload_client=client)


MACHINE = {"email": "pipeline-bot@zoomout.local", "accountType": "machine"}


# ============================================================================== what it refuses


def test_an_anonymous_key_is_refused_before_the_track_is_listed(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Payload serves a wrong auth scheme as anonymous with a 200, and an anonymous caller sees no
    drafts: a Track read that way looks empty. So who the key is comes first."""
    client = Client(identity={}, leaves=_leaves(1, 2))

    with pytest.raises(typer.Exit) as refused:
        cli._checked_cms(_deps(client), _state(a=1, b=2), 50, purpose="narrate")

    assert refused.value.exit_code == 1
    assert "ANONYMOUS" in capsys.readouterr().out
    assert client.calls == ["whoami"], "nothing was read through a key that is nobody"


@pytest.mark.parametrize("purpose", ["narrate", "check"])
def test_a_track_whose_leaves_are_not_the_runs_is_refused_and_says_what_for(
    purpose: str, capsys: pytest.CaptureFixture[str]
) -> None:
    client = Client(identity=MACHINE, leaves=_leaves(1, 2, 3))

    with pytest.raises(typer.Exit) as refused:
        cli._checked_cms(_deps(client), _state(a=1, b=2, c=9), 50, purpose=purpose)

    assert refused.value.exit_code == 1
    out = " ".join(capsys.readouterr().out.split())
    assert "Track 50: Payload returned 3 Leaves and the run wrote 3 ([3, 9] differ)" in out
    assert f"Refusing to {purpose} a Track whose Leaves are not the ones this run knows" in out


def test_a_track_with_fewer_leaves_than_the_run_wrote_is_refused_too(
    capsys: pytest.CaptureFixture[str],
) -> None:
    client = Client(identity=MACHINE, leaves=_leaves(1))

    with pytest.raises(typer.Exit):
        cli._checked_cms(_deps(client), _state(a=1, b=2), 50, purpose="narrate")

    assert "returned 1 Leaves and the run wrote 2" in " ".join(capsys.readouterr().out.split())


# ============================================================================== what it returns


def test_it_returns_the_client_who_it_is_and_the_leaves_in_reading_order() -> None:
    client = Client(identity=MACHINE, leaves=[*reversed(_leaves(10, 20, 30))])

    got_client, identity, leaves = cli._checked_cms(
        _deps(client), _state(a=10, b=20, c=30), 50, purpose="narrate"
    )

    assert cast("object", got_client) is client
    assert identity == MACHINE
    assert [leaf["orderIndex"] for leaf in leaves] == [0, 1, 2], "sorted by orderIndex"
    assert client.calls == ["whoami", "list_leaves 50"], "who first, then what"


def test_it_builds_the_client_from_the_settings_when_none_was_injected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    built: list[dict[str, Any]] = []
    client = Client(identity=MACHINE, leaves=_leaves(1))

    def factory(**kwargs: Any) -> Client:
        built.append(kwargs)
        return client

    monkeypatch.setattr("zoomout_pipeline.cms.client.PayloadClient", factory)
    settings = {
        "payload_url": "http://localhost:3001",
        "payload_api_key": SimpleNamespace(get_secret_value=lambda: "the-key"),
    }

    got_client, _identity, _unused_leaves = cli._checked_cms(
        _deps(None, **settings), _state(a=1), 50, purpose="check"
    )

    assert cast("object", got_client) is client
    assert built == [{"base_url": "http://localhost:3001", "api_key": "the-key"}]


# ===================================================================== `_Narration` goes through it


class _Graph:
    def __init__(self) -> None:
        self.writes: list[dict[str, Any]] = []

    def update_state(self, _config: object, values: dict[str, Any]) -> None:
        self.writes.append(values)


def test_the_narration_session_opens_its_cms_through_checked_cms(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The extraction must not have left `_Narration` with a copy of the check: it asks
    `_checked_cms`, for the Track the run wrote, to narrate, and keeps what it is given."""
    state = SimpleNamespace(
        cms_track_id=50,
        cms_leaf_ids={"0": 1},
        provenance=SimpleNamespace(title="Ikigai"),
        cost=RunCost(),
        cms_narration={},
    )
    transport = TransportRecord(
        transport=Transport.VERTEX,
        project="zoomout-vertex",
        acquisition=Acquisition.UNDOCUMENTED,
        model="gemini-2.5-flash-tts",
    )
    client = object()
    leaves = [{"id": 1, "orderIndex": 0}]
    asked: list[tuple[Any, ...]] = []

    def fake_checked_cms(
        deps: Any, run_state: Any, track_id: int, *, purpose: str
    ) -> tuple[object, dict[str, Any], list[dict[str, Any]]]:
        asked.append((deps, run_state, track_id, purpose))
        return client, MACHINE, leaves

    class Speech:
        endpoint = "texttospeech.googleapis.com:443"
        model = "gemini-2.5-flash-tts"
        project = "zoomout-vertex"

        def __init__(self, **_kwargs: Any) -> None:
            pass

    monkeypatch.setattr(cli, "open_run_for_narration", lambda _graph, _run: (state, transport))
    monkeypatch.setattr(cli, "_checked_cms", fake_checked_cms)
    monkeypatch.setattr("zoomout_pipeline.assets.speech.SpeechClient", Speech)
    deps = _deps(
        None,
        vertex_project="zoomout-vertex",
        narration_model="gemini-2.5-flash-tts",
        narration_language="en-US",
        max_narration_usd=3.0,
        analyze_model="gemini-3.6-flash",
        runs_dir=tmp_path,
    )
    graph = _Graph()

    session = cli._Narration(graph, deps, "ikigai", guard=False)

    assert asked == [(deps, state, 50, "narrate")]
    assert session.client is client and session.leaves == leaves
    assert session.guard is None
    recorded = [write for write in graph.writes if "narration_transport" in write]
    assert recorded and recorded[0]["narration_transport"].endpoint == Speech.endpoint
