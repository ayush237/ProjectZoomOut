"""Sticky-note diagrams, from a constrained JSON spec that we render ourselves.

R4 ruled that a diagram must not come from an image model: they produce unreliable text,
inconsistent styling, and artwork nobody can edit or re-theme. The alternative it offered was
a constrained spec rendered server-side, and this is that.

Owning the renderer buys four things, and the last one was not anticipated:

1. **Palette control.** Diagrams inherit `design-direction.md` exactly, and re-theme when it
   changes rather than needing regeneration.
2. **Legibility by construction.** The spec caps node counts and label lengths, so a diagram
   that would be unreadable on a phone cannot be described in the first place. WP9 learned at
   thumbnail size that legibility beats fidelity.
3. **Text that is spelled correctly.** The guardrail forbidding text in *illustrations* exists
   because image models cannot spell. That reasoning does not apply here — we draw the glyphs.
4. **`alt` that is accurate by construction.** We know exactly what is in the picture, because
   we put it there. A description derived from the structure cannot hallucinate, which is
   strictly better than asking a model to describe its own output.
"""

from __future__ import annotations

import io
from enum import StrEnum

from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field

# design-direction.md §3. Diagrams sit on a card, so the ground is surface/1 rather than the
# app background.
SURFACE = "#141A1E"
SURFACE_RAISED = "#26313A"
BORDER = "#2E3A44"
PRIMARY = "#3DDCC8"
TEXT = "#F2F5F7"
TEXT_MUTED = "#A7B6C0"

# Rendered at 2x the layout size so it stays sharp on a phone.
SCALE = 2
WIDTH = 800
HEIGHT = 500

# Legibility caps, enforced in the schema so an unreadable diagram is unrepresentable.
MAX_NODES = 5
MIN_NODES = 2
MAX_LABEL_CHARS = 42

_FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


class DiagramRenderError(RuntimeError):
    """The spec could not be rendered. Raised before anything is uploaded."""


class DiagramKind(StrEnum):
    """The whole vocabulary, deliberately small.

    A sticky-note slide is a recap, not an infographic. Three shapes cover what a recap
    actually needs, and every shape added is one more thing to keep legible and on-palette.
    """

    FLOW = "flow"
    CONTRAST = "contrast"
    CYCLE = "cycle"


class DiagramNode(BaseModel):
    label: str = Field(min_length=1, max_length=MAX_LABEL_CHARS)


class DiagramSpec(BaseModel):
    """What to draw. This is stored alongside the rendered image so a writer can correct a
    diagram by editing text rather than regenerating a picture."""

    kind: DiagramKind
    nodes: list[DiagramNode] = Field(min_length=MIN_NODES, max_length=MAX_NODES)
    left_heading: str | None = Field(default=None, max_length=MAX_LABEL_CHARS)
    right_heading: str | None = Field(default=None, max_length=MAX_LABEL_CHARS)

    def alt_text(self) -> str:
        """A description derived from the structure, not from looking at the result."""
        labels = [node.label for node in self.nodes]
        if self.kind is DiagramKind.FLOW:
            return "A flow diagram: " + ", then ".join(labels) + "."
        if self.kind is DiagramKind.CYCLE:
            return "A cycle diagram repeating through: " + ", ".join(labels) + ", and back again."
        left = self.left_heading or "one side"
        right = self.right_heading or "the other"
        half = (len(labels) + 1) // 2
        return (
            f"A comparison diagram contrasting {left} — {', '.join(labels[:half])} — "
            f"with {right} — {', '.join(labels[half:])}."
        )


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    # Rather than failing the render. The result is uglier, never broken.
    return ImageFont.load_default()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: object, max_width: int) -> list[str]:
    words, lines, current = text.split(), [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width or not current:  # type: ignore[arg-type]
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    label: str,
    font: object,
    *,
    accent: bool = False,
) -> None:
    draw.rounded_rectangle(
        box,
        radius=12 * SCALE,
        fill=SURFACE_RAISED,
        outline=PRIMARY if accent else BORDER,
        width=(2 if accent else 1) * SCALE,
    )
    x0, y0, x1, y1 = box
    lines = _wrap(draw, label, font, (x1 - x0) - 24 * SCALE)
    line_height = 22 * SCALE
    start = (y0 + y1) / 2 - (len(lines) * line_height) / 2
    for index, line in enumerate(lines):
        width = draw.textlength(line, font=font)  # type: ignore[arg-type]
        draw.text(
            ((x0 + x1) / 2 - width / 2, start + index * line_height),
            line,
            font=font,  # type: ignore[arg-type]
            fill=TEXT,
        )


