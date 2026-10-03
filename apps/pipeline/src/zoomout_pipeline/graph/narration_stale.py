"""Which narrated slides carry audio for words the Leaf no longer says.

**Why this exists.** `textDigest` is how a clip proves it was made from the text it sits beside.
The backend recomputes the hash from whatever Payload serves and **drops** an entry that no longer
matches (`apps/backend/src/content/content.mapper.ts`), because a Leaf's text can be edited after a
clip was made and nothing else would notice. So an edit to a narrated field silences that slide,
in both voices, with a log line nobody reads, and nothing in the admin or the pipeline says so.
Leaf 9's payoff was silent for two weeks that way (VO-4.1).

This module is the free, read-only answer: for one Leaf, the published version and the latest
draft, compare each audio entry's stored digest with the digest of the slide's *current* text. It
reads two documents and writes nothing. It knows nothing about speech, listening or budgets, and
the command that uses it never constructs any of them.

**Compared the way the backend compares**: trimmed and lower-cased, so it calls a slide stale
exactly when the backend would drop it. An entry with no digest at all is stale too, because the
backend drops that as well.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from zoomout_pipeline.assets.narration import NARRATED_FIELDS, text_digest
from zoomout_pipeline.cms.mapper import DRAFT_STATUS

LIVE = "live"
DRAFT = "draft"

# What a slide's current text is worth when it has none: not a digest anything can equal, so
# audio left beside a field that no longer says anything is stale, not silently fine.
_NO_TEXT = "(no text)"


@dataclass(frozen=True)
class StaleEntry:
    """One audio entry whose stored digest is not the digest of its slide's current text."""

    order: int
    slide: str
    narrator: str
    version: str
    stored: str
    current: str

    def line(self) -> str:
        stored = self.stored[:8] or "(none)"
        return (
            f"leaf {self.order:>2}  {self.slide:<9} {self.narrator:<6} {self.version:<5} "
            f"stored {stored:<8}  current {self.current[:8]}"
        )


@dataclass(frozen=True)
class LeafCheck:
    """What was compared for one Leaf, and what did not match.

    The compared counts are part of the answer: a check that compared nothing is green for the
    wrong reason, and the command prints them so that is visible.
    """

    order: int
    pending_draft: bool
    live_compared: int
    draft_compared: int
    stale: tuple[StaleEntry, ...]


def _compare(*, order: int, doc: Mapping[str, Any], version: str) -> tuple[int, list[StaleEntry]]:
    compared = 0
    stale: list[StaleEntry] = []
    for slide, (group, field) in NARRATED_FIELDS.items():
        container = doc.get(group)
        if not isinstance(container, Mapping):
            continue
        text = container.get(field)
        current = text_digest(text) if isinstance(text, str) else _NO_TEXT
        for row in container.get("audio") or []:
            compared += 1
            stored = str(row.get("textDigest") or "").strip().lower()
            if stored != current:
                stale.append(
                    StaleEntry(
                        order=order,
                        slide=slide.value,
                        narrator=str(row.get("narrator") or "?"),
                        version=version,
                        stored=stored,
                        current=current,
                    )
                )
    return compared, stale


def check_leaf(*, order: int, live: Mapping[str, Any], latest: Mapping[str, Any]) -> LeafCheck:
    """`live` is the published version, `latest` the newest version of any status.

    Where the newest version *is* the published one there is no pending draft, and the Leaf is
    reported once, as live; comparing it with itself would count every stale entry twice.
    """
    live_compared, live_stale = _compare(order=order, doc=live, version=LIVE)
    pending = latest.get("_status") == DRAFT_STATUS
    draft_compared, draft_stale = (
        _compare(order=order, doc=latest, version=DRAFT) if pending else (0, [])
    )
    return LeafCheck(
        order=order,
        pending_draft=pending,
        live_compared=live_compared,
        draft_compared=draft_compared,
        stale=tuple([*live_stale, *draft_stale]),
    )


def _plural(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def summary(checks: Sequence[LeafCheck]) -> str:
    """The last line: how many slides in how many Leaves, or that there are none."""
    stale = [entry for check in checks for entry in check.stale]
    if not stale:
        return f"no stale slides in {_plural(len(checks), 'Leaf', 'Leaves')}"
    slides = {(entry.order, entry.slide) for entry in stale}
    leaves = {entry.order for entry in stale}
    versions = Counter(entry.version for entry in stale)
    entries = _plural(len(stale), "audio entry", "audio entries")
    return (
        f"{_plural(len(slides), 'stale slide', 'stale slides')} in "
        f"{_plural(len(leaves), 'Leaf', 'Leaves')} — {entries} "
        f"(live {versions[LIVE]}, draft {versions[DRAFT]})"
    )


__all__ = [
    "DRAFT",
    "LIVE",
    "LeafCheck",
    "StaleEntry",
    "check_leaf",
    "summary",
]
