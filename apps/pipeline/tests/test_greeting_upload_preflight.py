"""ONBOARD-2.1 Part C — "both or neither" upload, made true where it can be.

`upload_greetings` used to check the *set* and the *quality* of both clips, then upload
sequentially, and discover a stale document only when that narrator's turn arrived. A stale male
document with no female one uploaded the female, refused the male, **and said "Nothing was
uploaded."** — which was false. The pre-flight now looks at both narrators' documents first, and
refuses before any `upload_media` if either holds bytes that are not its clip.

**What it does not promise is atomicity.** Two uploads are two requests: a *transport* failure
between them still leaves the first stored. That case is resumable — the re-run finds it and
accepts the identical clip (`test_greetings.py::test_a_partial_transport_failure_resumes...`) —
but it is not "neither", and nothing here claims it is.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.greeting import NARRATOR_GREETINGS, greeting_filename
from zoomout_pipeline.assets.narration_guard import NarrationEnding, NarrationReading
from zoomout_pipeline.graph.greeting_nodes import (
    GREETING_CEILING_USD,
    GreetingUploadError,
    RenderedGreeting,
    run_greetings,
    upload_greeting,
    upload_greetings,
)
from zoomout_pipeline.graph.narration_nodes import ClipStore, Guard
from zoomout_pipeline.models import NarratorId

from .conftest import ScriptedLLM
from .narration_fakes import FakePayload, FakeSpeechBackend, speech_client

MODEL = "gemini-3.6-flash"
STALE = b"an older take, somebody else's bytes"


def _clips(tmp_path: Path) -> list[RenderedGreeting]:
    """Both greetings, rendered and heard, and not uploaded anywhere."""
    heard = ScriptedLLM(
        [
            NarrationReading(transcript=NARRATOR_GREETINGS[narrator], ending=NarrationEnding.CLEAN)
            for narrator in NarratorId
        ]
    )
    return run_greetings(
        speech=speech_client(FakeSpeechBackend()),
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=lambda _narrator, _spend: None,
        guard=Guard(llm=heard, model=MODEL),
        client=None,
    ).rendered


def _occupy(cms: FakePayload, narrator: NarratorId, content: bytes, *, media_id: int) -> str:
    """A document already stored under this narrator's stable filename, holding `content`."""
    filename = greeting_filename(narrator)
    url = f"/api/media/file/{filename}"
    cms.media[filename] = {
        "id": media_id,
        "filename": filename,
        "alt": "an older take",
        "mimeType": "audio/mpeg",
        "url": url,
    }
    cms.blobs[url] = content
    return filename


# =========================================================== a stale document holds both back


def test_a_stale_male_and_no_female_uploads_nothing_and_names_the_male_document(
    tmp_path: Path,
) -> None:
    """**The order the reviewer found unpinned.** The female is first in `NarratorId`, so the old
    loop uploaded her before it reached the stale male. The existing test refuses the *female*
    document, which fails before anything is sent whatever the loop does."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.MALE, STALE, media_id=7)

    with pytest.raises(
        GreetingUploadError, match=r"Media 7 \(narrator-greeting-male\.mp3\)"
    ) as raised:
        upload_greetings(client=cms, clips=clips)

    assert "different bytes" in str(raised.value)
    assert cms.uploads == [], "the female was not uploaded either: neither"
    assert "upload_media" not in cms.calls
    assert "female" not in str(raised.value), "only the document that is wrong is named"


def test_a_stale_female_and_no_male_uploads_nothing_and_names_the_female_document(
    tmp_path: Path,
) -> None:
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.FEMALE, STALE, media_id=8)

    with pytest.raises(GreetingUploadError, match=r"Media 8 \(narrator-greeting-female\.mp3\)"):
        upload_greetings(client=cms, clips=clips)

    assert cms.uploads == [] and "upload_media" not in cms.calls


def test_two_stale_documents_are_both_named_so_one_visit_to_the_admin_fixes_both(
    tmp_path: Path,
) -> None:
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.FEMALE, STALE, media_id=8)
    _occupy(cms, NarratorId.MALE, STALE, media_id=7)

    with pytest.raises(GreetingUploadError) as raised:
        upload_greetings(client=cms, clips=clips)

    assert "Media 8" in str(raised.value) and "Media 7" in str(raised.value)
    assert cms.uploads == []


def test_the_preflight_looks_at_both_narrators_before_it_uploads_anything(tmp_path: Path) -> None:
    """The call sequence is the pre-flight: both narrators looked up, only the document that
    exists fetched, and nothing written — where the old loop would have called `upload_media`
    for the female first."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.MALE, STALE, media_id=7)

    with pytest.raises(GreetingUploadError):
        upload_greetings(client=cms, clips=clips)

    assert cms.calls == ["find_media", "find_media", "fetch_media"]


