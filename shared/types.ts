// PLOT TWIST internal contracts, never an official Ezio schema.
export type ClaimStatus = 'UNASSESSED' | 'SUPPORTED' | 'DISPUTED' | 'UNVERIFIABLE';
export type EvidenceState = 'UNVERIFIED' | 'VERIFIED' | 'MISSING' | 'MASKED';
export type PermitStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'NEEDS_HUMAN';
export interface Claim { id: string; text: string; status: ClaimStatus; evidenceIds: string[] }
// VERIFIED means the excerpt exists in the report, not that its interpretation is true.
export interface Evidence { id: string; text: string; source?: string; state: EvidenceState }
export interface Permit { status: PermitStatus; reason: string; evaluatedAt: string; contentHash?: string }
export type ActionKind = 'CORRECT' | 'RESEARCH' | 'APPROVE' | 'BLOCK' | 'REQUEST_HUMAN' | 'FINALIZE';
export interface Action { id: string; kind: ActionKind; title: string; claimIds: string[]; evidenceIds: string[]; dependsOn: string[]; permit: Permit | null }
export interface Signal { kind: 'FACT_CHECK' | 'CITATIONS' | 'BIAS' | 'SYCOPHANCY' | 'UNCERTAINTY'; assessment: 'POSITIVE' | 'CONCERN' | 'UNKNOWN'; explanation: string; evidenceIds: string[] }
export interface Issue { id: string; description: string; severity: 'MISSING' | 'HUMAN' | 'BLOCK'; claimIds: string[]; evidenceIds: string[] }
export interface Analysis {
  claims: Claim[]; evidence: Evidence[]; signals: Signal[]; issues: Issue[]; actions: Action[];
  recommendation: 'APPROVE' | 'REWRITE' | 'RESEARCH' | 'BLOCK' | 'ESCALATE'; justification: string;
  useAssessment: { risk: 'LOW' | 'HIGH' | 'UNCLEAR'; rationale: string };
  caveats: string[]; nextQuestion: string;
}
export interface DecisionNote { content: string; contentHash: string; analyzedHash: string; revision: number }
export interface Event { id: string; at: string; type: 'MISSION_IMPORTED' | 'EXPERIMENT_CREATED' | 'FINALIZATION_DENIED' | 'ANALYSIS_STARTED' | 'ANALYSIS_COMPLETED' | 'ANALYSIS_FAILED' | 'PERMITS_EVALUATED' | 'GATEWAY_DECISION' | 'CONTENT_CHANGED' | 'RESEARCH_STARTED' | 'RESEARCH_SEARCHED' | 'RESEARCH_FETCHED' | 'RESEARCH_FAILED' | 'RESEARCH_ASSESSED' | 'REVISION_CREATED' | 'REVISION_REVIEWED' | 'HUMAN_REVIEW_RECORDED' | 'EVIDENCE_MASKED' | 'EVIDENCE_RESTORED' | 'EXPERIMENT_RESET'; message: string }
export interface Mission {
  id: string; mode: 'REAL' | 'EXPERIMENT'; sourceMissionId?: string;
  originalReport: string; intendedUse: string; importedAt: string;
  analysisStatus: 'NOT_AVAILABLE' | 'RUNNING' | 'READY' | 'FAILED'; analysisError?: string;
  research?: ResearchRun[]; humanReviews?: HumanReview[]; revisions?: Revision[];
  analysis?: Analysis; note?: DecisionNote;
  claims: Claim[]; evidence: Evidence[]; actions: Action[];
  gateway: { state: 'CLOSED' | 'OPEN'; reason: string; contentHash?: string }; events: Event[];
}

export interface ResearchResult { url: string; title: string; snippet: string; publishedAt?: string }
export interface ResearchPage { url: string; title: string; content: string; truncated: boolean; fetchedAt: string; state: 'UNVERIFIED' }
export interface ResearchRun { id: string; actionId: string; query: string; mode: 'KEYLESS_PUBLIC' | 'AUTHENTICATED'; at: string; analysisHash: string; claimIds?: string[]; claimId?: string; status: 'RUNNING' | 'COMPLETE' | 'FAILED'; results: ResearchResult[]; page?: ResearchPage; pages?: ResearchPage[]; assessments?: SourceAssessment[]; error?: string }
// Model-assessed reading of one fetched page for one claim. The quote is checked server-side against the fetched text.
// A source is never promoted to verified evidence: SUPPORTS is a candidate, CONTRADICTS escalates.
export interface SourceAssessment { claimId: string; url: string; publishedAt?: string; fetchedAt: string; stance: 'SUPPORTS' | 'CONTRADICTS' | 'INSUFFICIENT'; quote: string; quoteFound: boolean; context: { entity: boolean; period: boolean; scope: boolean }; rationale: string }
// A recorded human judgment. It can complete a REQUEST_HUMAN action or settle a HUMAN issue;
// it is never evidence and never changes a claim's status, an excerpt or a MISSING issue.
export type HumanDecision = 'ACCEPT_QUALIFIED' | 'REQUIRE_CHANGES' | 'REFUSE';
export interface HumanReview { id: string; at: string; reviewer: string; decision: HumanDecision; comment: string; actionIds: string[]; issueIds: string[]; withdrawClaimIds?: string[]; clarifiedUse?: string; question?: string; analysisHash: string; noteHash: string }
// A separate revised document limited to report-supported claims. Its permit is evaluated on its exact content.
export interface RevisionReview { at: string; reviewer: string; decision: 'ACCEPT_LIMITED_USE' | 'DECLINE'; comment: string; acceptedUse: string; contentHash: string }
export interface Revision { id: string; createdAt: string; keptClaimIds: string[]; removed: { claimId: string; text: string; status: string; reason: string }[]; proposedUse: string; content: string; contentHash: string; analysisHash: string; reviews: RevisionReview[]; permit: Permit | null; humanReasons?: string[]; finalized?: { at: string; contentHash: string } }
