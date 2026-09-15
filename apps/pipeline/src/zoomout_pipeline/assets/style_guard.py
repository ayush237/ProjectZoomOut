"""Checking a generated illustration against the three prohibitions the prompt cannot enforce.

WP30 closed the input half: a focus object whose whole point is its writing is refused at
parse, and a focus naming a light effect is refused too. **Neither stops the model writing
"$10K" on a laptop it was asked to draw.** Track 42's published Leaf 1 does exactly that and
carries a bloom on a teal card; Ikigai's Leaves 3 and 7 came back with floating notification
glyphs, twice, because both scenarios are *about* digital distraction. That is a predictable
failure of a whole scenario class, and nothing in this service looked at the result.

## What this is, and what was tried first

**It is a vision call, and the classical route was tried and measured before it was
abandoned.** Recorded here because it looks obviously right and it does not work.

`variety.py` is the precedent for image analysis in this service, and it is pure PIL. The
same approach fails here, for a reason specific to this corpus:

| Metric over the fixture set | Breaches | Clean |
|---|---|---|
| Mean level in a ring around the brightest 1.5% of pixels | 0.34-0.68 | 0.37-0.89 |
| Density of sustained small luminance deltas, strongest tile | 0.72-0.81 | 0.70-0.83 |

Both **score the breaches below several clean images**. The falloff idea is right in
principle — a bloom is a smooth ramp and a legal cast-light shape is a step — but these
illustrations are not the piecewise-constant art the measurement assumes. They carry
pervasive soft shading by design (`asset_style.md` allows "a single soft tonal step"), so
smooth variation is not anomalous: mean ramp density sits at 0.42-0.57 across breaching and
clean images alike. Worse, the two Tracks differ more from *each other* than breaches differ
from clean images within a Track — Track 42's flatter, smaller renders score 0.12 where
Ikigai's score 0.45, so a threshold calibrated on one Track is meaningless on the next.

Text is the same story from the other side. `guardrails.py` already recorded the decision not
to add OCR, and it holds: flat vector art is full of small rectangles that are not text — a
mixing console's faders, a circuit board's pads — and a detector tuned to find "$10K" among
them flags all of them.

So the guard reads the picture with a vision model and returns a typed verdict, and the one
mechanical check that *does* work — reserved amber, because a colour is countable — stays
where it is in `guardrails.py` and runs alongside.

## What it cannot catch

Stated plainly, because an unstated blind spot is worse than a known one.

- **It is not deterministic.** The same image can come back with different findings on
  different runs. The tests in the normal gate therefore use a scripted client; the evidence
  that it fires on real breaches is a `live` suite against committed fixtures.
- **It can hallucinate a breach**, which costs a real image to regenerate, and it can miss a
  small or stylised one. The prompt pushes against the first — an empty list is named as a
  common and correct answer — which trades some recall for it.
- **It is not independent of what generated the image.** R3 wants a different family grading
  the work; this is Gemini reading Gemini. The Claude-on-Vertex quota that would fix that is
  still the console action `config.py` has been waiting on since WP19.
- **It says nothing about the things that actually decide a Track** — whether the place
  belongs to the scenario, whether the set has collapsed (that is `variety.py`), whether the
  Leaf is any good. A person still looks.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, Field

from zoomout_pipeline.assets.guardrails import AmberCheck, check_reward_amber
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.llm.client import StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.prompts import load_prompt

_log = get_logger(__name__)


class StyleBreach(StrEnum):
    """The three prohibitions this guard looks for.

    Deliberately not "severity" tiers. All three are absolute in `asset_style.md`; what
    differs is only how the image gets regenerated, not whether it must be.
    """

    TEXT = "text"
    GLOW = "glow"
    FLOATING_ICON = "floating_icon"


class StyleFinding(BaseModel):
    """One breach, located well enough that a person can go and look at it."""

    breach: StyleBreach
    what: str = Field(min_length=1, description="What was seen and where in the frame it is.")
    quote: str | None = Field(
        default=None,
        description="For a text breach, the characters as read, so a human can check.",
    )


class StyleReport(BaseModel):
    """The vision model's whole verdict on one image. No pass/fail field — see below.

    The verdict is derived from whether `findings` is empty rather than reported separately,
    for the same reason `GroundingVerdict` has no score: a model that returns both a list and
    a verdict can return an empty list with a "fail", or three findings with a "pass", and
    then somebody has to decide which half to believe.
    """

    findings: list[StyleFinding] = Field(default_factory=list)


@dataclass(frozen=True)
class GuardResult:
    """What the guard decided about one image, and what it cost."""

    report: StyleReport
    amber: AmberCheck
    spend: TokenSpend

    @property
    def findings(self) -> list[StyleFinding]:
        return list(self.report.findings)

    @property
    def passed(self) -> bool:
        return not self.report.findings and self.amber.passed

    def summary(self) -> str:
        if self.passed:
            return "clean: no text, no glow, no floating iconography, no reserved amber"
        lines = [f"{len(self.report.findings)} finding(s):"]
        for finding in self.report.findings:
            quoted = f'  reads: "{finding.quote}"' if finding.quote else ""
            lines.append(f"  [{finding.breach.value}] {finding.what}{quoted}")
        if not self.amber.passed:
            lines.append(
                f"  [amber] reserved #FFB020 covers {self.amber.fraction:.3%} of the frame"
            )
        return "\n".join(lines)


def check_style(*, llm: StructuredClient, data: bytes, model: str) -> GuardResult:
    """Look at one illustration and report which prohibitions it breaches.

    The amber check runs on the same bytes and is folded into the same verdict: it is
    mechanical, free and already written, and a caller that had to remember to run it
    separately is a caller that will forget.
    """
    result = llm.generate_structured(
        prompt=load_prompt("style_guard"),
        schema=StyleReport,
        model=model,
        node="style_guard",
        images=[data],
    )
    amber = check_reward_amber(data)

    _log.info(
        "style_guard.checked",
        findings=len(result.value.findings),
        breaches=sorted({f.breach.value for f in result.value.findings}),
        amber_passed=amber.passed,
        usd=round(result.spend.usd, 4),
    )
    return GuardResult(report=result.value, amber=amber, spend=result.spend)


__all__ = [
    "GuardResult",
    "StyleBreach",
    "StyleFinding",
    "StyleReport",
    "check_style",
]
