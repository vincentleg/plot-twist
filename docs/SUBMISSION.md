# PLOT TWIST — Devpost submission

## Team name
PLOT TWIST

## Team members
Vincent Leguide — solo builder

## Chosen track
Build a Trust Agent

## Tagline
A 3D trust world where AI decisions are tested before their results cross into ours.

## Short description
A fluent AI answer, or a single global trust verdict, is not enough to authorize an action. PLOT TWIST imports real Ezio trust reports and examines them claim by claim against a declared use. TokenRouter proposes a structured analysis; our server code, not the model, grants each action a permit: ACTIVE, SUSPENDED, BLOCKED or NEEDS_HUMAN. Keenable searches and reads new sources. Each source must be quoted and checked for context, and stays a candidate rather than proof. A targeted human review is recorded as judgment, never as evidence, and triggers re-evaluation. The Trame, a 3D world, shows the real server state. The Gateway controls finalization of the exact document. When finalization is not allowed, it still produces a useful labelled draft, refusal or question for a human.

## Repository
https://github.com/vincentleg/plot-twist

## Best Use of Ezio
Ezio's per-claim results made us separate three different situations in the EV market report: a Geely verdict that contradicts its own cited figure (kept as disputed and routed to a human to check entity, year and scope), a Top 3 ranking that is unverified rather than false, and figures Ezio never assessed. On the work-from-home report, Ezio's CRITICAL framing-bias finding and its "Accuracy: Not scored" result led to an editorial review for publication. Unchecked claims stayed unknown, never treated as false or as a zero score. Both paths are visible in the demo video and in the evidence, signals and decision panels.

## AI and event tools
- **Ezio**: two real trust-analysis exports (EV market 2024, work from home) imported with their detailed claim results, sources and findings.
- **TokenRouter** (model `openai/gpt-6.1-sol`): real calls for the structured report analysis and for assessing each fetched source against a claim.
- **Keenable** (free public tier): real search and page fetch, at most two sources per claim. Quotes, URLs and dates are kept as provenance; candidate sources are never automatically promoted to evidence.
- **OpenAI Codex and Claude Code**: development assistance, fixes and verification.
- **Libraries**: React, Three.js, React Three Fiber and drei, built with Vite, TypeScript and Node.js.

## Limitations
Semantic judgments (claim extraction, interpretation, and whether a source matches a claim's entity and scope) depend on the model. Our server bounds them: exact excerpts from the report, quotes present in fetched pages, the expected year near the quote, and content hashes. But none of this guarantees factual truth. Retrieved sources remain candidates. In both current real runs, no finalization was authorized: the Gateway stays closed with an explained reason, and the outputs are a labelled question for human review and a draft with reservations. PLOT TWIST controls only the finalization of its own decision document, not actions in external systems. It is a single-user local prototype.
