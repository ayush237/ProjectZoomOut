"""GUARD-1 D4, red 1 of 2: a deliberately failing test, to watch the pipeline job go red.

Added in one commit and reverted in the next. It is not part of the suite.
"""


def test_deliberately_failing() -> None:
    raise AssertionError("GUARD-1 D4: this failure is deliberate")
