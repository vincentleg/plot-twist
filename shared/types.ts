// PLOT TWIST internal types. This is not an official Ezio schema.
export type ClaimStatus = 'UNASSESSED' | 'SUPPORTED' | 'DISPUTED' | 'UNVERIFIABLE';
export type EvidenceState = 'UNVERIFIED' | 'VERIFIED' | 'MISSING' | 'MASKED';
export type PermitStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'NEEDS_HUMAN';
export interface Claim { id: string; text: string; status: ClaimStatus; evidenceIds: string[] }
export interface Evidence { id: string; text: string; source?: string; state: EvidenceState }
export interface Permit { status: PermitStatus; reason: string; evaluatedAt: string }
export interface Action { id: string; kind: 'CORRECT' | 'RESEARCH' | 'APPROVE' | 'BLOCK' | 'REQUEST_HUMAN' | 'FINALIZE'; evidenceIds: string[]; permit: Permit | null }
export interface Event { id: string; at: string; type: 'MISSION_IMPORTED' | 'EXPERIMENT_CREATED' | 'FINALIZATION_DENIED'; message: string }
export interface Mission {
  id: string; mode: 'REAL' | 'EXPERIMENT'; sourceMissionId?: string;
  originalReport: string; intendedUse: string; importedAt: string;
  analysisStatus: 'NOT_AVAILABLE'; claims: Claim[]; evidence: Evidence[]; actions: Action[];
  gateway: { state: 'CLOSED'; reason: string }; events: Event[];
}
