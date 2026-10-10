# PLOT TWIST

A local trust-agent workspace for Decision-Grade AI @ Stanford, challenge 3. Import an original Ezio report, declare its use, request structured analysis and inspect server-evaluated action permissions in the Trame.

## Run

Node.js 22.12+ and npm:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. Node listens on http://127.0.0.1:3001; Vite proxies `/api`. Both bind to loopback.

```sh
npm test
npm run build
npm start
```

`npm start` runs the compiled API only. `npm run dev` launches the complete local app.

## TokenRouter configuration

Copy `.env.example` to `.env` and fill the sponsor-provided values locally. The server loads `.env` on startup; restart after changes. Existing process environment takes precedence. Never put secrets in `VITE_` variables or client code.

Required for analysis: TOKENROUTER_API_KEY, TOKENROUTER_BASE_URL, TOKENROUTER_MODEL. No default endpoint or model is supplied. Without them, the UI and API report **Analysis unavailable: provider not configured**. Keenable search → fetch uses the documented public tier when KEENABLE_API_KEY is absent; a configured key selects authenticated endpoints.

The sponsor connection was verified with https://api.tokenrouter.com/v1 and the configured model openai/gpt-6.1-sol. One real minimal JSON completion succeeded; no Ezio analysis has been run yet. BASE_URL must be the supplied HTTPS API base (including its version path), or exact `/chat/completions` endpoint. The adapter appends only `/chat/completions` if necessary. It sends Bearer auth, `messages`, `response_format: {type: "json_object"}`, `max_completion_tokens: 6000`, `stream: false`. Unsupported parameters produce a visible error; there is no silent provider fallback.

The report and use are sent only when **Analyze report** is clicked. No request bodies, provider response bodies, keys or endpoint values are logged. Errors are sanitized. There are no purchases, top-ups, deployments or HarnessRouter calls. Research is explicit and bounded.

## Interface

1. Paste/import the real report, provide intended use, then **Create mission**.
2. **Analyze report** shows progress, errors, model recommendation, report excerpts, issues and server permits.
3. Inspect **Decision note**, optionally edit and save. Edits invalidate inherited finalization permission.
4. **Finalize server note** downloads a final document only if the current server permit is ACTIVE. Otherwise use the draft/refusal/review export.
5. **Create isolated experiment** copies the mission. Its Gateway can never open; export is explicitly labeled as an experiment.

The action arches use green ACTIVE, amber SUSPENDED, red BLOCKED, purple NEEDS_HUMAN; the panel also spells out each status and reason. A permitted research or correction action means authorized preparation, not that the task was executed. An ACTIVE RESEARCH action can now run one explicit Keenable search followed by a fetch of its first eligible result. Pages stay UNVERIFIED and do not resolve issues or unlock finalization. No evidence masking is included yet.

## API

- `GET /api/health`: health and provider configuration presence only.
- `POST /api/missions`: JSON `{ "originalReport": "…", "intendedUse": "…" }`.
- `GET /api/missions/:id` and `GET .../events`.
- `POST .../analyze`: synchronous bounded provider request; GET polling exposes persisted RUNNING state.
- `POST .../research`: JSON `{ "actionId": "…", "query": "…" }`; requires an ACTIVE RESEARCH permit, persists search/fetch events and unverified sources.
- `POST .../note`: JSON `{ "content": "…" }`; exact-content re-evaluation.
- `POST .../experiments`: isolated copy from a real mission.
- `POST .../finalize`: current-state re-evaluation, GATEWAY_DECISION event, 200 with final document or 403 with reason.
- `GET .../export`: downloadable text, always explicitly non-final.

Mission JSON files are written atomically under ignored `data/`. Original report and import time are preserved. Reload a mission through its `?mission=…` URL. This is a local single-process prototype with no accounts or external database. An interrupted RUNNING analysis is marked failed on server restart.

See [the explicit permit policy](docs/PERMIT_POLICY.md) for limits: matching provenance is not factual truth, extraction remains model-dependent, and absent signals are never invented. Tests use clearly labeled synthetic fixtures and mocked transport only; they do not demonstrate sponsor connectivity or four-report coverage. See PROJECT_STATE.md for the handoff.

## Real connection checks and report handoff

`node --import tsx scripts/check-tokenrouter.ts` is an **opt-in real call** with a 256-token completion cap using the same `.env` loader and transport as the server. It consumes sponsor credits; it is never run automatically. `node --import tsx scripts/check-keenable.ts` makes a real public/keyless search and fetch, with no model call. Both succeeded during connection setup.

Place original Ezio PDFs in `data/reports/` (ignored by Git). The current browser importer accepts text only; a PDF placed there still needs text extraction before mission import. Keep the original PDF intact. No PDF or real Ezio mission was present during setup.

Keenable follows the [official SDK wire contract](https://github.com/keenableai/keenable-sdk/blob/main/typescript/src/client.ts): public endpoints when no key exists, explicit client identification, bounded responses and timeouts. One search returns up to five retained candidates; only the first eligible URL is fetched. Retrieval time and truncation are recorded, without invented expiry. A failed fetch retains actual search results and an explicit error, never fallback content. Non-final exports include the research appendix; final authorization policy is unchanged. Semantic verification of retrieved pages remains to implement.
