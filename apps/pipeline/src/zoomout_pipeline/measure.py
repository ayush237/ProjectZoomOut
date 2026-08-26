"""A measurement harness for the breakdown prompt.

WP16's model comparison could not support its conclusion: the two runs of the *same* model
differed by 54 points on the single-chapter ratio while the gap between models was 11, and
every cell was a single sample. The spread inside one configuration was five times the gap
between configurations, which is another way of saying the experiment measured noise.

This measures properly.

**What is held constant.** One analysis, taken from an existing checkpointed run and reused
for every sample of every model. `analyze` is not the variable under test, and letting each
configuration produce its own analysis would confound the two nodes.

**What is sampled.** The *first* breakdown attempt only — no revision loop. The loop is a
correction mechanism; measuring after it conflates how good the prompt is with how well the
loop rescues it. The question WP16.1 asks is whether the prompt passes reliably rather than
occasionally, and that is a question about attempt one.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.nodes import build_breakdown_prompt
from zoomout_pipeline.graph.structure_check import check_structure
from zoomout_pipeline.llm.client import LLMError, LLMTransportError, StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import BookAnalysis, LeafPlan

_log = get_logger(__name__)


@dataclass(frozen=True)
class Sample:
    """One first-attempt breakdown."""

    model: str
    index: int
    ok: bool
    transport_failure: bool = False
    passed: bool = False
    single_chapter_ratio: float = 0.0
    sequential_ratio: float = 0.0
    leaf_count: int = 0
    parity: bool = False
    spend: TokenSpend | None = None
    error: str | None = None


@dataclass(frozen=True)
class Summary:
    """Mean and spread for one configuration.

    Spread is reported as min/max and standard deviation rather than a single number,
    because the finding that prompted this package was about spread.
    """

    model: str
    samples: int
    parse_failures: int
    transport_failures: int
    pass_rate: float
    single_mean: float
    single_min: float
    single_max: float
    single_stdev: float
    sequential_mean: float
    sequential_min: float
    sequential_max: float
    sequential_stdev: float
    leaves_mean: float
    total_tokens: int
    total_usd: float


def _spread(values: list[float]) -> tuple[float, float, float, float]:
    if not values:
        return (0.0, 0.0, 0.0, 0.0)
    mean = statistics.fmean(values)
    stdev = statistics.stdev(values) if len(values) > 1 else 0.0
    return (mean, min(values), max(values), stdev)


def run_samples(
    *,
    llm: StructuredClient,
    model: str,
    repeat: int,
    title: str,
    author: str,
    chapter_titles: list[str],
    analysis: BookAnalysis,
) -> list[Sample]:
    """Take `repeat` independent first-attempt samples from one model."""
    prompt = build_breakdown_prompt(
        title=title, author=author, chapter_titles=chapter_titles, analysis=analysis
    )
    chapter_count = len(chapter_titles)
    samples: list[Sample] = []

    for index in range(repeat):
        try:
            result = llm.generate_structured(
                prompt=prompt, schema=LeafPlan, model=model, node="breakdown"
            )
        except LLMTransportError as error:
            # A rate limit is not a prompt outcome. Counting it as one would be measuring
            # our own quota and would silently drag the pass rate down.
            _log.warning("measure.transport_failure", model=model, index=index)
            samples.append(
                Sample(
                    model=model,
                    index=index,
                    ok=False,
                    transport_failure=True,
                    error=str(error)[:200],
                )
            )
            continue
        except LLMError as error:
            # A parse failure IS a real outcome of a prompt — a prompt that produces
            # unusable JSON a third of the time is worse than one that does not, and
            # dropping those samples would hide it.
            _log.warning("measure.parse_failure", model=model, index=index, error=str(error)[:160])
            samples.append(Sample(model=model, index=index, ok=False, error=str(error)[:200]))
            continue

        check = check_structure(result.value, chapter_count=chapter_count)
        samples.append(
            Sample(
                model=model,
                index=index,
                ok=True,
                passed=check.passed,
                single_chapter_ratio=check.single_chapter_leaf_ratio,
                sequential_ratio=check.sequential_pair_ratio,
                leaf_count=check.leaf_count,
                parity=check.chapter_count_parity,
                spend=result.spend,
            )
        )
        _log.info(
            "measure.sample",
            model=model,
            index=index,
            passed=check.passed,
            single=round(check.single_chapter_leaf_ratio, 3),
            sequential=round(check.sequential_pair_ratio, 3),
            leaves=check.leaf_count,
        )

    return samples


def summarise(model: str, samples: list[Sample]) -> Summary:
    good = [s for s in samples if s.ok]
    transport = [s for s in samples if s.transport_failure]
    # Pass rate is over samples that actually produced an answer. A 429 says nothing about
    # the prompt, so it is reported separately rather than folded into the denominator.
    answered = [s for s in samples if not s.transport_failure]
    single = _spread([s.single_chapter_ratio for s in good])
    sequential = _spread([s.sequential_ratio for s in good])

    return Summary(
        model=model,
        samples=len(samples),
        parse_failures=len(answered) - len(good),
        transport_failures=len(transport),
        pass_rate=(sum(1 for s in good if s.passed) / len(answered)) if answered else 0.0,
        single_mean=single[0],
        single_min=single[1],
        single_max=single[2],
        single_stdev=single[3],
        sequential_mean=sequential[0],
        sequential_min=sequential[1],
        sequential_max=sequential[2],
        sequential_stdev=sequential[3],
        leaves_mean=statistics.fmean([s.leaf_count for s in good]) if good else 0.0,
        total_tokens=sum(s.spend.total_tokens for s in good if s.spend),
        total_usd=sum(s.spend.usd for s in good if s.spend),
    )
