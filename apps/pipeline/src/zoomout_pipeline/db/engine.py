"""Connections, and the guard that stops us writing to the wrong database.

WP5b lost real time to exactly this failure: `apps/backend/.env` named `zoomout_cms`
instead of `zoomout`, migrations ran against the CMS, and the CMS broke. The lesson
recorded then was *verify the effect, not the exit code* — a migration that exits 0 has
told you nothing about which database it changed.

So this module refuses to hand out a connection to a database that shows any sign of
belonging to the backend or to Payload, and it does so by looking at what tables are
actually there rather than by trusting the URL.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from zoomout_pipeline.config import get_settings
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Tables that prove we are looking at somebody else's database.
_BACKEND_TABLES = frozenset({"users", "leaf_progress", "user_tracks", "error_reports"})
_PAYLOAD_TABLES = frozenset({"payload_migrations", "payload_preferences", "_leaves_v"})


class ForeignDatabaseError(RuntimeError):
    """Raised when the configured database belongs to the backend or the CMS."""


def describe_database(conn: psycopg.Connection[dict[str, object]]) -> tuple[str, set[str]]:
    """The connected database's name and its public tables.

    Used by the guard, and by the CLI's `doctor` command so a human can see the same
    evidence the guard acts on.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT current_database() AS name")
        row = cur.fetchone()
        name = str(row["name"]) if row else "<unknown>"

        cur.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
        tables = {str(r["tablename"]) for r in cur.fetchall()}
    return name, tables


def assert_pipeline_database(conn: psycopg.Connection[dict[str, object]]) -> None:
    """Refuse to proceed if this is the backend's or Payload's database.

    Called before every migration and before any write. Cheap, and the one check that
    would have caught WP5b's blocker on the first run instead of a day later.
    """
    name, tables = describe_database(conn)

    backend_hits = sorted(tables & _BACKEND_TABLES)
    payload_hits = sorted(tables & _PAYLOAD_TABLES)

    if backend_hits or payload_hits:
        owner = "the backend" if backend_hits else "Payload"
        raise ForeignDatabaseError(
            f"Database {name!r} contains {owner}'s tables "
            f"({', '.join(backend_hits or payload_hits)}). The pipeline must never read or "
            "write the backend's or Payload's database — Payload's REST API is the only "
            "door, and direct table access bypasses draft/publish resolution, which "
            "silently breaks takedown. Point ZOOMOUT_PIPELINE_DATABASE_URL at the "
            "pipeline's own database."
        )

    _log.debug("database.verified", database=name, table_count=len(tables))


@contextmanager
def connect(*, verify: bool = True) -> Iterator[psycopg.Connection[dict[str, object]]]:
    """A connection to the pipeline's database, guarded by default."""
    settings = get_settings()
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        if verify:
            assert_pipeline_database(conn)
        yield conn
