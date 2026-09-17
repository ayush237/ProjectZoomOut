"""Tier A — narration lands as a draft, carries every sibling forward, and proves it.

The Leaves are published. Every write must be a draft, the live Leaf must be untouched, and a
write must not erase the text it is adding audio to — which is what a partial group PATCH does
in Payload (WP19). The fake CMS here replaces a PATCHed group wholesale for exactly that reason.
"""

from __future__ import annotations

import copy
import io
import json
import urllib.request
from email.parser import BytesParser
from email.policy import default as default_policy
from pathlib import Path
from typing import Any

import pytest

from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import clip_alt, direction_for, narration_script
from zoomout_pipeline.cms.client import PayloadClient, PayloadError
from zoomout_pipeline.cms.mapper import (
    DRAFT_STATUS,
    AudioRef,
    narration_patch,
    pending_changes_besides_narration,
    verify_live_untouched,
    verify_narration_write,
)
from zoomout_pipeline.graph.narration_nodes import (
    MP3_MIME,
    ClipStore,
    NarrationHeldError,
    NarrationWriteError,
    RenderedClip,
    attach_leaf_narration,
    render_line,
)

from .narration_fakes import FakePayload, FakeSpeechBackend, leaf_doc, speech_client

BOOK = "Ikigai: The Japanese Secret to a Long and Happy Life"
REF = AudioRef(url="/api/media/file/ikigai-leaf-04-summary-abc.mp3", duration_seconds=12.34)


def rendered(tmp_path: Path, doc: dict[str, Any]) -> list[RenderedClip]:
    return [
        render_line(
            line=line,
            speech=speech_client(FakeSpeechBackend()),
            voice="Sulafat",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=None,
        )
        for line in narration_script(doc)
    ]


# ------------------------------------------------------------------------------ patch


def test_the_patch_carries_each_group_whole_with_only_audio_changed() -> None:
    doc = leaf_doc()
    patch = narration_patch(existing=doc, audio={"summary": REF, "scenario": REF})

    assert set(patch) == {"summary", "scenario"}
    assert patch["summary"] == {**doc["summary"], "audio": REF.payload()}
    assert patch["scenario"]["prompt"] == doc["scenario"]["prompt"]
    assert patch["scenario"]["options"] == doc["scenario"]["options"], "rows kept with ids"
    assert patch["scenario"]["image"] == doc["scenario"]["image"], "the human's gate-2 pick"
    assert "_status" not in patch, "the client forces draft; the mapper never sets a status"


def test_the_patch_is_a_copy_not_a_view() -> None:
    doc = leaf_doc()
    patch = narration_patch(existing=doc, audio={"takeaway": REF})
    patch["takeaway"]["body"] = "changed"

    assert doc["takeaway"]["body"] != "changed"


@pytest.mark.parametrize("group", ["stickyNotes", "sourceReferences", "title", "takeawayy"])
def test_the_patch_refuses_anything_but_the_four_groups(group: str) -> None:
    with pytest.raises(ValueError, match="may only write"):
        narration_patch(existing=leaf_doc(), audio={group: REF})


def test_the_patch_refuses_to_invent_a_group() -> None:
    doc = leaf_doc()
    del doc["payoff"]
    with pytest.raises(ValueError, match="payoff"):
        narration_patch(existing=doc, audio={"payoff": REF})


def test_a_partial_group_patch_would_be_caught() -> None:
    """The WP19 failure, reproduced against the fake and caught by the verifier."""
    cms = FakePayload(leaf_doc())
    before = cms.get_leaf(266)
    cms.update_leaf_draft(leaf_id=266, patch={"summary": {"audio": REF.payload()}})
    after = cms.get_leaf(266)

    check = verify_narration_write(order=4, before=before, after=after, audio={"summary": REF})
    assert not check.passed
    assert "summary changed" in check.problems


# ----------------------------------------------------------------------------- verify


