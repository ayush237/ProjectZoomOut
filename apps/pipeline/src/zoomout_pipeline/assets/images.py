"""Image generation, conditioned on a committed anchor set.

**The anchors are what make the library look like one product.** A style contract in text
gets a model into the right neighbourhood; passing the actual reference images is what holds
a look together across eighteen unrelated subjects. Text alone drifts, and drift is precisely
the "AI slop" the founder ruled against.

This is also the only node in the pipeline that costs money per Leaf, and image models have
no free tier. Every call is counted, and the caller is expected to enforce a budget that
halts rather than warns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

from zoomout_pipeline.llm.ratelimit import (
    MAX_RETRIES,
    RateLimiter,
    is_rate_limited,
    retry_delay_seconds,
)
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Portrait-ish, matching the scenario slide's illustration area on a phone.
DEFAULT_ASPECT_RATIO = "4:3"

# Published rates per generated image, per model. This is the only per-Leaf recurring cost
# in the pipeline, and the per-Track number is what decides whether the library can grow —
# so it is priced per model rather than by one constant.
#
# It used to be one constant, `USD_PER_IMAGE = 0.039`. That is the Gemini 2.5 Flash Image
# rate, and the pipeline's default image model has been `gemini-3-pro-image` since WP18 —
# **so every image cost this pipeline has ever reported was 3.4x under.** One rate for a
# configurable model is a bug waiting on a config change, and this one did not even wait.
#
# Verified against ai.google.dev/gemini-api/docs/pricing, 2026-09-01. Gemini 3 Pro Image
# bills image output at $120/Mtok, which the page states as $0.134 per 1K/2K image; 4K
# output is $0.24 and is not modelled, because `DEFAULT_ASPECT_RATIO` never requests it.
_USD_PER_IMAGE: dict[str, float] = {
    "gemini-3-pro-image": 0.134,
    "gemini-2.5-flash-image": 0.039,
}

# What an unpriced image model is assumed to cost. Deliberately not zero, and deliberately
# not silent — the text table's convention is that an unknown model reports zero and names
# itself, which is right when the alternative is inventing a number. Here it is not: images
# are the dominant per-Track cost, a zero would flatter the one number this package exists
# to produce, and the most expensive rate on the page is a safer wrong answer than free.
FALLBACK_USD_PER_IMAGE = 0.24


def usd_per_image(model: str) -> float:
    """The published per-image rate, falling back to the priciest known tier."""
    return _USD_PER_IMAGE.get(model, FALLBACK_USD_PER_IMAGE)


# Image quotas are far tighter than text quotas. Paced conservatively because a burst of
# candidate generation is exactly the shape that trips them.
IMAGE_REQUESTS_PER_MINUTE = 10


class ImageGenerationError(RuntimeError):
    """The model returned no usable image, or refused the prompt."""


@dataclass
class ImageSpend:
    """What image generation cost. Counted separately from tokens, because it is priced
    per image and tokens are not the unit anyone will ask about."""

    node: str
    model: str
    images: int = 0

    @property
    def usd(self) -> float:
        return self.images * usd_per_image(self.model)


@dataclass
class GeneratedImage:
    """One candidate."""

    data: bytes
    mime_type: str
    prompt: str
    alt: str


@dataclass
class AnchorSet:
    """The committed reference images that define the house style.

    Loaded from disk rather than regenerated, so the look is stable across runs and reviewable
    in a diff. Swappable by design: `design-direction.md` §9 reserves a mascot slot, and if one
    ever lands, re-anchoring is a re-render rather than a redesign.
    """

    images: list[bytes] = field(default_factory=list)
    mime_type: str = "image/png"

    @classmethod
    def load(cls, directory: Path) -> AnchorSet:
        if not directory.exists():
            return cls()
        paths = sorted(p for p in directory.glob("*.png"))
        return cls(images=[p.read_bytes() for p in paths])

    def __len__(self) -> int:
        return len(self.images)


class ImageClient:
    """Gemini image generation over Vertex."""

    def __init__(
        self, *, project: str, location: str = "global", limiter: RateLimiter | None = None
    ) -> None:
        from google import genai

        if not project:
            raise ImageGenerationError("Vertex needs a project id for image generation.")
        self._client = genai.Client(vertexai=True, project=project, location=location)
        # Image quotas are tighter than text quotas and bind quickly on a burst. Same
        # bounded retry as the text client rather than a second, subtly different one.
        self._limiter = limiter or RateLimiter(max_per_minute=IMAGE_REQUESTS_PER_MINUTE)

    def generate(
        self,
        *,
        prompt: str,
        model: str,
        node: str,
        anchors: AnchorSet | None = None,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
    ) -> tuple[GeneratedImage, ImageSpend]:
        """One image, conditioned on the anchor set when there is one."""
        from google.genai import types

        parts: list[types.Part] = []
        if anchors is not None and len(anchors) > 0:
            # Anchors go first so the model reads them as the style to match, then the
            # instruction that says so, then the subject.
            parts.extend(
                types.Part(inline_data=types.Blob(data=image, mime_type=anchors.mime_type))
                for image in anchors.images
            )
            parts.append(
                types.Part(
                    text=(
                        "The images above define the house style. Match their medium, palette, "
                        "line weight, level of detail and treatment of figures exactly. They "
                        "are style references only — do not reproduce their subjects."
                    )
                )
            )
        parts.append(types.Part(text=prompt))

        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        )

        response = None
        for attempt in range(MAX_RETRIES):
            # Image quotas are far tighter than text quotas and bind on a burst of candidate
            # generation. Same bounded retry as the text client rather than a second,
            # subtly different one.
            self._limiter.acquire(1)
            try:
                # `list` is invariant, so `list[Part]` does not satisfy the SDK's declared
                # union even though it accepts exactly this. Cast at the boundary.
                response = self._client.models.generate_content(
                    model=model, contents=cast("Any", parts), config=config
                )
                break
            except Exception as error:
                if not is_rate_limited(error) or attempt == MAX_RETRIES - 1:
                    raise ImageGenerationError(
                        f"{node}: image call to {model} failed: {error}"
                    ) from error
                delay = retry_delay_seconds(error, attempt=attempt)
                _log.warning(
                    "image.rate_limited",
                    node=node,
                    model=model,
                    attempt=attempt + 1,
                    retry_in=round(delay, 1),
                )
                self._limiter.penalise()
                self._limiter.sleep(delay)

        if response is None:  # pragma: no cover - the loop either breaks or raises
            raise ImageGenerationError(f"{node}: {model} produced no response")

        image_bytes, mime = _first_image(response)
        if image_bytes is None:
            raise ImageGenerationError(
                f"{node}: {model} returned no image. It may have refused the prompt — "
                "the guardrails forbid identifiable people, so a prompt naming one is "
                "rejected by the model as well as by us."
            )

        spend = ImageSpend(node=node, model=model, images=1)
        _log.info(
            "image.generated",
            node=node,
            model=model,
            bytes=len(image_bytes),
            anchors=len(anchors) if anchors else 0,
            usd=round(spend.usd, 4),
        )
        return GeneratedImage(data=image_bytes, mime_type=mime, prompt=prompt, alt=""), spend


def _first_image(response: object) -> tuple[bytes | None, str]:
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            blob = getattr(part, "inline_data", None)
            data = getattr(blob, "data", None)
            if data:
                return bytes(data), str(getattr(blob, "mime_type", "image/png"))
    return None, "image/png"
