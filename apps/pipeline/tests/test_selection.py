"""Tier A — the scenario group survives the write, and nothing here can publish.

WP19 demonstrated by hand, on this exact Payload group, that a partial PATCH silently nulls
the siblings it omits. `scenario.prompt` and `scenario.options` are the five slides' central
content, and after WP20's distractor repair the current options exist nowhere else — the
run's checkpoint holds an earlier version. A patch that dropped them would destroy the Track
while reporting success.

The second risk is publishing. These Leaves are live, and the machine key's inability to
edit published content is the guarantee that a human decides what readers see.
"""

from __future__ import annotations

from typing import Any

import pytest

from zoomout_pipeline.assets.selection import (
    choose_candidate,
    scenario_patch,
    verify_siblings,
)

PROMPT = "A rival cafe opens across the street."
OPTIONS = [
    {"text": "Cut your prices to keep the regulars.", "isCorrect": False},
    {"text": "Teach a home-brewing workshop and grow the market.", "isCorrect": True},
    {"text": "Buy local advertising to defend your turf.", "isCorrect": False},
]


def _leaf(**overrides: Any) -> dict[str, Any]:
    leaf: dict[str, Any] = {
        "id": 244,
        "orderIndex": 0,
        "title": "Real wealth comes from creating value",
        "scenario": {"prompt": PROMPT, "options": [dict(o) for o in OPTIONS]},
        "imageCandidates": [
            {"url": "/api/media/file/a.png", "alt": "An illustration of a roastery."},
            {"url": "/api/media/file/b.png", "alt": "An illustration of a counter."},
        ],
    }
    leaf.update(overrides)
    return leaf


class _Media:
    """Serves bytes for a url. `amber` names the urls that should fail the guardrail."""

    def __init__(self, amber: set[str] | None = None) -> None:
        self.amber = amber or set()
        self.fetched: list[str] = []

    def fetch_media(self, url: str) -> bytes:
        import io

        from PIL import Image

        from zoomout_pipeline.assets.guardrails import REWARD_AMBER

        self.fetched.append(url)
        colour = REWARD_AMBER if url in self.amber else (0x0B, 0x0F, 0x12)
        buffer = io.BytesIO()
        Image.new("RGB", (64, 64), colour).save(buffer, format="PNG")
        return buffer.getvalue()


# --------------------------------------------------------------- sibling survival


def test_the_patch_carries_the_whole_scenario_group() -> None:
    """The property this module exists for.

    WP19 nulled `scenario.prompt` and `scenario.options` by sending only `scenario.image`.
    Asserting the patch *contains* them is the test that would have caught it — asserting
    only that the image is right passes just as happily on the broken version.
    """
    patch = scenario_patch(leaf=_leaf(), url="/api/media/file/a.png", alt="Alt text.")

    scenario = patch["scenario"]
    assert scenario["prompt"] == PROMPT, "the prompt must be carried forward, not omitted"
    assert [(o["text"], o["isCorrect"]) for o in scenario["options"]] == [
        (o["text"], o["isCorrect"]) for o in OPTIONS
    ], "all three options must survive, with their correctness flags"
    assert scenario["image"] == {"url": "/api/media/file/a.png", "alt": "Alt text."}


def test_a_write_that_lost_the_siblings_is_detected() -> None:
    """`verify_siblings` compares the re-fetched document. If it cannot tell a damaged
    group from an intact one, the verification step is decoration."""
    before = _leaf()
    intact = verify_siblings(before=before, after=_leaf(), order=0)
    assert intact.passed

    nulled = verify_siblings(
        before=before, after=_leaf(scenario={"prompt": None, "options": []}), order=0
    )
    assert not nulled.passed
    assert not nulled.prompt_intact and not nulled.options_intact


