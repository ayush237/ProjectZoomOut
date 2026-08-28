"""Checking generated illustrations against the ruled guardrails.

**Be honest about what a machine can check here.** Three prohibitions were ruled, and they
are not equally verifiable:

| Guardrail | How it is enforced |
|---|---|
| No reward amber (`#FFB020`) | **Mechanically, here.** It is a colour, and colours are countable |
| No rendered text | Prompt, plus a human looking. OCR would add a dependency
  and its own false positives to catch what the style contract already forbids |
| No identifiable person | **By construction.** The contract requires stylised
  figures with no distinguishing features, so an identifiable person is off-style
  before it is off-policy — and the model refuses prompts naming real people |

Only the first is asserted in code. Claiming the other two are "checked" because a prompt
mentions them would be the same mistake as calling the 1:1 structure requirement enforced
because `breakdown.md` asks for it.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image

# design-direction.md §3 reserves amber for reward moments — XP, streaks, achievements. An
# illustration using it steals the signal from the unlock, which is a product consequence
# rather than an aesthetic preference.
REWARD_AMBER = (0xFF, 0xB0, 0x20)

# Per-channel tolerance. An exact match would miss the near-amber a generator actually
# produces; too wide would flag legitimate warm neutrals like skin and wood, which the
# contract explicitly allows.
CHANNEL_TOLERANCE = 26

# A handful of stray pixels is compression noise around a warm edge. A real amber element
# occupies area.
MAX_AMBER_FRACTION = 0.005


@dataclass(frozen=True)
class AmberCheck:
    """How much reserved amber an image contains."""

    fraction: float
    passed: bool

    @property
    def summary(self) -> str:
        return f"{self.fraction:.3%} of pixels near {REWARD_AMBER} (limit {MAX_AMBER_FRACTION:.1%})"


def check_reward_amber(data: bytes) -> AmberCheck:
    """Whether an image uses the colour reserved for rewards.

    Downsampled before counting: this is about whether amber is *present as an element*, not
    about exact pixel accounting, and sampling a thumbnail is both faster and less sensitive
    to compression artefacts at edges.
    """
    with Image.open(io.BytesIO(data)) as image:
        thumbnail = image.convert("RGB").resize((160, 160))
        pixels = list(thumbnail.getdata())

    target_r, target_g, target_b = REWARD_AMBER
    hits = sum(
        1
        for r, g, b in pixels
        if abs(r - target_r) <= CHANNEL_TOLERANCE
        and abs(g - target_g) <= CHANNEL_TOLERANCE
        and abs(b - target_b) <= CHANNEL_TOLERANCE
    )
    fraction = hits / len(pixels)
    return AmberCheck(fraction=fraction, passed=fraction <= MAX_AMBER_FRACTION)
