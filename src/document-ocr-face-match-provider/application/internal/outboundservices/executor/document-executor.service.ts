/**
 * Technology port: observes the document verdict from an interchangeable
 * executor (Rekognition / GDocAI). The domain never imports vendors — it
 * only observes the judgments `{readable, reason}` / `{holds}`.
 */
export const EXECUTOR_PORT = Symbol('EXECUTOR_PORT');

export interface DocumentExecutorService {
  /**
   * Observes whether the document could be read; when not, a closed reason.
   * @param examinationId Examination whose evidence is being judged.
   */
  observeExtraction(examinationId: string): Promise<{ readable: boolean; reason: string | null }>;

  /**
   * Observes whether the presented face holds against the document portrait.
   * @param examinationId Examination whose evidence is being judged.
   */
  observeComparison(examinationId: string): Promise<{ holds: boolean }>;
}