@pytest.mark.parametrize(
    ("after_scenario", "prompt_ok", "options_ok"),
    [
        ({"prompt": PROMPT, "options": []}, True, False),
        ({"prompt": "", "options": [dict(o) for o in OPTIONS]}, False, True),
        ({"prompt": PROMPT, "options": [dict(OPTIONS[0])]}, True, False),
    ],
)
def test_each_sibling_is_checked_separately(
    after_scenario: dict[str, Any], prompt_ok: bool, options_ok: bool
) -> None:
    """Losing the options and losing the prompt are different failures. A single combined
    boolean would let one hide behind the other in the report the founder reads."""
    check = verify_siblings(before=_leaf(), after=_leaf(scenario=after_scenario), order=0)

    assert check.prompt_intact is prompt_ok
    assert check.options_intact is options_ok


# ------------------------------------------------------------------ never publishes


def test_nothing_in_the_patch_can_publish() -> None:
    """`update_leaf_draft` forces `_status` to draft, but the patch this module builds must
    not carry a status at all — a second guard for the rule that matters most here, since
    these Leaves are live and a human decides what readers see."""
    patch = scenario_patch(leaf=_leaf(), url="/api/media/file/a.png", alt="Alt.")

    assert "_status" not in patch
    assert "_status" not in patch["scenario"]
    assert not any("status" in key.lower() for key in patch)


# ---------------------------------------------------------------------- selection


def test_the_first_passing_candidate_is_chosen() -> None:
    client = _Media()
    choice = choose_candidate(client=client, leaf=_leaf(), order=0, title="T", leaf_id=244)

    assert choice.index == 0
    assert choice.url == "/api/media/file/a.png"
    assert choice.alt == "An illustration of a roastery."


def test_a_candidate_failing_the_guardrail_is_skipped() -> None:
    """ "First that passes the guardrails", not "first". WP20 found a candidate breaching the
    style contract, and attaching it because it happened to be generated first would put a
    known-bad image on a published Leaf."""
    client = _Media(amber={"/api/media/file/a.png"})
    choice = choose_candidate(client=client, leaf=_leaf(), order=0, title="T", leaf_id=244)

    assert choice.index == 1, "the amber candidate must be passed over"
    assert client.fetched == ["/api/media/file/a.png", "/api/media/file/b.png"]


def test_a_candidate_without_alt_text_is_skipped() -> None:
    """Publish validation rejects an asset with no alt text, so attaching one would hand the
    founder a Leaf that cannot be published."""
    leaf = _leaf(
        imageCandidates=[
            {"url": "/api/media/file/a.png", "alt": "   "},
            {"url": "/api/media/file/b.png", "alt": "An illustration of a counter."},
        ]
    )
    choice = choose_candidate(client=_Media(), leaf=leaf, order=0, title="T", leaf_id=244)

    assert choice.index == 1


def test_a_leaf_that_already_has_an_image_is_left_alone() -> None:
    """The only image on Track 42 was one a human clicked through WP15.7's own button.
    Overwriting a person's pick to install an automatic one is the opposite of the job."""
    leaf = _leaf(
        scenario={
            "prompt": PROMPT,
            "options": [dict(o) for o in OPTIONS],
            "image": {"url": "/api/media/file/chosen.png", "alt": "Their pick."},
        }
    )
    client = _Media()
    choice = choose_candidate(client=client, leaf=leaf, order=0, title="T", leaf_id=244)

    assert not choice.chosen
    assert "kept" in choice.reason
    assert client.fetched == [], "a skipped Leaf must not cost a media fetch"


def test_every_candidate_failing_leaves_the_leaf_unillustrated() -> None:
    """Reported rather than forced. An image that breaches the style contract on a published
    Leaf is worse than a Leaf with no image, which is merely incomplete."""
    client = _Media(amber={"/api/media/file/a.png", "/api/media/file/b.png"})
    choice = choose_candidate(client=client, leaf=_leaf(), order=0, title="T", leaf_id=244)

    assert not choice.chosen
    assert choice.index is None
    assert "guardrails" in choice.reason
