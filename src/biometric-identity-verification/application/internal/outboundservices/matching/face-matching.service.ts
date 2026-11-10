/**
 * Technology port: observes face similarity; the CONTEXT judges the boolean
 * against its own `FACE_MATCH_THRESHOLD` — the bar never leaves this BC (D4).
 *
 * The vendor reports a score; the BC decides. No verdict, no threshold, no
 * image retention lives on the adapter side.
 */
export const MATCHING_PORT = Symbol('MATCHING_PORT');

/**
 * Capture handed to the matching vendor. Application-level type (never
 * domain): bytes may appear here, never in aggregates or events.
 */
export interface FaceCapture {
  /** Attempt whose comparison is being judged (observability only). */
  readonly attemptId: string;
  /**
   * Selfie bytes (JPEG/PNG). `null` until Sprint-05 ingestion lands — the
   * AWS adapter fails closed without them.
   */
  readonly selfie: Buffer | null;
}

export interface FaceMatchingService {
  /**
   * Observes the similarity between the living reference and the capture,
   * normalized 0..1. The BC compares it against `biometric.matchThreshold`.
   */
  observeSimilarity(capture: FaceCapture): Promise<{ score: number }>;

  /**
   * Forgets the living reference in the vendor (erasure, Ley 29733).
   * Idempotent: forgetting an unknown reference must not fail.
   * @param reference Opaque vendor handle (`ReferenceRef`).
   */
  forget(reference: string): Promise<void>;
}
