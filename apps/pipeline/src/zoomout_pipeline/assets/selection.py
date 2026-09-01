"""Choosing one scenario candidate per Leaf, and writing it without destroying its siblings.

WP20 published Track 42 with diagrams and **no scenario illustrations**: 54 candidates
generated, none attached, because choosing was WP15.7's affordance and it had not landed.
It has now, and the founder has delegated selection **for this Track only** — later books
they choose themselves. So this is one automated pass producing a list to override, not a
substitute for gate 2.

**The rule is "first candidate that passes the guardrails", not "first candidate".** Those
differ: WP20 sampled four candidates and found one rendering the luminous lamp cone the
style contract forbids. The guardrails cannot catch that particular drift — `check_reward_amber`
is the only mechanical one there is — but they do catch the reserved-amber breach, and
picking the first *passing* candidate is strictly better than picking the first.

**The write is a full read-modify-write of the `scenario` group, and that is the whole risk
in this module.** WP19 demonstrated by hand, on this exact group, that a partial PATCH
silently nulls the siblings it omits. `scenario.prompt` and `scenario.options` are the five
slides' central content and they are not recoverable from anywhere else — the run's
checkpoint holds the pre-repair options, not the repaired ones. So the patch always carries
the whole group, rebuilt from the document as Payload currently holds it, and the caller
verifies by re-fetching rather than by trusting the response.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from zoomout_pipeline.assets.guardrails import check_reward_amber
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)


class MediaSource(Protocol):
    """Just the bit of `PayloadClient` this module needs."""

    def fetch_media(self, url: str) -> bytes: ...


@dataclass(frozen=True)
class Choice:
    """One Leaf's decision, and enough to explain it in the founder's review list."""

    order: int
    title: str
    leaf_id: int
    index: int | None
    url: str | None
    alt: str | None
    reason: str

    @property
    def chosen(self) -> bool:
        return self.url is not None


def choose_candidate(
    *, client: MediaSource, leaf: dict[str, Any], order: int, title: str, leaf_id: int
) -> Choice:
    """The first candidate whose bytes pass the guardrails.

    A Leaf that already carries an image is left alone. The only image on Track 42 when this
    ran was one a human had clicked through WP15.7's own button, and overwriting a person's
    pick to install an automatic one is the opposite of what a delegated pass is for.
    """
    existing = ((leaf.get("scenario") or {}).get("image") or {}).get("url")
    if existing:
        return Choice(order, title, leaf_id, None, None, None, "kept the existing pick")

    candidates = leaf.get("imageCandidates") or []
    if not candidates:
        return Choice(order, title, leaf_id, None, None, None, "no candidates to choose from")

    for index, candidate in enumerate(candidates):
        url, alt = candidate.get("url"), (candidate.get("alt") or "").strip()
        if not url:
            continue
        if not alt:
            # Publish validation rejects an asset without alt text, so attaching one would
            # hand the founder a Leaf that cannot be published — a worse outcome than
            # skipping to the next candidate.
            _log.info("selection.skipped", leaf=order, index=index, reason="no alt text")
            continue

        result = check_reward_amber(client.fetch_media(url))
        if not result.passed:
            _log.warning(
                "selection.guardrail_failed",
                leaf=order,
                index=index,
                fraction=round(result.fraction, 4),
            )
            continue

        return Choice(order, title, leaf_id, index, url, alt, "first candidate passing guardrails")

    return Choice(order, title, leaf_id, None, None, None, "every candidate failed the guardrails")


def scenario_patch(*, leaf: dict[str, Any], url: str, alt: str) -> dict[str, Any]:
    """The whole `scenario` group, with the image added and every sibling carried forward.

    **Never a partial group.** WP19 proved on this exact field that Payload nulls what a
    PATCH omits, so sending `{"scenario": {"image": ...}}` would take the prompt and all
    three options with it — on Leaves whose options were repaired in WP20 and exist nowhere
    else in their current form.

    `options` is rebuilt field by field rather than passed through, because a document read
    back from Payload carries row `id`s that a write does not need and that make it harder
    to see, in a diff, that exactly `text` and `isCorrect` are being preserved.
    """
    scenario = leaf.get("scenario") or {}
    patch: dict[str, Any] = {
        "prompt": scenario.get("prompt"),
        "options": [
            {"text": option.get("text"), "isCorrect": bool(option.get("isCorrect"))}
            for option in (scenario.get("options") or [])
        ],
        "image": {"url": url, "alt": alt},
    }
    return {"scenario": patch}


@dataclass(frozen=True)
class SiblingCheck:
    """Whether a write left the rest of the group where it was."""

    order: int
    prompt_intact: bool
    options_intact: bool

    @property
    def passed(self) -> bool:
        return self.prompt_intact and self.options_intact


def verify_siblings(*, before: dict[str, Any], after: dict[str, Any], order: int) -> SiblingCheck:
    """Compare the group's siblings across a write.

    Takes the *re-fetched* document, not the PATCH response. WP15.7's handoff makes the same
    point about its form: what the caller was handed back is not evidence of what was
    stored, and this is the check both packages exist to satisfy.
    """
    was, now = before.get("scenario") or {}, after.get("scenario") or {}

    def options(group: dict[str, Any]) -> list[tuple[str, bool]]:
        return [
            (option.get("text") or "", bool(option.get("isCorrect")))
            for option in (group.get("options") or [])
        ]

    return SiblingCheck(
        order=order,
        prompt_intact=(was.get("prompt") or "") == (now.get("prompt") or "")
        and bool((now.get("prompt") or "").strip()),
        options_intact=options(was) == options(now) and len(options(now)) == 3,
    )


__all__ = [
    "Choice",
    "MediaSource",
    "SiblingCheck",
    "choose_candidate",
    "scenario_patch",
    "verify_siblings",
]