def render(spec: DiagramSpec) -> bytes:
    """Render a spec to PNG bytes.

    Raises rather than returning something broken: a diagram that fails to render is a broken
    slide, and it must be caught here rather than discovered after upload.
    """
    try:
        image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), SURFACE)
        draw = ImageDraw.Draw(image)
        font = _font(18 * SCALE)
        heading_font = _font(15 * SCALE)

        if spec.kind is DiagramKind.FLOW:
            _render_flow(draw, spec, font)
        elif spec.kind is DiagramKind.CYCLE:
            _render_cycle(draw, spec, font)
        else:
            _render_contrast(draw, spec, font, heading_font)

        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
    except DiagramRenderError:
        raise
    except Exception as error:
        raise DiagramRenderError(f"could not render a {spec.kind} diagram: {error}") from error


def _render_flow(draw: ImageDraw.ImageDraw, spec: DiagramSpec, font: object) -> None:
    count = len(spec.nodes)
    margin, gap = 60 * SCALE, 28 * SCALE
    box_width = (WIDTH * SCALE - 2 * margin - gap * (count - 1)) // count
    box_height = 130 * SCALE
    top = (HEIGHT * SCALE - box_height) // 2

    for index, node in enumerate(spec.nodes):
        x0 = margin + index * (box_width + gap)
        _rounded_box(
            draw,
            (x0, top, x0 + box_width, top + box_height),
            node.label,
            font,
            accent=index == count - 1,
        )
        if index < count - 1:
            arrow_y = top + box_height // 2
            start_x, end_x = x0 + box_width + 6 * SCALE, x0 + box_width + gap - 6 * SCALE
            draw.line([(start_x, arrow_y), (end_x, arrow_y)], fill=TEXT_MUTED, width=2 * SCALE)
            draw.polygon(
                [
                    (end_x, arrow_y),
                    (end_x - 7 * SCALE, arrow_y - 5 * SCALE),
                    (end_x - 7 * SCALE, arrow_y + 5 * SCALE),
                ],
                fill=TEXT_MUTED,
            )


def _render_cycle(draw: ImageDraw.ImageDraw, spec: DiagramSpec, font: object) -> None:
    import math

    centre_x, centre_y = WIDTH * SCALE // 2, HEIGHT * SCALE // 2
    radius = 150 * SCALE
    box_width, box_height = 200 * SCALE, 90 * SCALE
    count = len(spec.nodes)

    draw.ellipse(
        (centre_x - radius, centre_y - radius, centre_x + radius, centre_y + radius),
        outline=BORDER,
        width=2 * SCALE,
    )
    for index, node in enumerate(spec.nodes):
        angle = -math.pi / 2 + index * (2 * math.pi / count)
        cx, cy = centre_x + radius * math.cos(angle), centre_y + radius * math.sin(angle)
        _rounded_box(
            draw,
            (
                int(cx - box_width / 2),
                int(cy - box_height / 2),
                int(cx + box_width / 2),
                int(cy + box_height / 2),
            ),
            node.label,
            font,
            accent=index == 0,
        )


def _render_contrast(
    draw: ImageDraw.ImageDraw, spec: DiagramSpec, font: object, heading_font: object
) -> None:
    labels = [n.label for n in spec.nodes]
    half = (len(labels) + 1) // 2
    columns = [(spec.left_heading, labels[:half]), (spec.right_heading, labels[half:])]

    margin, gutter = 60 * SCALE, 40 * SCALE
    column_width = (WIDTH * SCALE - 2 * margin - gutter) // 2
    draw.line(
        [(WIDTH * SCALE // 2, 70 * SCALE), (WIDTH * SCALE // 2, HEIGHT * SCALE - 60 * SCALE)],
        fill=BORDER,
        width=1 * SCALE,
    )

    # Vertically centred rather than top-aligned. A column of two items left the bottom
    # third of the frame empty, which reads as a cropping mistake at phone size.
    box_height, spacing, heading_height = 100 * SCALE, 116 * SCALE, 40 * SCALE
    tallest = max(len(items) for _, items in columns)
    has_heading = any(heading for heading, _ in columns)
    content_height = (
        tallest * spacing - (spacing - box_height) + (heading_height if has_heading else 0)
    )
    top = max(50 * SCALE, (HEIGHT * SCALE - content_height) // 2)

    draw.line(
        [(WIDTH * SCALE // 2, top), (WIDTH * SCALE // 2, top + content_height)],
        fill=BORDER,
        width=1 * SCALE,
    )

    for column, (heading, items) in enumerate(columns):
        x0 = margin + column * (column_width + gutter)
        y = top
        if heading:
            draw.text((x0, y), heading.upper(), font=heading_font, fill=PRIMARY)  # type: ignore[arg-type]
            y += heading_height
        for item in items:
            _rounded_box(draw, (x0, y, x0 + column_width, y + box_height), item, font)
            y += spacing
