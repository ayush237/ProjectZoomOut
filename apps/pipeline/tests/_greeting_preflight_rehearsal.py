"""ONBOARD-2.1's device gate as a script: a read-only rehearsal of `upload_greetings`.

    cd apps/pipeline
    .venv/bin/python tests/_greeting_preflight_rehearsal.py             # against the live Payload
    .venv/bin/python tests/_greeting_preflight_rehearsal.py --stand-in  # no Payload: a dry run

**Not a test** (underscore-prefixed, never collected, like `_durability_child.py`): it reads
`runs/greetings/`, which is on disk only, and a live Payload, which the gate does not have.

It runs the pre-flight over the two cached, paid-for clips and shows it (1) accept the live
documents, (2) refuse a clip with one byte changed, and (3) refuse the reviewer's case — the male
document stale and the female absent — **before any upload**, where the old loop uploaded the
female first. **Anything that would spend or write raises**:

* a `SpeechClient` over a backend that raises          -> no paid speech call is possible
* a guard whose model raises                           -> no paid listening call is possible
* `NarrationBudget(ceiling_usd=0)`                     -> anything uncached is refused before it
* a `record` that raises                               -> nothing can reach a ledger
* a CMS wrapper whose `upload_media` raises            -> nothing can be written to Payload
* the store is a *copy* of `runs/greetings/audio`      -> nothing under `runs/` is touched

`--stand-in` serves the local clips as Media 350 and 351 instead of asking Payload. It proves the
script and the pre-flight over the real clips, and it is **not** the device gate: the gate is the
run without it, against the Payload the founder's pre-flight starts.
"""

from __future__ import annotations

import dataclasses
import hashlib
import os
import shutil
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.greeting import greeting_direction, greeting_filename, greeting_script
from zoomout_pipeline.assets.speech import SpeechClient
from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.config import (
    DEFAULT_ANALYZE_MODEL,
    DEFAULT_NARRATION_LANGUAGE,
    DEFAULT_NARRATION_MODEL,
)
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.greeting_nodes import (
    GreetingUploadError,
    render_greeting,
    upload_greetings,
)
from zoomout_pipeline.graph.narration_nodes import ClipStore, Guard
from zoomout_pipeline.llm.client import GenerationResult
from zoomout_pipeline.models import NarratorId

T = TypeVar("T", bound=BaseModel)

ROOT = Path("runs/greetings")
# ONBOARD-2's "For ONBOARD-3: the references" table: sha256 of the two served files.
REFERENCE_SHA256 = {
    NarratorId.FEMALE: "c79a872587806a367a6f0513fc6cfd84d53a9fc999c7aaa9dd6f9642bacd3eb7",
    NarratorId.MALE: "e598939f6854e8667bdf44c97750db51f73216c2ff8fb8401ec9141ecb16e6a7",
}
REFERENCE_MEDIA_ID = {NarratorId.FEMALE: 350, NarratorId.MALE: 351}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class NoPaidSpeech:
    api_endpoint = "texttospeech.googleapis.com:443"

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        raise AssertionError("PAID CALL ATTEMPTED: speech")


class NoPaidListening:
    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
        images: Sequence[bytes] | None = None,
        audio: Sequence[bytes] | None = None,
    ) -> GenerationResult[T]:
        raise AssertionError("PAID CALL ATTEMPTED: listening")


def no_ledger(spend: TokenSpend) -> None:
    raise AssertionError("SPEND RECORDED: something was bought")


class StandIn:
    """Serves the local final clips as Media 350 and 351. `--stand-in` only."""

    def __init__(self, clips: dict[NarratorId, bytes]) -> None:
        self._by_name = {greeting_filename(n): (n, data) for n, data in clips.items()}

    def find_media(self, *, filename: str) -> dict[str, Any] | None:
        if filename not in self._by_name:
            return None
        narrator, _ = self._by_name[filename]
        return {
            "id": REFERENCE_MEDIA_ID[narrator],
            "filename": filename,
            "url": f"/api/media/file/{filename}",
            "mimeType": "audio/mpeg",
        }

    def fetch_media(self, url: str) -> bytes:
        return self._by_name[url.rsplit("/", 1)[-1]][1]


class ReadOnlyCms:
    """Whatever CMS it wraps, minus the ability to write, and a record of every call made."""

    def __init__(self, inner: Any, *, hide: set[str] | None = None) -> None:
        self._inner = inner
        self._hide = hide or set()
        self.calls: list[str] = []
        self.write_attempts = 0

    def find_media(self, *, filename: str) -> dict[str, Any] | None:
        self.calls.append(f"find_media({filename})")
        if filename in self._hide:  # simulated absence: nothing is deleted anywhere
            return None
        found: dict[str, Any] | None = self._inner.find_media(filename=filename)
        return found

    def fetch_media(self, url: str) -> bytes:
        self.calls.append(f"fetch_media({url})")
        data: bytes = self._inner.fetch_media(url)
        return data

    def upload_media(
        self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
    ) -> dict[str, Any]:
        self.write_attempts += 1
        self.calls.append("UPLOAD_MEDIA")
        raise AssertionError("WRITE ATTEMPTED: upload_media")


