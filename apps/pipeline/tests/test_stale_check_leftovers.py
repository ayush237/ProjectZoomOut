"""VO-4.1's stale check, the parts of what it said that were not true. Tier B.

Four things the completion entry and the README claimed and the code did not do, each said true and
each pinned from the command's own output:

* (a) it is a **digest check**, not "every entry the backend would drop" (it does not see an unknown
  narrator, an empty url, a zero duration, a duplicated narrator or a `stickyNotes.audio` entry);
* (b) "a check that looked at nothing cannot read as clean" was **false**: zero entries compared
  still printed the green line and exited 0. It now says so plainly and exits 3;
* (c) a version read with no `_status` was "no pending draft", the opposite of the backend, which
  reads anything but `published` as a draft;
* (k) it left no structured event.
"""

from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Any

import pytest

from zoomout_pipeline import cli
from zoomout_pipeline.graph import narration_stale
from zoomout_pipeline.graph.narration_stale import (
    DRAFT,
    EXIT_CLEAN,
    EXIT_NOTHING_COMPARED,
    EXIT_STALE,
    LIVE,
    LeafCheck,
    check_leaf,
    exit_code,
    summary,
)

from .narration_fakes import leaf_doc
from .test_narration_stale import Cms, a_book, clean, leaf_nine, run_stale

