"""The assets node: scenario image candidates and one sticky-notes diagram.

Two very different jobs, deliberately kept apart (R4).

**Scenario images** come from an image model, conditioned on the committed anchor set so the
library shares one visual identity. N candidates are generated and uploaded — and **none is
attached**. Choosing is the human's job at gate 2 (WP19); picking one here and calling it done
would quietly turn a review into a rubber stamp.

**Diagrams** are a constrained JSON spec that we render ourselves. That is a text call rather
than a priced image, it re-themes when the design changes, a writer can fix it by editing
text, and its `alt` is accurate by construction. The rendered diagram *is* attached, because
there is nothing to choose between.
"""

from __future__ import annotations

from typing import Any

from zoomout_pipeline.assets.budget import ImageBudget
from zoomout_pipeline.assets.diagrams import DiagramRenderError, DiagramSpec, render
from zoomout_pipeline.assets.images import AnchorSet, ImageClient, ImageGenerationError
from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import GeneratedLeafRecord
from zoomout_pipeline.prompts import load_prompt, render_prompt

_log = get_logger(__name__)


class OptionalDiagram(DiagramSpec):
    """A spec, or the model's decision that this Leaf does not want one."""


def scenario_image_prompt(record: GeneratedLeafRecord) -> str:
    """The subject, then the house style.

    Built from the scenario the Leaf already contains rather than invented, so the picture
    illustrates the situation the reader is about to be asked about.
    """
    return (
        f"{record.leaf.scenario_prompt}\n\n"
        "Illustrate the situation described above as a single quiet moment. Do not depict "
        "the outcome or the answer — only the moment of the decision.\n\n"
        f"{load_prompt('asset_style')}"
    )


def generate_candidates(
    *,
    client: ImageClient,
    record: GeneratedLeafRecord,
    anchors: AnchorSet,
    model: str,
    count: int,
    budget: ImageBudget,
) -> list[tuple[bytes, str]]:
    """N candidate illustrations for one Leaf, as (png, alt) pairs.

    The budget is charged **before** each call. Charging afterwards would mean the run has
    already spent what it was not allowed to spend.
    """
    prompt = scenario_image_prompt(record)
    alt = (
        f"An illustration of the scenario: {record.leaf.scenario_prompt.rstrip('.')}. "
        "Stylised flat artwork; the figures are not identifiable."
    )

    candidates: list[tuple[bytes, str]] = []
    for index in range(count):
        budget.charge(leaf_order=record.order)
        try:
            image, _spend = client.generate(
                prompt=prompt, model=model, node="assets", anchors=anchors
            )
        except ImageGenerationError as error:
            # A refusal is informative — the guardrails forbid identifiable people, and a
            # scenario naming one would be refused by the model as well as by us. Log and
            # keep the candidates we have rather than losing the Leaf.
            _log.warning(
                "assets.candidate_failed", leaf=record.order, index=index, error=str(error)[:200]
            )
            continue
        candidates.append((image.data, alt))

    return candidates


def build_diagram(
    *, llm: Any, record: GeneratedLeafRecord, model: str
) -> tuple[bytes, DiagramSpec] | None:
    """A rendered diagram and the spec it came from, or None when the Leaf does not want one.

    Rendering is validated here, before anything is uploaded: a spec that cannot render is a
    broken slide, and WP11 already found a cover URL pointing at a web page.
    """
    prompt = render_prompt(
        "diagram_spec",
        title=record.title,
        concept=record.leaf.claims[0].text if record.leaf.claims else record.title,
        notes="\n".join(f"- {note}" for note in record.leaf.sticky_notes),
    )

    try:
        result = llm.generate_structured(
            prompt=prompt, schema=DiagramSpec, model=model, node="assets"
        )
    except Exception as error:
        _log.warning("assets.diagram_spec_failed", leaf=record.order, error=str(error)[:200])
        return None

    spec = result.value
    try:
        image = render(spec)
    except DiagramRenderError as error:
        _log.warning("assets.diagram_render_failed", leaf=record.order, error=str(error)[:200])
        return None

    return image, spec


def attach_assets(
    *,
    client: PayloadClient,
    leaf_id: int,
    diagram: tuple[bytes, DiagramSpec] | None,
    candidates: list[tuple[bytes, str]],
    order: int,
) -> dict[str, Any]:
    """Upload everything, attach the diagram, and leave the image candidates unattached.

    The asymmetry is deliberate. There is one diagram, so it attaches. There are N image
    candidates and choosing between them is a human judgement that gate 2 exists to make —
    attaching one here would present a decision as though it had already been taken.
    """
    uploaded_candidates: list[dict[str, Any]] = []
    for index, (data, alt) in enumerate(candidates):
        media = client.upload_media(
            data=data, filename=f"leaf-{order:02d}-scenario-{index + 1}.png", alt=alt
        )
        uploaded_candidates.append({"id": media.get("id"), "url": media.get("url"), "alt": alt})

    patch: dict[str, Any] = {}
    diagram_record: dict[str, Any] | None = None
    if diagram is not None:
        data, spec = diagram
        alt = spec.alt_text()
        media = client.upload_media(data=data, filename=f"leaf-{order:02d}-diagram.png", alt=alt)
        diagram_record = {"id": media.get("id"), "url": media.get("url"), "alt": alt}
        patch["stickyNotes"] = {
            "diagram": {
                "url": media.get("url"),
                "alt": alt,
                # Stored so a writer can correct the diagram by editing text rather than
                # regenerating it — which is why WP15 added these two fields.
                "spec": spec.model_dump_json(indent=2),
                "specFormat": "json",
            }
        }

    if patch:
        client.update_leaf_draft(leaf_id=leaf_id, patch=patch)

    _log.info(
        "assets.attached",
        leaf=order,
        leaf_id=leaf_id,
        candidates=len(uploaded_candidates),
        diagram=diagram_record is not None,
    )
    return {"candidates": uploaded_candidates, "diagram": diagram_record}
