# PLOT TWIST — 90-second demo

Prerequisites: `npm run dev`, then open http://127.0.0.1:5173. The two real Ezio exports must be in `data/reports/ev-market.md` and `data/reports/work-from-home.md` (ignored by Git). Analysis takes about 45–55 s per report through TokenRouter (`openai/gpt-6.1-sol`). A search → fetch → assess run takes about 10–15 s. For a smooth recording, you can analyze both missions before you start and reopen them through their `?mission=` URLs.

## Clicks

1. **Load real export · EV market 2024** → **Create mission** → **Analyze report**.
2. In the Trame: arches show action permits, crystals show report excerpts and Scout halts at the first non-ACTIVE step. Click a crystal to read its excerpt, its claims and the actions that depend on it.
3. Mission control → **Signals and unresolved issues**: Geely DISPUTED with a HUMAN issue (entity / year / scope), Top 3 UNVERIFIABLE, other figures UNASSESSED.
4. **Keenable search → fetch → cite → assess**: pick a claim (e.g. the Top 3 ranking) → **Run**. Two sources at most. Each shows its quote, whether the quote was found in the fetched text, entity/period/scope checks and dates.
5. **Human review**: read the precise question → role "Analyst (client note owner)" → decision → reason → **Record review and re-evaluate**. Watch the FINALIZE permit change.
6. **Finalize server note** → the Gateway stays closed and the server gives its reason.
7. **Create isolated experiment** (magenta) → **Mask in experiment** on one excerpt → only the dependent arches change colour → **Reset all excerpts** → Finalize is refused (403).
8. Back to a new mission: **Load real export · Work from home** → Create → Analyze. Show BIAS CONCERN, Accuracy "Not scored" treated as not evaluated, one SUPPORTED claim and four UNVERIFIABLE ones.
9. Human review as "Communication lead" → **Accept the qualified rewrite** → FINALIZE moves from NEEDS_HUMAN to SUSPENDED: judgment was recorded, but missing evidence is still missing.
10. **Export** → labelled "DRAFT WITH RESERVATIONS — NOT FINAL" or "QUESTION FOR HUMAN REVIEW — NOT FINAL".

## Script (≈90 s, English)

> AI answers come with trust reports. PLOT TWIST turns a report into permission. The LLM proposes; the code authorizes.
>
> Here's a real Ezio export on the 2024 EV market, to be used in a client note. Scout reads it in the Trame. Each arch is an action with a server permit. Each crystal is an exact excerpt from the report.
>
> Ezio's Geely flag is inconsistent: the contested figure and the cited figure are identical. We keep the original verdict and ask a human to check entity, year and scope. The Top 3 ranking is unverified, not false. Four out of five on accuracy is not an 80 % chance of truth.
>
> Now live research: Keenable searches, fetches two pages, and the model must quote the page. The server checks that the quote is really there and that the year matches. A source is a candidate, never automatic proof. A contradiction escalates.
>
> The analyst answers the precise question. That is judgment, not evidence, and the permits are re-evaluated. The Gateway re-checks the exact note on the server, so it stays closed while reservations remain.
>
> In a magenta experiment, I mask one excerpt: only the actions depending on it suspend. Reset. Experiments can never finalize.
>
> Second report, an article on remote work for publication as a balanced analysis. Accuracy "Not scored" means not evaluated, never zero. Bias is critical, so editorial revision and a targeted review are needed. That doesn't make the claims false. The communication lead accepts a qualified rewrite: the permit moves from human review to suspended, because missing evidence is still missing.
>
> Same engine, different reasons, different actions. Evidence before permission. Permission before action.