def main() -> int:
    stand_in = "--stand-in" in sys.argv
    print(f"mode: {'STAND-IN (not the device gate)' if stand_in else 'LIVE Payload'}")
    final = {n: (ROOT / "audio/final" / greeting_filename(n)).read_bytes() for n in NarratorId}
    for narrator, data in final.items():
        assert sha(data) == REFERENCE_SHA256[narrator], "local final clip != ONBOARD-2 table"
        print(
            f"local  final/{greeting_filename(narrator)}  sha256 {sha(data)}  (= ONBOARD-2 table)"
        )

    inner: Any
    if stand_in:
        inner = StandIn(final)
    else:
        inner = PayloadClient(
            base_url=os.environ.get("ZOOMOUT_PIPELINE_PAYLOAD_URL", "http://localhost:3001"),
            api_key=os.environ["ZOOMOUT_PIPELINE_PAYLOAD_API_KEY"],
        )
        who = inner.whoami()
        assert who.get("email"), "Payload served this key as ANONYMOUS (the wrong-scheme trap)"
        print(f"cms identity: {who.get('email')} ({who.get('accountType')})")

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "audio"
        shutil.copytree(ROOT / "audio", work, ignore=shutil.ignore_patterns("held", "final"))
        speech = SpeechClient(
            project="zoomout-vertex",
            model=DEFAULT_NARRATION_MODEL,
            language_code=DEFAULT_NARRATION_LANGUAGE,
            backend=NoPaidSpeech(),
        )
        guard = Guard(llm=NoPaidListening(), model=DEFAULT_ANALYZE_MODEL)
        budget = NarrationBudget(ceiling_usd=0.0)
        clips = [
            render_greeting(
                greeting=greeting,
                speech=speech,
                prompt=greeting_direction(),
                store=ClipStore(work),
                budget=budget,
                record=no_ledger,
                guard=guard,
            )
            for greeting in greeting_script()
        ]
    for clip in clips:
        narrator = clip.greeting.narrator
        assert clip.from_cache and clip.uploadable, f"{narrator}: not from cache / not uploadable"
        assert clip.sha256 == REFERENCE_SHA256[narrator], f"{narrator}: differs from the table"
        print(f"cache  {narrator.value:<7} re-derived sha256 {clip.sha256}  paid calls: 0")
    assert budget.spent_usd == 0.0 and budget.calls == 0

    # ---- 1. the live documents: accepted, and nothing uploaded
    cms = ReadOnlyCms(inner)
    stored = upload_greetings(client=cms, clips=clips)
    print("\n[1] the pre-flight over the real clips")
    for item in stored:
        served = sha(inner.fetch_media(item.url))  # hashed here, apart from the code under test
        print(f"    {item.narrator.value:<7} Media {item.media_id}  {item.url}")
        print(f"            served sha256 {served}")
        assert item.media_id == REFERENCE_MEDIA_ID[item.narrator] and not item.uploaded
        assert served == REFERENCE_SHA256[item.narrator] == item.sha256 and item.passed
    print(f"    calls: {cms.calls}")
    assert cms.write_attempts == 0
    print(f"    upload attempts: {cms.write_attempts}  -> accepted, nothing written")

    # ---- 2. the negative control: one byte changed in the male clip
    female, male = clips
    flipped = bytearray(male.mp3)
    flipped[len(flipped) // 2] ^= 0x01
    tampered = dataclasses.replace(male, mp3=bytes(flipped), sha256=sha(bytes(flipped)))
    control = ReadOnlyCms(inner)
    print("\n[2] negative control: the male clip with one byte changed")
    try:
        upload_greetings(client=control, clips=[female, tampered])
    except GreetingUploadError as error:
        print(f"    REFUSED: {error}")
    else:
        raise SystemExit("negative control PASSED THROUGH: the pre-flight cannot fail")
    print(f"    calls: {control.calls}")
    assert control.write_attempts == 0
    print(f"    upload attempts: {control.write_attempts}  -> refused before any upload")

    # ---- 3. the bug's own shape: male stale AND female absent (the absence is simulated)
    shaped = ReadOnlyCms(inner, hide={greeting_filename(NarratorId.FEMALE)})
    print(
        "\n[3] the reviewer's case: male stale, female absent (absence simulated, nothing deleted)"
    )
    try:
        upload_greetings(client=shaped, clips=[female, tampered])
    except GreetingUploadError as error:
        print(f"    REFUSED: {error}")
    else:
        raise SystemExit("male-stale / female-absent PASSED THROUGH")
    print(f"    calls: {shaped.calls}")
    assert shaped.write_attempts == 0, "the old loop would have uploaded the female here"
    print(f"    upload attempts: {shaped.write_attempts}  -> neither uploaded")

    print("\nREHEARSAL OK: 0 paid calls, 0 writes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
