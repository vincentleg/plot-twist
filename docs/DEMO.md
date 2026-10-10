# PLOT TWIST — demo video (≈105 s)

Local app (for recording only, not a public link): http://127.0.0.1:5173

Two real missions, already analyzed, both computed after the research fix:

- EV market 2024: http://127.0.0.1:5173/?mission=0a1afcf5-f6d5-484d-b880-1e3eeaa7ba4e
- Work from home: http://127.0.0.1:5173/?mission=e984e024-2d3c-4509-ac49-b17afffd6132

Do **not** click "Re-analyze original report" during recording: it calls the model again (about 50 s) and replaces the analysis. Both missions already contain one recorded Keenable run and one recorded human review. Present them as recorded.

## Pre-flight check (2 min, before recording)

1. Open the EV URL. The 3D scene shows cyan buildings, labelled arches, crystals e1…e12 and the Gateway labelled "GATEWAY · CLOSED — finalize permit: NEEDS HUMAN".
2. Mission control (right panel) shows the declared use, the actions a1–a3 with their reasons, and the buttons "Finalize server note", "Create isolated experiment" and "Export draft / refusal / review question".
3. Open the WFH URL. The FINALIZE reason reads "Required claim information is unresolved…".
4. If the 3D scene does not appear, the panels still carry the whole demo.

## Timeline, clicks and narration

**0–10 s — Problem and the Trame** (EV URL open)
> "An AI answer can sound right and still not be safe to act on. PLOT TWIST is a trust agent: the model proposes, our code authorizes. This is the Trame. These are results from actual runs on two Ezio reports."

**10–40 s — EV market report**
- Click **View original report** (Declared use panel), scroll briefly, then close it.
- Expand **Signals and unresolved issues**.
- Expand **Claims and source excerpts**: c1 · DISPUTED (Geely), c2 · UNVERIFIABLE (Top 3), c6–c12 · UNASSESSED.
- In the 3D scene, click crystal **e1**: the card shows the Geely excerpt, c1 · DISPUTED and its dependent actions.
- Expand **Collected web sources · not verified evidence**: the recorded run on c2 (two sources, both INSUFFICIENT, with quotes and period checks).
> "An analyst wants this EV summary in a client note. Ezio marks Geely 'contradicted', yet the contested and cited figures are identical. We keep that verdict as disputed and ask a human to check entity, year and scope. The Top 3 ranking is unverified, not false. Other figures were never assessed. A recorded Keenable run fetched two sources. Neither settles the 2024 ranking, so nothing is promoted to evidence. The Gateway asks for human review."

**40–60 s — EV experiment**
- Click **Create isolated experiment**: the view turns magenta (EXPERIMENT / ISOLATED COPY).
- Expand **Claims and source excerpts**, then under e1 click **Mask in experiment**. The a1 and a3 arches turn SUSPENDED and a2 stays ACTIVE.
- Click **Finalize server note**: the error banner says experiments can never finalize.
- Click **Reset all excerpts**.
> "In an isolated copy, I mask the Geely excerpt. Only the actions depending on it suspend; research stays active. Experiments can never finalize. Reset."

**60–95 s — Work-from-home report**
- Paste the WFH URL.
- Expand **Signals and unresolved issues**: BIAS CONCERN (CRITICAL one-sided framing), UNCERTAINTY CONCERN.
- Expand **Claims and source excerpts**: c5 · SUPPORTED, c1–c4 · UNVERIFIABLE, c6–c8 · UNASSESSED.
- Expand **Human review · judgment, not evidence**: the precise question, and the recorded review "ACCEPT_QUALIFIED · Communication lead".
- Point at the FINALIZE reason (Gateway bar): "Required claim information is unresolved. A rewrite cannot verify it."
> "A communication lead wants to publish this as a balanced analysis. Accuracy is 'Not scored', which means not evaluated, never zero. One claim is supported, four lack evidence: unverified, not false. Critical framing bias calls for an editorial revision and a targeted review. The lead's recorded review accepted a qualified rewrite. The server re-evaluated: the decision moved from 'needs human' to 'suspended', because a human judgment is not evidence."

**95–110 s — Export and close**
- Click **Export draft / refusal / review question**, then open the downloaded file. Its first line reads "DRAFT WITH RESERVATIONS — NOT FINAL", followed by the hash, the Gateway reason, the note with its "Unknown — not evaluated or lacking evidence" section and the action authorizations.
> "When finalization isn't allowed, you still get a useful, honestly labelled output. Neither document was finalized, because the server refused for stated reasons. Evidence before permission. Permission before action."

## Verified behaviours used above
Real TokenRouter analyses of both reports; real Keenable search → fetch → assessment (recorded); masking e1 in the EV experiment suspends a1 and a3 while a2 stays ACTIVE (API run); experiment finalize returns 403; the WFH human review moved FINALIZE from NEEDS_HUMAN to SUSPENDED (API run); export labels as listed. The visual rendering in the browser was not checked by the assistant: run the pre-flight check.
