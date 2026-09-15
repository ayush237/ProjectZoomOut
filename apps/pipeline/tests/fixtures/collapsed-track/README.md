# `collapsed-track` — Track 42's published scenario illustrations

Eighteen 240px thumbnails of *The Science of Getting Rich*'s published scenario images, as
they were on 2026-09-11. **They are here because they are the failure**: every one of them is
a seated figure at a table in a dim interior, including Leaf 13, whose scenario is about
buying a family home.

`tests/test_variety.py` asserts that `check_variety` still calls this set collapsed. That is a
regression test on the threshold rather than on the code: a floor tuned upward until a new
Track passes would quietly start passing this one too, and this is the set whose failure a
human confirmed by looking.

**Thumbnails rather than the originals** — 623 KB instead of 18 MB. The signature is computed
from a 96x72 edge map, so the measurement is unchanged: the full-size set scores 0.5030 and
these score 0.5017.