def test_verification_passes_a_faithful_write() -> None:
    cms = FakePayload(leaf_doc())
    before = cms.get_leaf(266)
    cms.update_leaf_draft(
        leaf_id=266, patch=narration_patch(existing=before, audio={"payoff": REF})
    )

    check = verify_narration_write(
        order=4, before=before, after=cms.get_leaf(266), audio={"payoff": REF}
    )
    assert check.passed, check.problems


def test_verification_reads_every_key_not_just_the_four_groups() -> None:
    """A write that kept every body and lost the audit trail must not pass."""
    before = leaf_doc()
    after = copy.deepcopy(before)
    after["payoff"]["audio"] = REF.payload()
    after["sourceReferences"] = []

    check = verify_narration_write(order=4, before=before, after=after, audio={"payoff": REF})
    assert check.problems == ("sourceReferences changed",)


def test_verification_catches_the_wrong_audio() -> None:
    before = leaf_doc()
    after = copy.deepcopy(before)
    after["payoff"]["audio"] = {"url": REF.url, "durationSeconds": 99.0}
    after["summary"]["audio"] = {"url": "/elsewhere.mp3", "durationSeconds": 12.34}

    check = verify_narration_write(
        order=4, before=before, after=after, audio={"payoff": REF, "summary": REF}
    )
    assert any("payoff.audio.durationSeconds" in p for p in check.problems)
    assert any("summary.audio.url" in p for p in check.problems)


def test_the_live_leaf_must_be_untouched_and_published() -> None:
    before = leaf_doc()
    same = copy.deepcopy(before)
    same["updatedAt"] = "later"
    assert verify_live_untouched(order=4, before=before, after=same).passed

    drafted = copy.deepcopy(before)
    drafted["_status"] = "draft"
    assert not verify_live_untouched(order=4, before=before, after=drafted).passed

    voiced = copy.deepcopy(before)
    voiced["summary"]["audio"] = REF.payload()
    assert (
        "live summary changed"
        in verify_live_untouched(order=4, before=before, after=voiced).problems
    )


def test_a_leaf_that_was_never_live_fails_the_live_check() -> None:
    """The arrangement — audio waits in a draft until the founder publishes again — assumes a
    published Leaf. One that is a draft on both reads has no live version to protect, and a
    comparison of the two would call it untouched."""
    never = leaf_doc()
    never["_status"] = "draft"

    check = verify_live_untouched(order=4, before=never, after=copy.deepcopy(never))
    assert not check.passed
    assert check.problems == ("_status is 'draft', not 'published'",)


def test_row_ids_are_not_content() -> None:
    before = leaf_doc()
    after = copy.deepcopy(before)
    for index, option in enumerate(after["scenario"]["options"]):
        option["id"] = f"regenerated-{index}"

    assert verify_live_untouched(order=4, before=before, after=after).passed


def test_unpublished_changes_are_found_and_audio_is_not_one() -> None:
    live = leaf_doc()
    draft = copy.deepcopy(live)
    draft["_status"] = "draft"
    draft["summary"]["audio"] = REF.payload()
    assert pending_changes_besides_narration(draft=draft, live=live) == []

    draft["title"] = "An edit nobody published"
    draft["takeaway"]["body"] = "Also edited"
    assert pending_changes_besides_narration(draft=draft, live=live) == ["takeaway", "title"]


# ----------------------------------------------------------------------------- attach


