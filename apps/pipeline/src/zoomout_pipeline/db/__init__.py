"""The pipeline's own Postgres: pgvector chunks, provenance, and LangGraph checkpoints."""

from zoomout_pipeline.db.engine import (
    ForeignDatabaseError,
    assert_pipeline_database,
    connect,
    describe_database,
)

__all__ = [
    "ForeignDatabaseError",
    "assert_pipeline_database",
    "connect",
    "describe_database",
]
