/**
 * Value object representing the kind of proof used to sign in.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export const ProofKind = { LOCAL: 'LOCAL', OUTSIDE: 'OUTSIDE' } as const;
export type ProofKind = typeof ProofKind[keyof typeof ProofKind];

/**
 * Parses a string value into a ProofKind.
 * @param v The string value to parse.
 * @returns The corresponding ProofKind if valid.
 * @throws An error if the provided value is not a valid ProofKind.
 */
export function parseProofKind(v: string): ProofKind {
  if (!(Object.values(ProofKind) as string[]).includes(v)) throw new Error(`invalid proof kind: ${v}`);
  return v as ProofKind;
}