def test_one_leaf_is_uploaded_attached_and_proved(tmp_path: Path) -> None:
    doc = leaf_doc()
    cms = FakePayload(doc)
    clips = rendered(tmp_path, doc)

    attached = attach_leaf_narration(
        client=cms, leaf_id=266, clips=clips, book_title=BOOK, store=ClipStore(tmp_path)
    )

    assert attached.passed, (attached.draft_check.problems, attached.live_check.problems)
    assert attached.wrote and attached.uploads == 4
    assert len(cms.patches) == 1, "one draft version per Leaf, not four"
    assert "publish" not in " ".join(cms.calls)

    draft = cms.get_leaf(266, draft=True)
    live = cms.get_leaf(266, draft=False)
    assert draft["_status"] == "draft" and live["_status"] == "published"
    for group, clip in zip(("summary", "scenario", "payoff", "takeaway"), clips, strict=True):
        audio = draft[group]["audio"]
        assert audio["durationSeconds"] == clip.duration_seconds > 0
        assert audio["url"].endswith(f"-{group}-sulafat-{clip.sha256[:10]}.mp3")
        assert live[group]["audio"] == {"url": None, "durationSeconds": None}
        assert draft[group] == {**doc[group], "audio": audio}, "every sibling carried forward"
    assert draft["stickyNotes"] == doc["stickyNotes"], "the silent slide is untouched"
    assert draft["sourceReferences"] == doc["sourceReferences"]

    for upload, clip in zip(cms.uploads, clips, strict=True):
        assert upload["mimeType"] == MP3_MIME
        assert upload["alt"] == clip_alt(book_title=BOOK, line=clip.line, voice="Sulafat")
        assert upload["alt"].startswith("Narration of the ")
        assert upload["alt"].endswith("of Ikigai, read by Sulafat")
        assert upload["filename"].startswith(f"ikigai-leaf-04-{clip.line.slide.value}-sulafat-")
    assert attached.media["payoff"]["sha256"] == clips[2].sha256
    assert (tmp_path / "snapshots" / "leaf-04-before-1.json").exists()
    assert len(list((tmp_path / "final").glob("*.mp3"))) == 4


def test_running_it_again_uploads_nothing_and_writes_nothing(tmp_path: Path) -> None:
    """Find-then-skip on the asset path — the sibling WP20 found missing at Leaf 11 of 18."""
    doc = leaf_doc()
    cms = FakePayload(doc)
    clips = rendered(tmp_path, doc)
    store = ClipStore(tmp_path)
    attach_leaf_narration(client=cms, leaf_id=266, clips=clips, book_title=BOOK, store=store)

    again = attach_leaf_narration(
        client=cms, leaf_id=266, clips=rendered(tmp_path, doc), book_title=BOOK, store=store
    )

    assert again.passed
    assert not again.wrote and again.uploads == 0
    assert len(cms.uploads) == 4 and len(cms.patches) == 1
    first = json.loads((tmp_path / "snapshots" / "leaf-04-before-1.json").read_text())
    assert first["draft"]["summary"]["audio"] == {"url": None, "durationSeconds": None}, (
        "the pristine snapshot survives a second run"
    )
    assert (tmp_path / "snapshots" / "leaf-04-before-2.json").exists()


def test_an_upload_interrupted_before_the_write_is_found_not_repeated(tmp_path: Path) -> None:
    doc = leaf_doc()
    cms = FakePayload(doc)
    clips = rendered(tmp_path, doc)
    first = clips[0]
    from zoomout_pipeline.assets.narration import clip_filename

    cms.upload_media(
        data=first.mp3,
        filename=clip_filename(
            book_title=BOOK, line=first.line, voice=first.voice, content_hash=first.sha256
        ),
        alt=clip_alt(book_title=BOOK, line=first.line, voice=first.voice),
        mime_type=MP3_MIME,
    )

    attached = attach_leaf_narration(
        client=cms, leaf_id=266, clips=clips, book_title=BOOK, store=ClipStore(tmp_path)
    )

    assert attached.passed and attached.uploads == 3
    assert len(cms.uploads) == 4


def test_served_bytes_that_differ_stop_the_write(tmp_path: Path) -> None:
    """WP33.1's transfer proof, per clip: what Payload serves is what was checked."""
    doc = leaf_doc()
    cms = FakePayload(doc)
    cms.serve_override = lambda data: data + b"\x00"

    with pytest.raises(NarrationWriteError, match="serves bytes"):
        attach_leaf_narration(
            client=cms,
            leaf_id=266,
            clips=rendered(tmp_path, doc),
            book_title=BOOK,
            store=ClipStore(tmp_path),
        )
    assert cms.patches == []


