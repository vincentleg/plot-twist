# PLOT TWIST

A local trust-agent workspace for Decision-Grade AI @ Stanford, challenge 3. Import an original Ezio report and declare its use. Scout walks the Trame, a 3D world where every action holds a server permit: ACTIVE / SUSPENDED / BLOCKED / NEEDS_HUMAN. **The LLM proposes; the code authorizes.** The Gateway (la Passerelle) opens only after `POST /finalize` re-evaluates the exact note on the server.

## Run

Node.js 22.12+:

```sh
npm install
npm run dev      # API on 127.0.0.1:3001, UI on http://127.0.0.1:5173
npm test         # synthetic fixtures + mocked transport only
npm run build
```

Copy `.env.example` to `.env`: TOKENROUTER_API_KEY, TOKENROUTER_BASE_URL (e.g. `https://api.tokenrouter.com/v1`), TOKENROUTER_MODEL. Optional KEENABLE_API_KEY; without it the free public Keenable endpoints are used. Secrets stay server-side and are never logged.

Real reports: put the Ezio exports in `data/reports/ev-market.md` and `data/reports/work-from-home.md` (ignored by Git). The UI then shows **Load real export** buttons that fill the report and a declared use. No verdict is stored or hard-coded. See [docs/DEMO.md](docs/DEMO.md) for the demo path and [docs/SUBMISSION.md](docs/SUBMISSION.md) for the Devpost text.

## Sponsors actually used

- **Ezio**: the two real trust-analysis exports are the input.
- **TokenRouter** (`openai/gpt-6.1-sol`): structured report analysis (`max_completion_tokens` 6000) and per-source assessment (2000). Verified with real calls on 2026-10-10.
- **Keenable** (free public tier): real search, then fetch of at most two results per claim. Fetched text is kept verbatim (no fetch prompt).
- No HarnessRouter, no paid top-up.

## What the engine does

1. **Analysis**: claims, exact report excerpts (checked against the original text), five signals, issues, use risk and 2–4 actions. Generic rules apply to every report: "Not scored" means not evaluated, never zero; score bars are not probabilities; a heading that checks out does not validate the body; unlisted claims stay UNASSESSED; a self-contradicting verdict is kept, marked DISPUTED and escalated to a human.
2. **Permits** (`server/policy.ts`): explicit claim and excerpt dependencies, prerequisite chains, issue scope, use stakes, exact note hash. Preparation permits never mean execution.
3. **Research loop**: search → fetch (≤2) → the model must quote the page → the server checks the quote is in the fetched text, the model's entity/period/scope flags, and deterministically that the expected year appears near the quote. SUPPORTS stays a *candidate* (never promoted to verified evidence). A checked CONTRADICTS escalates FINALIZE to NEEDS_HUMAN and is never auto-resolved. Provenance, content and dates are kept and exported.
4. **Human review**: the analysis's precise question, the responsible role, a decision (accept the qualified rewrite / require changes / refuse), and optionally a clarified use or claims to withdraw. The review is bound to the analysis and exact note hash, then permits are re-evaluated. A human can complete REQUEST_HUMAN steps and settle HUMAN issues. It can never turn a MISSING issue or an unknown claim into fact.
5. **Experiments** (magenta): an isolated copy. Mask an excerpt to see only its dependent actions suspend, then Reset. Experiments can never finalize.
6. **Gateway**: `/finalize` reloads state under a lock, re-evaluates the exact content and records GATEWAY_DECISION. Any error leaves it closed. Outputs: final document (only on ACTIVE), or a labelled draft with reservations, refusal report or question for human review.

## API

`GET /api/health`, `GET /api/samples`, `POST /api/missions`, `GET /api/missions/:id[/events]`, and `POST /api/missions/:id/` + `analyze`, `research` `{actionId, claimId, query}`, `human` `{reviewer, decision, comment, actionIds?, issueIds?, withdrawClaimIds?, clarifiedUse?}`, `note` `{content}`, `experiments`, `mask` `{evidenceId, masked}` and `reset` (experiments only), `finalize`. `GET .../export` is always non-final. Revised documents: `POST .../revisions`, `POST .../revisions/:rid/review` `{reviewer, decision: ACCEPT_LIMITED_USE|DECLINE}`, `POST .../revisions/:rid/finalize` and `GET .../revisions/:rid/pdf` (approved only after an ACTIVE finalize of the same hash; otherwise DRAFT).

## Limits

Extraction, interpretation and source assessment depend on the model. Server checks bound them (excerpts, quotes, year proximity, hashes) but do not establish truth. The model's entity/scope flags are not independently checked. Excerpt provenance is not factual verification. Single local process, JSON files in `data/`, no accounts and no multi-client sync. See [docs/PERMIT_POLICY.md](docs/PERMIT_POLICY.md) and [PROJECT_STATE.md](PROJECT_STATE.md).

## Public demo (Vercel)

`api/handler.js` serves a read-only demo from `demo/fixtures/`: the two recorded missions, sanitized by `scripts/build-demo-fixtures.ts` (private Ezio result link, account notice, timestamps, internal scoring note and third-party page bodies removed). Analysis, research, imports and edits return 403 and no provider key is configured. Each browser's demo actions (experiment, mask, revision, review, finalize) are kept in a short cookie log and replayed through the same server handler on every request, so permits are still computed server-side. The UI shows a "Public demo" badge in this mode.
