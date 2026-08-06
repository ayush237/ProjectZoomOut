
# 1. Introduction 

In today's time, with the heavy usage of social media, brain-rot content and AI access, the cognitive ability of
the users has taken a toll and this is an increasing risk. We live in an attention economy designed to distract us. 

"ZoomOut" is the antidote. We transform the world's most powerful non-fiction literature into highly addictive, 
interactive micro-lessons. We are reclaiming mobile screen time by replacing "brainrot" doom-scrolling with high-signal,
actionable growth.

The Problem: The Great Retention Gap
● The Attention Tax: The average adult spends over two hours daily on algorithmic social feeds that leave them fatigued and
unfulfilled.
● The Friction of Growth: Traditional reading requires a high barrier to entry and offers terrible knowledge retention.
● The Passive Consumption Trap: Existing "micro-learning" apps (like Blinkist or Headway) merely offer passive text and audio
summaries. Users feel productive in the moment, but forget the insights within days because there is no active engagement

Consumers desperately want to improve themselves, but the current tools either bore them to sleep or fail to make the knowledge
stick. The target users are the ones who do realize that they are wasting 2hrs + average on social media, if they find an opportunity 
like ZoomOut where they can invest 15 minutes, their day will still be a bit fruitful and helful in long term. 


# 2. Functional and Non-Functional requirements 

Functional - 

- The app should provide micro-learning concepts to user extracted from literature. 
- The microlearning should be gamified like how duo-lingo for proper customer retention with streaks, rewards etc.
- The app should be able to process an AI pipeline to convert a self-help literature book into micro learning concepts.
- The content generation should follow the legal strategy decided. 
- The app should have a consistent smooth and modern UI/UX. 
- The app should handle user and profile management. 
- The app should have a social aspect like snap-chat where users can form groups and share status/streaks. 
- The users should have an explore section of books and ability to add them to library and start 
  the "journey" for that book in the micro-learning phase. 
- The app should store user progress, rewards etc. 


Non Functional - 

- The app can start with lesser number of users as promotional phase and then scale up to production level.
- The micro-learning should also have a positive friction that users can not use it for more than 15 mins/500 xp points. 
- The app should have a balanced stimulus for the users, good enough to have retention, 
  but not too much so that it causes brain-rot. 


# 3. Legal & Intellectual Property Strategy

### 3.1 Legal Basis
Absent a direct license (3.3), ZoomOut's content pipeline relies on a **fair use position** — a case-by-case defense weighed on purpose, nature of the work, amount used, and market effect, not a bright-line rule.

This area is active and unsettled as of mid-2026:
*   Federal litigation is ongoing against a major AI provider over whether AI-generated book summaries infringe copyright — unresolved, and directly relevant to this category.
*   *Thomson Reuters v. Ross Intelligence* (2025), the first final AI/copyright judgment, denied fair use specifically because the output competed with the copyright holder's own market — the precedent most relevant to ZoomOut's positioning (3.3).

No court has ruled on this exact use case. This section documents our position, mitigations, and open items requiring legal review before public launch.

### 3.2 Competitive Landscape
| Company | Legal Posture | Primary Mitigation |
|---|---|---|
| getAbstract | Licensed | Direct agreements with 600+ publishers |
| Headway | Fair use | Non-endorsement disclaimers (per its own Terms & Conditions, no licensing claim); scale/longevity as precedent (40M+ users) |
| Blinkist | Fair use | Original expression, heavy editorial polish, large writing team |
| Shortform | Fair use | Depth/quality over volume; positions against "AI slop" |
| StoryShots | Fair use | Nominative use + affiliate-to-purchase framing, non-affiliation disclaimers, age-gating |
| Bookey | Unlicensed, AI-generated | None — cautionary case; public author complaint over fabricated quotes forced a walk-back of AI content |

**Takeaway:** no durable competitor relies on legal posture alone — each pairs it with an operational mitigation layer (disclaimers, review, curation, or affiliate framing). ZoomOut adopts the same principle.

### 3.3 ZoomOut's Approach

**Primary posture:** Fair use, positioned as a complement to the source book, not a substitute — same category as market leader Headway, not a licensing-dependent model.

