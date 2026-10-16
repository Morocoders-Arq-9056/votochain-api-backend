/**
 * Technology port: judges whether the presented face matches the reference.
 * A vendor reports a score; THIS context judges the boolean against its own
 * `FACE_MATCH_THRESHOLD` — the threshold never leaves the BC (D4).
 */
export const MATCHING_PORT = Symbol('MATCHING_PORT');

export interface FaceMatchingService {
  /**
   * Judges the match for the attempt's comparison, returning a boolean.
   * @param attemptId Attempt whose comparison is being judged.
   */
  judgesMatch(attemptId: string): Promise<boolean>;
}
