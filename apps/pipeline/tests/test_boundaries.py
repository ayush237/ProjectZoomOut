"""The boundaries this package must not cross.

Two of them, both from the persona's never-negotiable list:

* **The pipeline never touches Payload.** WP16 has no CMS contact at all — no client, no
  credential, no import. WP17 opens that boundary, and when it does the door is the REST
  API, never Payload's tables: direct access bypasses draft/publish resolution, which
  silently breaks takedown.
* **The pipeline never reads or writes the backend's or Payload's database.**

These are asserted against the parsed source rather than against its text. Grepping for the
word "Payload" only finds the docstrings that explain why we stay away from it — the thing
worth catching is an `import`, and that is a syntax tree question.
"""

from __future__ import annotations

import ast
from pathlib import Path

import psycopg
import pytest

from zoomout_pipeline.db.engine import ForeignDatabaseError, assert_pipeline_database

SOURCE_ROOT = Path(__file__).resolve().parent.parent / "src"

# Anything that would mean the package had grown a CMS or HTTP dependency.
_FORBIDDEN_IMPORT_ROOTS = frozenset({"payload", "requests", "httpx", "aiohttp", "urllib", "http"})


def _imported_modules() -> dict[Path, set[str]]:
    """Every module name imported by each source file, as the parser sees it."""
    found: dict[Path, set[str]] = {}

    for path in SOURCE_ROOT.rglob("*.py"):
        names: set[str] = set()
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.add(node.module)

        found[path.relative_to(SOURCE_ROOT)] = names

    return found


def test_nothing_imports_a_cms_or_an_http_client() -> None:
    offenders: list[str] = []

    for path, modules in _imported_modules().items():
        for module in modules:
            root = module.split(".")[0].lower()
            if root in _FORBIDDEN_IMPORT_ROOTS:
                offenders.append(f"{path}: imports {module}")

    assert not offenders, (
        "WP16 has no Payload contact and no HTTP client. WP17 opens that boundary "
        "deliberately:\n" + "\n".join(offenders)
    )


def test_the_environment_is_read_only_in_the_config_module() -> None:
    """Secrets come from the environment, through one module, so there is one place to look.

    The same rule the backend follows for `process.env`.
    """
    offenders: list[str] = []

    for path in SOURCE_ROOT.rglob("*.py"):
        if path.name == "config.py":
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in {"environ", "getenv"}:
                offenders.append(f"{path.relative_to(SOURCE_ROOT)}:{node.lineno}")

    assert not offenders, "the environment is read in config.py only:\n" + "\n".join(offenders)


def test_the_guard_refuses_the_backends_database(
    db_connection: psycopg.Connection[dict[str, object]],
) -> None:
    """WP5b: a migration that exits 0 has told you nothing about which database it changed."""
    with db_connection.cursor() as cur:
        cur.execute("CREATE TABLE leaf_progress (id INT)")
        cur.execute("CREATE TABLE users (id INT)")
    db_connection.commit()

    with pytest.raises(ForeignDatabaseError) as error:
        assert_pipeline_database(db_connection)

    assert "leaf_progress" in str(error.value)


def test_the_guard_refuses_payloads_database(
    db_connection: psycopg.Connection[dict[str, object]],
) -> None:
    with db_connection.cursor() as cur:
        cur.execute("CREATE TABLE payload_migrations (id INT)")
    db_connection.commit()

    with pytest.raises(ForeignDatabaseError) as error:
        assert_pipeline_database(db_connection)

    assert "Payload" in str(error.value)


def test_the_guard_passes_on_the_pipelines_own_database(
    db_connection: psycopg.Connection[dict[str, object]],
) -> None:
    assert_pipeline_database(db_connection)


def test_the_config_refuses_a_url_pointing_at_another_service() -> None:
    """The string check that catches the common typo before the live guard has to."""
    from pydantic import ValidationError

    from zoomout_pipeline.config import PipelineSettings

    for url in (
        "postgresql://postgres:postgres@127.0.0.1:5432/zoomout_cms",
        "postgresql://postgres:postgres@127.0.0.1:5432/zoomout",
    ):
        with pytest.raises(ValidationError):
            PipelineSettings(database_url=url, gemini_api_key="x")
