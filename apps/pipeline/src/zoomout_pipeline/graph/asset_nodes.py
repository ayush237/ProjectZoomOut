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

## Why the prompt now names a place (WP30)

Track 42's eighteen published scenario images are eighteen seated figures at a table in a dim
interior — including Leaf 13, whose scenario is about buying a family home and which was drawn
as a man alone at a desk with a calculator. Nothing was wrong with any single picture; the set
was wrong.

Two causes, both here:

1. **The prompt named no setting**, so each call defaulted independently, and an image model's
   default is whatever its style anchors show. Five of the six anchors are seated interiors.
2. **The style contract ended its subject section with a menu** — *ordinary modern life: a
   desk, a commute, a kitchen table, a shop counter, a conversation* — appended to every prompt
   in the run, headed by the thing it kept producing.

**That quotation is the last one in this package, and it lives in a docstring on purpose.** The
first attempt at a fix explained the removal *inside the prompt file*, which put the same five
words back into every image prompt wrapped in an apology for them. Telling an image model not
to draw a desk mentions a desk. The model-facing files now name no setting at all, and
`tests/test_scene_settings.py` fails if one creeps back in.
"""

from __future__ import annotations

from typing import Any

from zoomout_pipeline.assets.budget import ImageBudget
from zoomout_pipeline.assets.diagrams import DiagramRenderError, DiagramSpec, render
from zoomout_pipeline.assets.images import AnchorSet, ImageClient, ImageGenerationError
from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import GeneratedLeafRecord, SceneSetting, SceneShot
from zoomout_pipeline.prompts import load_prompt, render_prompt

_log = get_logger(__name__)


class OptionalDiagram(DiagramSpec):
    """A spec, or the model's decision that this Leaf does not want one."""


_SHOT_DIRECTION = {
    SceneShot.CLOSE: "close — hands, an object, or one figure cropped tight. The place is "
    "read from a detail of it rather than from the whole room",
    SceneShot.MEDIUM: "medium — one or two figures and what is immediately around them",
    SceneShot.WIDE: "wide — the whole room, street or yard, with the figures small in it",
}


def scene_block(setting: SceneSetting) -> str:
    """The decided setting, written for the image model.

    **Above the style contract, not inside it.** The style contract is what every image in the
    library shares; this is what this one image does not share with any other, and the two
    were the same document until Track 42 came back as eighteen of the same picture.
    """
    if setting.figures == 0:
        people = "Nobody is in frame. The place carries the situation on its own."
    elif setting.figures == 1:
        people = "One person in frame."
    else:
        people = f"{setting.figures} people in frame."

    return (
        "## Where this happens\n\n"
        "Decided for this Leaf from its scenario. Draw this place, not a substitute for it.\n\n"
        f"- **Place:** {setting.place}\n"
        f"- **Interior or exterior:** {setting.vantage.value}\n"
        f"- **Time of day:** {setting.light.value} — this changes where the light falls and "
        "nothing about the palette; the picture stays dark\n"
        f"- **Camera:** {_SHOT_DIRECTION[setting.shot]}\n"
        f"- **People:** {people}\n"
        f"- **The eye should land on:** {setting.focus}\n"
    )


def scenario_image_prompt(record: GeneratedLeafRecord, setting: SceneSetting) -> str:
    """The subject, then where it happens, then the house style.

    Built from the scenario the Leaf already contains rather than invented, so the picture
    illustrates the situation the reader is about to be asked about — and from a setting
    derived from that same scenario, so it illustrates it *somewhere in particular*.

    The setting is required rather than optional. An optional one is a default, and the
    default is what this argument is about.
    """
    return (
        f"{record.leaf.scenario_prompt}\n\n"
        "Illustrate the situation described above as a single quiet moment. Do not depict "
        "the outcome or the answer — only the moment of the decision.\n\n"
        f"{scene_block(setting)}\n"
        f"{load_prompt('asset_style')}"
    )


def scenario_alt_text(setting: SceneSetting) -> str:
    """What the picture shows, for a reader who cannot see it.

    **Derived from the setting rather than from the scenario prose**, which fixes two things
    the previous version got wrong against the rules this project set for itself in WP18: it
    opened "An illustration of the scenario:" — describing the medium rather than the scene —
    and then restated the entire scenario prompt, which a screen reader has just read out.

    Accurate by construction in the same sense the diagram alt text is: it describes what was
    asked for, and the human at gate 2 sees the picture and this sentence side by side and can
    correct it. Asking a vision model what it drew would cost money and can invent detail.
    """
    if setting.figures == 0:
        who = "No one is present"
    elif setting.figures == 1:
        who = "One person is present"
    else:
        who = f"{setting.figures} people are present"

    where = setting.place.rstrip(".")
    focus = setting.focus.rstrip(".")
    return (
        f"{setting.light.value.capitalize()} at {where}. {who}; the view settles on {focus}. "
        "Flat stylised artwork in the app's dark palette; figures are not identifiable."
    )


def generate_candidates(
    *,
    client: ImageClient,
    record: GeneratedLeafRecord,
    setting: SceneSetting,
    anchors: AnchorSet,
    model: str,
    count: int,
    budget: ImageBudget,
) -> list[tuple[bytes, str]]:
    """N candidate illustrations for one Leaf, as (png, alt) pairs.

    The budget is charged **before** each call. Charging afterwards would mean the run has
    already spent what it was not allowed to spend.
    """
    prompt = scenario_image_prompt(record, setting)
    alt = scenario_alt_text(setting)

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
    if uploaded_candidates:
        # WP18 uploaded these and had nowhere to put them — WP15.4 added the field, so the
        # human sees all three on the Leaf instead of hunting through the Media collection.
        # Still not *attached*: choosing remains gate 2's job, and writing one into
        # `scenario.image` here would present a decision as already taken.
        patch["imageCandidates"] = [
            {"url": candidate["url"], "alt": candidate["alt"]} for candidate in uploaded_candidates
        ]

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
