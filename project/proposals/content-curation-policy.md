# Content Curation Policy — which books ZoomOut will and will not cover

**Status:** Proposed — awaiting founder approval
**Author:** Architect, 2026-08-29
**Open since:** the original brief. Named in `PRODUCT.md` and `LEGAL.md` as founder-owned and never written.

`LEGAL.md` and `PRODUCT.md` both assume this document exists. It does not, and the pipeline is now producing content — so the criteria are about to be applied by default rather than by decision. This is a draft to react to.

**This is not legal advice.** It encodes the reasoning already in `LEGAL.md` into a checklist someone can apply in two minutes per book. **The exclusion criteria should be confirmed by counsel** at the same review that covers generated output.

---

## 1. The three hard exclusions

A book meeting any of these does not enter the library, regardless of how good it would be.

### E1 — The author or publisher ships an official companion app or digital course

**The single highest-risk category, and the cheapest to check.** Three reasons compound:

- It is the clearest case of **market substitution**, which is fair-use factor four and the factor *Thomson Reuters v. Ross* turned on. Where a licensed digital product exists, ZoomOut competes with the rights-holder's own offering rather than complementing the book.
- The rights-holder has already decided this format is worth money to them, so a complaint is a commercial decision they have already made once.
- Companion apps carry **trademark**, which is a faster and cheaper claim to bring than copyright.

*Already applied once:* this criterion is why the Phase 1 library narrowed to one title on 2026-08-06.

### E2 — The publisher is a party to active AI-related litigation

They have counsel engaged on precisely this question, an institutional position, and an incentive to demonstrate enforcement. Nothing about ZoomOut's argument is strong enough to be worth being someone's example.

### E3 — The book's value *is* a proprietary framework, assessment, or named system

StrengthsFinder, DISC, Enneagram-style instruments, anything where the reader is buying access to a named model rather than an argument. Teaching the model *is* reproducing the product, and `LEGAL.md`'s originality argument — that Leaves restructure rather than mirror — **has nothing to work with** when the structure is the thing being sold.

Distinguish from a book that merely *contains* a named idea. *Atomic Habits* has the four laws, but its value is the argument around them; a Leaf can teach habit stacking without reproducing the system.

---

## 2. Two treatment rules — not exclusions

These would gut the genre if applied as exclusions. They change how a book is covered instead.

### T1 — Contested or unscientific mechanisms → attributive framing

**Ruled 2026-08-27.** Where a book asserts a mechanism about how the world works that is contested, unreplicated, or frankly metaphysical, Leaves frame it as **the author's claim** — "Wattles argues that…" — rather than as operative fact. Ordinary practical advice needs no hedge.

**Excluding these books is not an option** — it removes most of self-help, including much of what sells. And quietly modernising the author is its own fabrication. Attribution is the only honest position, and it is what the Track-level non-endorsement disclaimer already claims we do.

*Concrete case:* *The Science of Getting Rich* teaches 1910 metaphysics sincerely. It is public domain, well-written, structurally ideal for the pipeline — and asserts that thought acts on "formless substance". Covered, with framing.

### T2 — Clinical, trauma, addiction and medical subject matter → cover cautiously or not at all

**The gap this policy would otherwise leave.** ZoomOut is not just summarising: it **gamifies**. XP, streaks and an unlock gate on advice about trauma, grief, addiction or medical decisions is a tonal and ethical problem before it is a legal one, and no disclaimer fixes a progress bar attached to someone's recovery.

**Recommendation:** treat clinical subject matter as **out of scope for the MVP library**, and revisit deliberately rather than by drift. This is a product judgement, not a legal one, and it is the criterion most likely to be crossed by accident — a great many bestselling self-help books are adjacent to it.

---

## 3. Preferences — tie-breakers, not requirements

| Prefer | Why |
|---|---|
| **Public domain** | Zero exposure on both ingestion and output. Where the pipeline is built |
| **Indie and self-published authors** | The licensing path `LEGAL.md` names — slower, but it removes the question entirely and yields an "officially licensed" claim Blinkist and Headway lack |
| **Argument-driven over framework-driven** | More room for original restructuring, which is what the fair-use position rests on |
| **In print and purchasable** | Every Track carries a purchase-forward link. A book nobody can buy makes that link a lie |

---

## 4. Required regardless

- **An `acquisition` status on every Track** — `public-domain` · `licensed` · `purchased` · `undocumented`. Built and enforced since WP15.1. Recorded at ingestion, never reconstructed.
- **A non-endorsement disclaimer and purchase link**, enforced at publish.
- **A source reference per generated claim**, enforced mechanically by `ground_check`.
- **No 1:1 mirroring of chapter structure**, enforced mechanically by the structure check.

---

## 5. Applying it — the two-minute check

Before a book is ingested:

1. Search the author's name plus "app" and plus "course". → **E1**
2. Search the publisher's name plus "AI lawsuit". → **E2**
3. Is the reader buying a named system? → **E3**
4. Is the subject clinical, trauma, addiction or medical? → **T2**
5. Does it assert a contested mechanism? → **T1**, note it for the drafting prompt
6. Record the acquisition status. → **§4**

Steps 1–4 are pass/fail. **Record the answers on the Track**, so that if a criterion changes, the affected books are a query rather than a re-reading of the whole library — the same reasoning that put `acquisition` on Track in the first place.

---

## 6. What this does to the intended launch library

The founder named *Atomic Habits* as the kind of title the MVP needs — famous, not obscure. Against these criteria:

- **E1 is the one to check first and the one most likely to bite.** Several of the biggest self-help titles have official apps or courses.
- **E2 and E3 are unlikely to catch the obvious candidates**, but check.
- **T2 will exclude more than expected**, and that is the criterion worth deciding deliberately rather than discovering.

**This may conflict with "MVP should only have famous books."** If the famous titles fail E1, the honest options are: license from indie authors and lose the name recognition, or accept the exposure knowingly and record that it was a decision. **That tension is real and this document does not resolve it** — it makes it visible before content is generated rather than after.
