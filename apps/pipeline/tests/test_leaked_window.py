"""VO-4.1 leftover (m) — what the leak helper checks a short line against. Tier B.

`leaked_window` is the helper behind the pins that say an error message, a log line or a command's
output never quotes a Leaf's words, in whole or in part. It looks for any twelve-character window of
the line in the message, and a line shorter than twelve characters has no window, so the first
version passed it unseen however plainly the message quoted it. A short line is checked whole.
"""

from __future__ import annotations

import pytest

from .narration_fakes import leaked_window


def test_a_line_shorter_than_the_window_is_checked_whole() -> None:
    assert leaked_window("Hello there", "the message said Hello there, in full") == "Hello there"


def test_a_short_line_that_is_not_in_the_message_is_not_a_leak() -> None:
    assert leaked_window("Hello there", "a message about something else entirely") is None


@pytest.mark.parametrize("blank", ["", "   ", "\n\t"])
def test_a_blank_line_has_nothing_to_leak(blank: str) -> None:
    assert leaked_window(blank, "any message at all") is None
    assert leaked_window(blank, "") is None


def test_a_line_of_exactly_the_window_width_is_one_window() -> None:
    assert leaked_window("twelve chars", "there are twelve chars here") == "twelve chars"
    assert leaked_window("twelve chars", "there are twelve char here") is None


def test_a_longer_line_is_still_found_by_any_window_of_it() -> None:
    line = "You are building a routine form for your team and have a choice to make."

    assert leaked_window(line, "the first 30: 'You are building a routine fo'") == "You are buil"
    assert leaked_window(line, "unrelated words with no shared run of twelve") is None
    assert leaked_window(line, "…a choice to make.") is not None
