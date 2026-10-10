# Server permit policy — phase 3

This is a local prototype policy, not an official Ezio schema or a certification of factual truth. `server/analysis.ts` validates model extraction; `server/policy.ts` owns permission decisions. There are no report-name branches, global scores, invented source expiration dates, or automatic factual verification from human responses.

## Analysis boundary

The provider receives the original report and declared use as a JSON data envelope after a system instruction that treats them as untrusted data. Output is JSON only, capped at 6,000 tokens / 256,000 response bytes, with a 60-second timeout and no automatic retries. A failed, truncated, malformed or unavailable response produces no fallback analysis. Re-analysis clears previous notes and authorization before calling the provider.

The server validates field types, enum values, bounds, unique IDs, references and acyclic action prerequisites. Each excerpt and optional source label must occur in the original report after NFC Unicode and whitespace normalization. Claims and non-UNKNOWN signals must have the required references. There are exactly five signal categories and 2–4 planned actions. Missing dependencies do not get default approval.

`Evidence.state = VERIFIED` means **excerpt provenance matched**, never independent verification. `Claim.status = SUPPORTED` means **model-interpreted support in the report**, never established truth. Absent signals remain UNKNOWN. Interpretations, issue completeness, claim coverage, use assessment and the association of excerpts with conclusions still depend on the model. Prompt separation reduces injection risk but is not a proof that the model resists every injection.

## Action permissions

| Permit | Conditions |
| --- | --- |
| ACTIVE | Explicit claim and excerpt dependencies are present, all prerequisite authorizations are ACTIVE, and action-specific conditions pass. |
| SUSPENDED | Necessary dependencies or claim information are missing, masked, unknown, or unresolved. |
| BLOCKED | An explicit refusal issue affects approval, or the mission is an experiment attempting FINALIZE. |
| NEEDS_HUMAN | A contradiction, uncertain stakes, high-stakes use, content change or unresolved judgment prevents approval. |

CORRECT, RESEARCH, REQUEST_HUMAN and BLOCK actions authorize **preparation of the proposed task**, not execution or successful completion. Their known source dependencies can remain available even when a different claim lacks evidence. Research collection can now execute via Keenable under an ACTIVE RESEARCH permit. Retrieved pages remain UNVERIFIED and are never promoted to evidence. Human review is recorded as judgment (see below). `dependsOn` denotes prerequisite authorization conditions, not completed work; action completion is deliberately not fabricated.

APPROVE checks issues scoped to its claims (empty issue claim scope means global), requires report-supported claims, then applies publication conditions. FINALIZE additionally checks the entire exact note, all its sources, all claims and all plan authorizations. Finalization requires:

1. A real mission and a valid current analysis.
2. A generated note whose exact text still equals the server-rendered note and whose SHA-256 matches its analyzed hash.
3. Every note source excerpt available; all claims supported with references; no unresolved missing, refusal or human issues.
4. Every plan action's authorization conditions satisfied. Any planned RESEARCH still suspends finalization; REQUEST_HUMAN requires human review; BLOCK refuses it. Authorization never substitutes for those unfinished tasks.
5. LOW declared-use risk, without the conservative high-stakes keyword floor for medical, legal, financial, safety and consequential personal decisions.
6. No report signal marked CONCERN. Explicit POSITIVE report findings with available excerpts for fact checking and citation integrity. Merely containing a citation is insufficient. Other absent signals stay UNKNOWN and are disclosed.
7. No model recommendation to block, escalate, research or rewrite. APPROVE alone is never sufficient; it cannot bypass any preceding condition.

This conservative policy can suspend finalization when the report lacks explicit verification findings. Source age alone has no effect. Unknown claims are not labeled false; they remain qualified in the draft. A rewrite cannot resolve a factual gap.

## Exact-content Gateway

`POST /api/missions/:id/finalize` ignores client verdicts, reloads the file, re-evaluates permissions under a per-mission write lock and records GATEWAY_DECISION with the content hash. Only ACTIVE real missions return a final document and OPEN Gateway. Experiments are always refused. Storage failures never return a final document.

Editing `POST .../note` regenerates its hash, closes the Gateway and re-evaluates. New text cannot inherit permission from the old text; it becomes NEEDS_HUMAN. Restoring exactly the analyzed server-rendered content permits normal re-evaluation. There is no human approval override or answer-as-evidence endpoint. Re-analysis regenerates the note from the unchanged original report and declared use.

Exports always include mode, hash, permissions and explicit labels: draft with reservations, refusal report, question for human review, or experiment report. `/export` never serves a final document, even after a successful Gateway decision. A final document is returned only by successful `/finalize`. This phase produces a decision note with qualified claims and provenance, not a separately rewritten untraceable answer.

State is atomic JSON in one Node process. The 3D scene and panel consume the same returned/polled mission snapshots and event log. Action arches follow action permits; the Gateway opens only after a successful server decision. No real-time multi-client synchronization is claimed. Keenable collections are stored separately with query, URL, timestamp and analysis hash; they never silently modify report-derived evidence.

## Phase 3 additions

**Research loop.** A RESEARCH action with an ACTIVE permit can run search → fetch (≤2 results) → assessment for one of its claims. The model must quote the fetched page. The server downgrades a SUPPORTS/CONTRADICTS stance to INSUFFICIENT when any of these holds: the quote is absent from the fetched text; the model reports an entity, period or scope mismatch; or none of the expected years (the claim's years, else the analyzed text's) appears within 400 characters of the quote. SUPPORTS is shown as a candidate only and changes no claim status. A checked CONTRADICTS makes dependent actions and FINALIZE NEEDS_HUMAN. Every claim of a RESEARCH action needs at least one completed assessment before that action stops counting as "research not performed". Runs are bound to the analysis hash.

**Human review.** `POST .../human` records the role, the decision, the reason, the analysis's next question, plus optional withdrawn claims and a clarified use. The record is bound to the analysis hash and the exact note hash; editing the note makes it stale. ACCEPT_QUALIFIED completes named REQUEST_HUMAN actions and settles named HUMAN issues, and acknowledges CONCERN signals for publication checks. REQUIRE_CHANGES (latest review) suspends FINALIZE. REFUSE blocks approval and finalization. A withdrawn claim is removed from the server-rendered note (listed as "removed, not refuted"), along with issues scoped only to withdrawn claims. The note is regenerated server-side and re-evaluated as new exact content. MISSING issues, unknown claims and excerpts are never changed by a human.

**Masking.** `mask`/`reset` exist only for experiments. A masked excerpt makes `available()` false, so only actions whose claims or excerpts depend on it suspend.