README = (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8")

BLIND_SPOTS = (
    "unknown narrator",
    "empty url",
    "zero duration",
    "duplicated narrator",
    "stickyNotes.audio",
)
# The sentences that said the check saw every drop. Each is a claim about the backend, and the one
# about "every entry" is only a claim when it is not the sentence that denies it ("not every entry
# the backend would drop"). Scanned with the markdown emphasis taken out.
OVERCLAIM = re.compile(
    r"exactly\s+what\s+the\s+backend\s+drops"
    r"|exactly\s+when\s+the\s+backend\s+would\s+drop"
    r"|(?<!not )every\s+entry\s+the\s+backend\s+would\s+drop"
    r"|each\s+entry\s+that\s+would\s+be\s+dropped",
    re.IGNORECASE,
)


def _flat(text: str) -> str:
    return " ".join(text.replace("*", "").split())


def _readme_paragraph() -> str:
    start = README.index("**`narration-stale --run-id <id>`**")
    return README[start : README.index("```bash", start)]


# ======================================================================= (a) what it claims


def test_the_stale_check_says_it_is_a_digest_check_and_not_every_drop() -> None:
    sources = {
        "README": _readme_paragraph(),
        "module docstring": narration_stale.__doc__ or "",
        "command help": cli.narration_stale.__doc__ or "",
    }

    for where, text in sources.items():
        flat = _flat(text)
        assert "digest check" in flat.lower(), where
        for blind_spot in BLIND_SPOTS:
            assert blind_spot in flat, (
                f"{where} does not name what the check cannot see: {blind_spot}"
            )
        assert not OVERCLAIM.search(flat), f"{where} still says the check sees every drop"


def test_the_overclaim_scan_can_see_the_old_wording() -> None:
    """A scan for a sentence is only worth anything if it goes red on the sentence it hunts."""
    assert OVERCLAIM.search(
        "lists every narrated slide... which is exactly what the backend drops."
    )
    assert OVERCLAIM.search("it calls a slide stale exactly when the backend would drop it")
    assert OVERCLAIM.search("prints each entry that would be dropped: Leaf, slide, narrator")
    assert OVERCLAIM.search("it sees every entry the backend would drop")
    assert not OVERCLAIM.search(
        "a digest check, and only that: not every entry the backend would drop"
    )


def test_the_exit_codes_are_documented_where_they_are_read() -> None:
    for where, text in {
        "README": _readme_paragraph(),
        "command help": cli.narration_stale.__doc__ or "",
    }.items():
        flat = " ".join(text.split())
        assert "**3**" in flat and "compared nothing" in flat, where
        assert "never printed as one" in flat or "never printed as clean" in flat, where


# ================================================================ (b) looking at nothing


def _checked(*, live: int, draft: int = 0, stale: int = 0) -> LeafCheck:
    entries = tuple(
        narration_stale.StaleEntry(0, "payoff", "female", LIVE, "ab" * 32, "cd" * 32)
        for _ in range(stale)
    )
    return LeafCheck(
        order=0, pending_draft=bool(draft), live_compared=live, draft_compared=draft, stale=entries
    )


def test_three_codes_each_with_its_own_case() -> None:
    assert (EXIT_CLEAN, EXIT_STALE, EXIT_NOTHING_COMPARED) == (0, 1, 3)
    assert exit_code([_checked(live=8)]) == EXIT_CLEAN
    assert exit_code([_checked(live=0, draft=8)]) == EXIT_CLEAN, (
        "a draft alone is something looked at"
    )
    assert exit_code([_checked(live=8, stale=2)]) == EXIT_STALE
    assert exit_code([_checked(live=0)]) == EXIT_NOTHING_COMPARED
    assert exit_code([]) == EXIT_NOTHING_COMPARED, "no Leaf at all is not clean either"


def test_the_summary_never_reads_clean_when_nothing_was_compared() -> None:
    for nothing in ([_checked(live=0), _checked(live=0)], []):
        line = summary(nothing)
        assert "nothing was compared" in line
        assert "no stale slides" not in line

    assert summary([_checked(live=8)]) == "no stale slides in 1 Leaf"


def test_a_track_whose_leaves_carry_no_audio_is_not_clean(monkeypatch: pytest.MonkeyPatch) -> None:
    """**The false sentence, through the command.** Three Leaves with no audio at all: it compared
    0 entries. It used to print the green "no stale slides" and exit 0; it says what happened and
    exits with a code that is neither clean nor stale."""
    silent = Cms(*(leaf_doc(order=o, leaf_id=262 + o) for o in range(3)))

    result = run_stale(monkeypatch, silent)
    out = " ".join(result.output.split())

    assert result.exit_code == EXIT_NOTHING_COMPARED, result.output
    assert "compared : 0 audio entries — 0 in the published versions, 0 in 0 pending drafts" in out
    assert "nothing was compared in 3 Leaves" in out
    assert "no stale slides" not in out
    assert "says nothing about the audio" in out


def test_the_other_two_codes_still_come_out_of_the_command(monkeypatch: pytest.MonkeyPatch) -> None:
    clean_book = Cms(*(clean(leaf_doc(order=o, leaf_id=262 + o)) for o in range(2)))
    assert run_stale(monkeypatch, clean_book).exit_code == EXIT_CLEAN
    assert run_stale(monkeypatch, Cms(*a_book())).exit_code == EXIT_STALE


# ============================================================== (c) a version with no status


@pytest.mark.parametrize(
    ("status", "pending"),
    [("draft", True), (None, True), ("something-else", True), ("published", False)],
)
def test_only_the_word_published_means_published(status: str | None, pending: bool) -> None:
    """The backend: `status === 'published' ? 'published' : 'draft'`. Absent, null and anything else
    are drafts, and so they are here."""
    latest = copy.deepcopy(leaf_nine())
    latest["_status"] = status

    result = check_leaf(order=9, live=leaf_nine(), latest=latest)

    assert result.pending_draft is pending


def test_a_version_read_with_no_status_at_all_is_a_draft() -> None:
    """Payload omits `_status` on some reads. A version that does not say it is published is
    compared as a draft, so a stale entry in it is reported as the draft's, which is the safe
    direction: twice, not never."""
    latest = copy.deepcopy(leaf_nine())
    del latest["_status"]

    result = check_leaf(order=9, live=leaf_nine(), latest=latest)

    assert result.pending_draft is True
    assert (result.live_compared, result.draft_compared) == (8, 8)
    assert {entry.version for entry in result.stale} == {LIVE, DRAFT}


# ================================================================ (k) a structured event


class _Log:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    def info(self, event: str, **fields: Any) -> None:
        self.events.append((event, fields))

    def warning(self, event: str, **fields: Any) -> None:
        self.events.append((event, fields))

    def error(self, event: str, **fields: Any) -> None:
        self.events.append((event, fields))


@pytest.mark.parametrize(
    ("book", "expected"),
    [
        (
            "stale",
            {"leaves": 12, "compared": 96, "stale_entries": 2, "stale_slides": 1, "exit_code": 1},
        ),
        (
            "clean",
            {"leaves": 2, "compared": 16, "stale_entries": 0, "stale_slides": 0, "exit_code": 0},
        ),
        (
            "silent",
            {"leaves": 3, "compared": 0, "stale_entries": 0, "stale_slides": 0, "exit_code": 3},
        ),
    ],
)
def test_the_stale_check_leaves_a_structured_event(
    monkeypatch: pytest.MonkeyPatch, book: str, expected: dict[str, int]
) -> None:
    log = _Log()
    monkeypatch.setattr(cli, "_log", log)
    cms = {
        "stale": lambda: Cms(*a_book()),
        "clean": lambda: Cms(*(clean(leaf_doc(order=o, leaf_id=262 + o)) for o in range(2))),
        "silent": lambda: Cms(*(leaf_doc(order=o, leaf_id=262 + o) for o in range(3))),
    }[book]()

    run_stale(monkeypatch, cms)

    ((event, fields),) = [e for e in log.events if e[0] == "narration.stale_checked"]
    assert event == "narration.stale_checked"
    assert fields == {"run_id": "ikigai", **expected}
