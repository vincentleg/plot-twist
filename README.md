# PLOT TWIST

A local trust-agent workspace for Decision-Grade AI @ Stanford, challenge 3. Phase 1: import an original Ezio report, preserve its declared use, and explore the Trame in 3D. Analysis is explicitly unavailable; the Gateway always refuses finalization.

## Run

Node.js 22.12+ and npm:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. The Node API listens on http://127.0.0.1:3001. Both bind to loopback. No API keys are needed for phase 1.

```sh
npm test
npm run build
npm start
```

`npm start` runs the compiled API only. `npm run dev` launches the complete local application. Vite proxies `/api` to Node.

## API

- `GET /api/health`
- `POST /api/missions`: JSON `{ "originalReport": "…", "intendedUse": "…" }`
- `GET /api/missions/:id`
- `GET /api/missions/:id/events`
- `POST /api/missions/:id/experiments`: creates a separate copy of a real mission.
- `POST /api/missions/:id/finalize`: always returns 403 and persists the denial event. Experiments are categorically refused; real missions await the permit engine.

Local mission files are written atomically under ignored `data/`. The original report and its import timestamp are preserved in experiment copies; the experiment event records copy creation time. Reload a mission using its `?mission=…` URL. This is a single-process local prototype, not a public service.

The TypeScript contracts in `shared/types.ts` are internal, not an official Ezio schema. Claim status, evidence state and action permits are separate concepts. No claims, evidence or permits are fabricated. No external AI calls, report interpretation, evidence masking or exports are implemented in phase 1.

Secrets belong only on the server. `.env.example` lists the expected names with empty values; `.env` variants and runtime files are ignored. Environment variables are not consumed until provider integration exists. Never prefix secrets with `VITE_`.

Tests use clearly labeled synthetic transport text in a temporary directory, never as demo evidence. See PROJECT_STATE.md for the handoff.
