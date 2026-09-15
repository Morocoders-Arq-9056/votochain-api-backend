export interface ProofVerificationService { 
  holds(offeredProof: string): Promise<boolean>;
}
export const PROOF_VERIFICATION_SERVICE = Symbol('PROOF_VERIFICATION_SERVICE');