def test_a_leaf_with_unpublished_changes_is_refused_before_anything_is_uploaded(
    tmp_path: Path,
) -> None:
    doc = leaf_doc()
    cms = FakePayload(doc)
    cms.update_leaf_draft(leaf_id=266, patch={"title": "An edit nobody published"})
    cms.patches.clear()

    with pytest.raises(NarrationWriteError, match="unpublished changes in \\['title'\\]"):
        attach_leaf_narration(
            client=cms,
            leaf_id=266,
            clips=rendered(tmp_path, doc),
            book_title=BOOK,
            store=ClipStore(tmp_path),
        )
    assert cms.uploads == [] and cms.patches == []


def test_clips_are_never_put_on_another_leaf(tmp_path: Path) -> None:
    cms = FakePayload(leaf_doc(order=4), leaf_doc(order=5, leaf_id=267))

    with pytest.raises(NarrationWriteError, match="orderIndex 5, not 4"):
        attach_leaf_narration(
            client=cms,
            leaf_id=267,
            clips=rendered(tmp_path, leaf_doc(order=4)),
            book_title=BOOK,
            store=ClipStore(tmp_path),
        )
    assert cms.uploads == [] and cms.patches == []


def test_one_leafs_clips_only(tmp_path: Path) -> None:
    clips = rendered(tmp_path, leaf_doc(order=4)) + rendered(tmp_path, leaf_doc(order=5))
    with pytest.raises(NarrationWriteError, match="one Leaf"):
        attach_leaf_narration(
            client=FakePayload(leaf_doc()),
            leaf_id=266,
            clips=clips,
            book_title=BOOK,
            store=ClipStore(tmp_path),
        )


# ------------------------------------------------------------------- the real client


class _Recorder:
    """Stands in for `urllib.request.urlopen` and remembers every request."""

    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self.requests: list[urllib.request.Request] = []
        self._responses = list(responses)

    def __call__(self, request: urllib.request.Request, timeout: float = 0) -> Any:
        self.requests.append(request)
        body = json.dumps(self._responses.pop(0)).encode()

        class _Response(io.BytesIO):
            def __enter__(self) -> _Response:
                return self

            def __exit__(self, *_: object) -> None:
                return None

        return _Response(body)


def _body(request: urllib.request.Request) -> bytes:
    data = request.data
    assert data is None or isinstance(data, bytes)
    return data or b""


def client() -> PayloadClient:
    return PayloadClient(base_url="http://cms.test", api_key="k")


