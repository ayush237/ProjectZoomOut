# Legal & Intellectual Property Strategy

Full reasoning behind the Content Integrity & Legal Constraints in `project/PRODUCT.md`. This file is the "why"; `PRODUCT.md` has the resulting rules as engineering requirements. Source: founder's original project brief (`project/original-brief.md`, section 3).

**Status:** this is the founder's initial position, not yet reviewed by counsel. Treat as working legal strategy, not cleared policy.

## Legal basis
- Primary posture: fair use — a case-by-case defense weighed on purpose, nature of the work, amount used, and market effect, not a bright-line rule. Applies absent a direct license.
- The area is active and unsettled as of mid-2026: federal litigation is ongoing against a major AI provider over whether AI-generated book summaries infringe copyright — unresolved, and directly relevant to this category. *Thomson Reuters v. Ross Intelligence* (2025), the first final AI/copyright judgment, denied fair use specifically because the output competed with the copyright holder's own market — the precedent most relevant to ZoomOut's positioning.
- No court has ruled on this exact use case. This is a documented position and mitigation plan, not a settled legal conclusion — legal review is required before public launch.

## Competitive landscape
| Company | Legal posture | Primary mitigation |
|---|---|---|
| getAbstract | Licensed | Direct agreements with 600+ publishers |
| Headway | Fair use | Non-endorsement disclaimers (per its own Terms & Conditions, no licensing claim); scale/longevity as precedent (40M+ users) |
| Blinkist | Fair use | Original expression, heavy editorial polish, large writing team |
| Shortform | Fair use | Depth/quality over volume; positions against "AI slop" |
| StoryShots | Fair use | Nominative use + affiliate-to-purchase framing, non-affiliation disclaimers, age-gating |
| Bookey | Unlicensed, AI-generated | None — cautionary case; public author complaint over fabricated quotes forced a walk-back of AI content |

No durable competitor relies on legal posture alone — each pairs it with an operational mitigation layer (disclaimers, review, curation, or affiliate framing). ZoomOut adopts the same principle.

## ZoomOut's approach
Primary posture: fair use, positioned as a complement to the source book, not a substitute — same category as Headway, not a licensing-dependent model.

**Required mitigation layer:**
- Non-endorsement disclaimers on every Track — concepts are the original author's ideas; the author/publisher does not endorse ZoomOut.
- Original structure requirement — content is restructured into ZoomOut's own taxonomy; lessons must not reproduce a book's chapter structure or named framework 1:1.
- Purchase-forward framing — every completed Track links to a retailer page for the book (affiliate where available). Addresses the market-substitution factor from *Ross Intelligence* above, and adds revenue.
- Curated launch library — excludes (a) authors with an existing official companion app, and (b) publishers in active AI litigation. Full criteria: Content Curation Policy (owner: TBD).
- Zero-fabrication policy — see Content integrity safeguards below.
- Minor protection — age-gate at sign-up, consent flow compliant with the strictest applicable regional standard (COPPA/GDPR-K). Exact threshold: owner TBD, required pre-launch.

**Parallel track — direct licensing:** pursue licensing with a small cohort of indie/self-published authors ahead of launch. Not required for the fair-use posture, but adds an "officially licensed" claim most competitors above lack, via faster, cheaper rights clearance than major-publisher or bestseller-tier deals.

**Legal governance checkpoints:**
1. IP counsel review of actual generated content (not just this document) before launch.
2. IP counsel review of the initial book list before launch.
3. Recurring review as the library scales.

## Content integrity safeguards
The highest-severity risk is fabricated content attributed to a real author — a false-attribution risk distinct from, and more urgent than, the copyright question above (see Bookey, in the competitive landscape). Requirements:
- Critic-in-the-Loop must verify facts against source material, not just tone, style, or IP-safety.
- Every generated fact or quote — especially Dinner Table Knowledge slides — needs a stored source reference for traceability and audit.
- User-facing "report an error" action on every Leaf, routed to a fix queue with a defined SLA.
- Takedown process able to pull a Track within hours of a verified complaint, not weeks.

### The fix queue SLA (defined 2026-08-13, WP10)

The SLA is **a process a person follows, not software**. Nothing in the app enforces
these timings; they are the commitment the correction channel is only meaningful
because of, and they are what "a defined SLA" above refers to.

**Who reviews.** The founder, until there is somebody else. Reports are read by a human
in every case — no report is auto-closed, and the queue has exactly two states (`open`
and `resolved`) precisely so that "resolved" always means a person looked.

**How often.** The queue is checked **once every working day**. Reports arrive through
`GET /moderation/reports`, behind an operator token; the backend also logs every filing
at `warn` level, so a report is visible in the ordinary logs without anyone polling.

**What the clock is, by severity.** Two different promises, and conflating them is what
makes an SLA meaningless:

| Report | Response |
|---|---|
| `offensive`, or anything alleging **fabricated content attributed to a real author** | **Same day.** Unpublish the Track first and investigate afterwards — reversing an unpublish costs nothing, and leaving a false claim attributed to a named author up while it is investigated is the risk this whole policy exists to avoid. |
| `wrong_answer` — an option marked correct that is not | **One working day.** The payoff gate is teaching the wrong thing, so it is a correctness bug with a legal edge, but it is not a false claim about a person. |
| `factual_error` | **One working day** to triage, corrected in the next content pass. |
| `other` | Read within one working day, no correction commitment. |

**What "within hours" means operationally.** The takedown commitment above is about the
*mechanism*, and the mechanism is already immediate: unpublishing a Track in the CMS
removes it from every API response within the content cache TTL (60 seconds, capped at
600 by configuration). So the hours are review time, not engineering time — the founder
has to decide, and the pulling itself is one action in the admin UI.

**What this does not cover.** Reports are not acknowledged by email; the reader gets an
in-app confirmation at submission and nothing afterwards. Closing that loop needs the
transactional email provider WP13 introduces, and until then the SLA is a promise about
what happens to the content, not about what the reporter is told.

## Open compliance items (pre-launch blockers)
Each requires an owner and decision before launch:
- **Data privacy** — privacy policy and DPAs for all third-party AI vendors (Gemini, ElevenLabs, Vertex); GDPR/CCPA assessment.
- **Subscription compliance** — trial disclosure, renewal timing, and cancellation flow must meet FTC "negative option" rules and EU/state equivalents before monetization goes live. (Monetization model itself isn't decided yet — see `project/PRODUCT.md` Open items.)
- **Content moderation** — required before the phase 3 social feature (Reading Circles) ships, not after.
