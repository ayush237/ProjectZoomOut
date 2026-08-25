"""Prompt templates, loaded from files.

Prompts are the actual logic of this service, so they live in version control as text and
get diffed like code. A prompt buried in a string literal cannot be reviewed, and a change
to one is exactly the kind of change that needs review.
"""

from __future__ import annotations

from importlib import resources
from typing import Any


def load_prompt(name: str) -> str:
    """The raw template text for `name` (without the `.md`)."""
    return resources.files(__package__).joinpath(f"{name}.md").read_text(encoding="utf-8")


def render_prompt(name: str, **values: Any) -> str:
    """Load a template and fill it in.

    `str.format` rather than a template engine: the substitutions are a handful of named
    values and a dependency here would earn nothing.
    """
    return load_prompt(name).format(**values)