**Mitigation layer (required):**
*   **Non-endorsement disclaimers** on every Track: concepts are the original author's ideas; the author/publisher does not endorse ZoomOut.
*   **Original structure requirement:** concepts are restructured into ZoomOut's own Tree/Branch/Leaf taxonomy — lessons must not reproduce a book's chapter structure or named framework 1:1.
*   **Purchase-forward framing:** every completed Track links to a retailer page for the book (affiliate where available) — addresses the market-substitution factor from *Ross Intelligence* (3.1) and adds revenue.
*   **Curated launch library:** excludes (a) authors with an existing official companion app, and (b) publishers in active AI litigation. Full criteria: *Content Curation Policy* (owner: TBD).
*   **Zero-fabrication policy:** see 3.4.
*   **Minor protection:** age-gate at sign-up, consent flow compliant with the strictest applicable regional standard (COPPA/GDPR-K). Exact threshold: owner TBD, required pre-launch.

**Parallel track — direct licensing:** pursue licensing with a small cohort of indie/self-published authors ahead of launch. Not required for the fair-use posture, but adds an "officially licensed" claim most 3.2 competitors lack, via faster, cheaper rights clearance than major-publisher or bestseller-tier deals.

**Legal governance checkpoints:**
1.  IP counsel review of actual generated content (not just this document) before launch.
2.  IP counsel review of the initial book list before launch.
3.  Recurring review as the library scales.

### 3.4 Content Integrity Safeguards
The highest-severity risk is fabricated content attributed to a real author — a false-attribution risk distinct from, and more urgent than, the copyright question (3.2, Bookey). Requirements:
*   Critic-in-the-Loop (Section 4, NFRs) must verify facts against source material, not just tone/style/IP-safety.
*   Every generated fact or quote — especially **Dinner Table Knowledge** slides — needs a stored source reference for traceability and audit.
*   User-facing "report an error" action on every Leaf, routed to a fix queue with a defined SLA.
*   Takedown process able to pull a Track within hours of a verified complaint, not weeks.

### 3.5 Open Compliance Items (Pre-Launch Blockers)
Each requires an owner and decision before launch:
*   **Data privacy:** privacy policy and DPAs for all third-party AI vendors (Gemini, ElevenLabs, Vertex); GDPR/CCPA assessment.
*   **Subscription compliance:** trial disclosure, renewal timing, and cancellation flow must meet FTC "negative option" rules and EU/state equivalents before Section 3.5 monetization goes live.
*   **Content moderation:** required before Reading Circles (3.4) ships — not after.


# 4. Core micro-learning concept 

The actual micro-learning concept following a knowledge tree concept :

- A book is divided into multiple sections (ideally 15 to 30), these sections may not necessarily be mapped 1:1 with the book chapter. 
- These sections are called "leaves" or "nodes" each leaf has the core micro learning structure. 
- A book track is basically the leaves/nodes lined up in a road-map for the book. 
- Each leaf/node is a 5 slide structure :
 Slide 1 : A short textual summary of the concept 
 Slide 2 : A relatable real life scenario for the user as per the concept with 3 options to the user
 Slide 3 (unlocks when the user answers correctly on slide 2) : The actual payoff node explaining the concept in more details so that user will have the learning
 Slide 4 : The sticky notes screen having the important points written in sticky notes stuck on board.
 Slide 5 : Final slide with a key take away and an optional "dinner table knowledge" fact section which users can optionally open to know more. 
- The leaves/nodes work on a concept of System A and System B of human brain, slide 1 and 2 are easy to consume hence it is Section A, but the next 2 sections are more detailed hence this requires system B to activate
- Slides 2,3 have a voiceover button which will trigger a human voice over of the content on screen for better engagement. 
- Users can "complete" a leaf and move ahead in the roadmap and hence complete the entire book track. 
- There will be an option of "wrap up my today's session" which will complete today's learning journey and show an asthetic screen to user about what they learnt in todays journey. 
  This screen will be made sharable on social media for social validation purpose
- There will be beautiful and asthetic screens (which can be shared on social media) while completing the following :
a) Completing an achievement b) wrapping up a day's session
- There will be a screen for "reaching todays limit" which gracefully tells the user that they have reached today's limit.


# 5. Gamification aspect : 
The app follows a gamification theme like duo lingo so that user retention is maintained. 
- Users will unlock achievements and badges while completing different milestones 
- Users will maintain a daily streak of learning and XP points earned on each leaf/node. 
- There will be SFX in the app on different actions like giving right/wrong answer, competing a leaf, achievements, rewards, wrapping up session etc. 


# 6. App profile and other features/screens : 

- The app will have a profile section displaying user's name and details, their achievements and streak count. 
- There will be an explore section where users can search for books and add them to library.
- There will be library screen showing the currently added books along with the progress done on each.
- There will be journey section showing the current active journeys which will hep users to directly continue where they left off. 

# 7. The AI pipeline : How a book will be converted into the knowledge tree

TBD in phase 2

# 8. The social aspect of the app : How users can form groups, share journys etc

TBD in phase 3