def test_the_draft_write_is_a_draft_on_the_wire(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = _Recorder([{"doc": {"id": 266}}])
    monkeypatch.setattr(urllib.request, "urlopen", recorder)

    client().update_leaf_draft(
        leaf_id=266, patch=narration_patch(existing=leaf_doc(), audio={"payoff": REF})
    )

    (request,) = recorder.requests
    assert request.get_method() == "PATCH"
    assert request.full_url == "http://cms.test/api/leaves/266?draft=true"
    body = json.loads(_body(request))
    assert body["_status"] == DRAFT_STATUS
    assert body["payoff"]["audio"] == REF.payload()


def test_the_audio_upload_declares_mpeg_and_carries_its_label(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    recorder = _Recorder([{"doc": {"id": 1, "url": "/api/media/file/a.mp3"}}])
    monkeypatch.setattr(urllib.request, "urlopen", recorder)

    client().upload_media(
        data=b"\xff\xf3audio",
        filename="ikigai-leaf-04-payoff-abc.mp3",
        alt="Narration of the Payoff slide, Leaf 4 of Ikigai",
        mime_type=MP3_MIME,
    )

    (request,) = recorder.requests
    content_type = request.get_header("Content-type")
    message = BytesParser(policy=default_policy).parsebytes(
        f"Content-Type: {content_type}\r\n\r\n".encode() + _body(request)
    )
    parts = {
        part.get_param("name", header="content-disposition"): part for part in message.iter_parts()
    }
    assert parts["file"].get_content_type() == "audio/mpeg"
    assert parts["file"].get_filename() == "ikigai-leaf-04-payoff-abc.mp3"
    assert json.loads(parts["_payload"].get_content()) == {
        "alt": "Narration of the Payoff slide, Leaf 4 of Ikigai"
    }


def test_an_image_upload_is_still_png(monkeypatch: pytest.MonkeyPatch) -> None:
    """The sibling: the image path's type must not have moved with the new parameter."""
    recorder = _Recorder([{"doc": {"id": 1}}])
    monkeypatch.setattr(urllib.request, "urlopen", recorder)

    client().upload_media(data=b"png", filename="leaf-04-scenario-1.png", alt="A desk")

    assert b"Content-Type: image/png" in _body(recorder.requests[0])


@pytest.mark.parametrize(
    ("filename", "mime_type"),
    [("a\r\nX-Evil: 1.mp3", MP3_MIME), ('a".mp3', MP3_MIME), ("a.mp3", "audio/mpeg\r\nX: 1")],
)
def test_a_header_breaking_name_is_refused(filename: str, mime_type: str) -> None:
    with pytest.raises(PayloadError, match="break the form"):
        client().upload_media(data=b"x", filename=filename, alt="label", mime_type=mime_type)


def test_media_is_found_by_exact_filename(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = _Recorder([{"docs": [{"id": 7, "filename": "a.mp3"}]}, {"docs": []}])
    monkeypatch.setattr(urllib.request, "urlopen", recorder)

    assert client().find_media(filename="a.mp3") == {"id": 7, "filename": "a.mp3"}
    assert client().find_media(filename="b.mp3") is None
    assert "where%5Bfilename%5D%5Bequals%5D=a.mp3" in recorder.requests[0].full_url


def test_an_anonymous_caller_is_nobody(monkeypatch: pytest.MonkeyPatch) -> None:
    """A wrong auth scheme is served with a 200 and `user: null`."""
    recorder = _Recorder(
        [
            {"user": None},
            {"user": {"email": "pipeline-bot@zoomout.local", "accountType": "machine"}},
        ]
    )
    monkeypatch.setattr(urllib.request, "urlopen", recorder)

    assert client().whoami() == {}
    assert client().whoami()["email"] == "pipeline-bot@zoomout.local"
    assert recorder.requests[0].full_url == "http://cms.test/api/admins/me"


def test_a_clip_that_is_not_the_text_holds_its_whole_leaf(tmp_path: Path) -> None:
    """Tier A. Zero fabrication, for audio: a clip that fails its checks is never attached, and
    neither are its three siblings. Nothing is uploaded and nothing is written."""
    doc = leaf_doc()
    cms = FakePayload(doc)
    clips = rendered(tmp_path, doc)
    slow = render_line(
        line=clips[2].line,
        speech=speech_client(FakeSpeechBackend(seconds_per_char=0.26)),
        voice="Sulafat",
        prompt=direction_for(clips[2].line.slide),
        store=ClipStore(tmp_path / "slow"),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=None,
        max_attempts=1,
    )
    assert not slow.passed

    with pytest.raises(NarrationHeldError, match="Leaf 4 held: payoff"):
        attach_leaf_narration(
            client=cms,
            leaf_id=266,
            clips=[clips[0], clips[1], slow, clips[3]],
            book_title=BOOK,
            store=ClipStore(tmp_path),
        )
    assert cms.calls == [], "not even a read: the refusal comes first"
    assert not (tmp_path / "final").exists()


def test_two_voices_make_two_distinguishable_uploads(tmp_path: Path) -> None:
    """The founder chose two narrators. Their files for one slide must not be two rows that
    differ only in a hash."""
    from zoomout_pipeline.assets.narration import clip_filename as name

    line = narration_script(leaf_doc())[2]
    female = name(book_title=BOOK, line=line, voice="Achernar", content_hash="a" * 64)
    male = name(book_title=BOOK, line=line, voice="Sadaltager", content_hash="b" * 64)

    assert female == "ikigai-leaf-04-payoff-achernar-aaaaaaaaaa.mp3"
    assert male == "ikigai-leaf-04-payoff-sadaltager-bbbbbbbbbb.mp3"
    assert clip_alt(book_title=BOOK, line=line, voice="Achernar") != clip_alt(
        book_title=BOOK, line=line, voice="Sadaltager"
    )
