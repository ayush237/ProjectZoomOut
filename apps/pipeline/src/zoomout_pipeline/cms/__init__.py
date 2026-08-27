"""The Payload boundary.

The REST API is the only door. Never the tables: Payload flattens groups into
`summary_body`-style columns, turns arrays into join tables and keeps versions in `_leaves_v`,
so a direct query bypasses draft/publish resolution — which silently breaks takedown, and
takedown is a legal obligation.
"""

from zoomout_pipeline.cms.client import PayloadClient, PayloadError
from zoomout_pipeline.cms.mapper import leaf_payload, source_references, track_payload

__all__ = [
    "PayloadClient",
    "PayloadError",
    "leaf_payload",
    "source_references",
    "track_payload",
]