def test_an_existing_document_with_no_url_is_refused_before_anything_is_uploaded(
    tmp_path: Path,
) -> None:
    """`upload_greeting` refuses this too, but only when it reaches that narrator."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    filename = _occupy(cms, NarratorId.MALE, STALE, media_id=7)
    del cms.media[filename]["url"]

    with pytest.raises(GreetingUploadError, match="no url"):
        upload_greetings(client=cms, clips=clips)

    assert cms.uploads == []


# ============================================================= what still goes through


def test_both_absent_uploads_both_female_first(tmp_path: Path) -> None:
    clips = _clips(tmp_path)
    cms = FakePayload()

    stored = upload_greetings(client=cms, clips=clips)

    assert [upload["filename"] for upload in cms.uploads] == [
        "narrator-greeting-female.mp3",
        "narrator-greeting-male.mp3",
    ]
    assert [s.uploaded for s in stored] == [True, True] and all(s.passed for s in stored)


def test_both_present_and_identical_uploads_nothing_and_says_so(tmp_path: Path) -> None:
    """Identical bytes stay accepted — idempotent, as before: the re-run after a resumed failure
    and the re-run after nothing changed are the same thing."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    for clip, media_id in zip(clips, (350, 351), strict=True):
        _occupy(cms, clip.greeting.narrator, clip.mp3, media_id=media_id)

    stored = upload_greetings(client=cms, clips=clips)

    assert cms.uploads == [] and "upload_media" not in cms.calls
    assert [s.uploaded for s in stored] == [False, False]
    assert [s.media_id for s in stored] == [350, 351]


def test_one_identical_and_one_absent_uploads_only_the_absent_one(tmp_path: Path) -> None:
    """The resumed run after a transport failure between the two uploads."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.FEMALE, clips[0].mp3, media_id=350)

    stored = upload_greetings(client=cms, clips=clips)

    assert [upload["filename"] for upload in cms.uploads] == ["narrator-greeting-male.mp3"]
    assert [s.uploaded for s in stored] == [False, True]


# ================================================== the words claim what is now delivered


def test_the_refusal_says_nothing_was_uploaded_and_that_is_now_true(tmp_path: Path) -> None:
    """The old message said "Nothing was uploaded." while the female had just been. This one is
    raised before any upload, so the claim is checked against the fake rather than assumed."""
    clips = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.MALE, STALE, media_id=7)

    with pytest.raises(GreetingUploadError, match=r"(?i)nothing was uploaded") as raised:
        upload_greetings(client=cms, clips=clips)

    assert cms.uploads == []
    assert "delete that Media document" in str(raised.value)


class _RacingPayload(FakePayload):
    """A Payload where the male document *appears* between the pre-flight and its upload: absent
    when the pre-flight looks, stale by the time `upload_greeting` does. Nothing can prevent this
    (two requests are two requests); what must hold is that the message does not lie about it."""

    def __init__(self) -> None:
        super().__init__()
        self._looked_for_male = 0

    def find_media(self, *, filename: str) -> dict[str, Any] | None:
        found = super().find_media(filename=filename)
        if filename.endswith("-male.mp3"):
            self._looked_for_male += 1
            if self._looked_for_male == 2 and found is None:
                _occupy(self, NarratorId.MALE, STALE, media_id=7)
                return super().find_media(filename=filename)
        return found


def test_a_document_that_goes_stale_mid_upload_is_still_refused_and_the_message_does_not_lie(
    tmp_path: Path,
) -> None:
    """`upload_greeting`'s own compare, kept as defence in depth. Here the female *was* uploaded,
    so a message saying nothing was would be false — it says only what is true of this clip."""
    clips = _clips(tmp_path)
    cms = _RacingPayload()

    with pytest.raises(GreetingUploadError, match=r"Media 7.*different bytes") as raised:
        upload_greetings(client=cms, clips=clips)

    assert [upload["filename"] for upload in cms.uploads] == ["narrator-greeting-female.mp3"]
    assert "nothing was uploaded" not in str(raised.value).lower()
    assert "this clip was not uploaded" in str(raised.value).lower()
    assert "may already have been" in str(raised.value)


def test_a_single_greeting_refuses_a_stale_document_without_claiming_the_other_was_held(
    tmp_path: Path,
) -> None:
    """`upload_greeting` knows about one clip. It cannot say what became of the other."""
    (_, male) = _clips(tmp_path)
    cms = FakePayload()
    _occupy(cms, NarratorId.MALE, STALE, media_id=7)

    with pytest.raises(GreetingUploadError, match="Media 7") as raised:
        upload_greeting(client=cms, clip=male)

    assert cms.uploads == []
    assert "nothing was uploaded" not in str(raised.value).lower()
