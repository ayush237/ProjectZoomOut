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

**A digest check, and only that.** Digests are compared the way the backend compares them, trimmed
and lower-cased, so for this one reason an entry is dropped the check agrees with the backend
exactly; an entry with no digest at all is stale too, because the backend drops that as well. It is
**not** every entry the backend would drop. It does not see an unknown narrator, an empty url, a
zero duration, a duplicated narrator (the backend drops both rows) or a `stickyNotes.audio` entry,
none of which is reachable through the pipeline's own attach. A clean answer from here says "no
stale digest", not "everything is served".

**Looking at nothing is not clean** (VO-4.1 said it could not read as clean, and it did). A Track
whose Leaves carry no audio entry at all compares nothing: `summary` says so instead of printing the
clean line, and `exit_code` is a third code, distinct from clean and from stale.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from zoomout_pipeline.assets.narration import NARRATED_FIELDS, text_digest

LIVE = "live"
DRAFT = "draft"

# The one status the backend reads as published (`mapStatus` in `content.mapper.ts`): anything else,
# a status that is absent included, is a draft.
PUBLISHED = "published"

# What the command exits with. 2 is not here: it is what every command says when it was refused
# before it did anything, and a check that ran to the end and found nothing to look at is not that.
EXIT_CLEAN = 0
EXIT_STALE = 1
EXIT_NOTHING_COMPARED = 3

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

    **Published means the version says `published`, and nothing else does.** The backend reads any
    other status, an absent one included, as a draft (`mapStatus`), and so does this: Payload omits
    `_status` on some reads, and a slide reported twice is the safe direction where a pending draft
    not looked at is not.
    """
    live_compared, live_stale = _compare(order=order, doc=live, version=LIVE)
    pending = latest.get("_status") != PUBLISHED
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


def compared(checks: Sequence[LeafCheck]) -> int:
    """How many audio entries were compared, in the published versions and the pending drafts."""
    return sum(check.live_compared + check.draft_compared for check in checks)


def exit_code(checks: Sequence[LeafCheck]) -> int:
    """0 only when at least one entry was compared and none is stale; 1 if any is stale; 3 when
    nothing was compared, which is not a clean bill."""
    if any(check.stale for check in checks):
        return EXIT_STALE
    return EXIT_CLEAN if compared(checks) else EXIT_NOTHING_COMPARED


def summary(checks: Sequence[LeafCheck]) -> str:
    """The last line: how many slides in how many Leaves, or that there are none — or that nothing
    was looked at, which is never worded as none."""
    stale = [entry for check in checks for entry in check.stale]
    if not stale:
        in_leaves = _plural(len(checks), "Leaf", "Leaves")
        if compared(checks) == 0:
            return (
                f"nothing was compared in {in_leaves}: no audio entry was there to check, "
                "so nothing can be called clean"
            )
        return f"no stale slides in {in_leaves}"
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
    "EXIT_CLEAN",
    "EXIT_NOTHING_COMPARED",
    "EXIT_STALE",
    "LIVE",
    "PUBLISHED",
    "LeafCheck",
    "StaleEntry",
    "check_leaf",
    "compared",
    "exit_code",
    "summary",
]
