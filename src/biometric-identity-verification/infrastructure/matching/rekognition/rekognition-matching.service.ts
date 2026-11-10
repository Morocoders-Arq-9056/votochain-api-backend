import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteFacesCommand, RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import type { FaceCapture, FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";
import { AWS_REKOGNITION_CLIENT } from "./aws-rekognition.tokens.js";

/**
 * AWS Rekognition face matcher. Reports the similarity score (0..1); the BC
 * judges it against its own `FACE_MATCH_THRESHOLD` — the bar never leaves
 * this context (D4). Selected via `FACE_MATCHER=rekognition`.
 *
 * The vendor-side `FaceMatchThreshold` is only a pre-filter; the authoritative
 * comparison happens in `BiometricCommandServiceImpl.recordVerdict`.
 */
@Injectable()
export class RekognitionMatchingService implements FaceMatchingService {
  private readonly logger = new Logger(RekognitionMatchingService.name);

  constructor(
    @Inject(AWS_REKOGNITION_CLIENT) private readonly rekognition: RekognitionClient,
    private readonly config: ConfigService,
  ) {}

  async observeSimilarity(capture: FaceCapture): Promise<{ score: number }> {
    if (!capture.selfie || capture.selfie.length === 0) {
      throw new Error('face capture required: no selfie bytes (ingestion lands in Sprint-05)');
    }
    const collectionId = this.config.get<string>('aws.rekognition.collectionId', 'votachain-biometric');
    const floor = this.config.get<number>('biometric.matchThreshold', 0.82);
    const res = await this.rekognition.send(new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { Bytes: capture.selfie },
      MaxFaces: 1,
      FaceMatchThreshold: Math.max(0, Math.min(100, floor * 100)),
    }));
    const similarity = res.FaceMatches?.[0]?.Similarity ?? 0;
    const score = similarity / 100;
    this.logger.debug(`rekognition similarity=${similarity} score=${score} for ${capture.attemptId}`);
    return { score };
  }

  async forget(reference: string): Promise<void> {
    const collectionId = this.config.get<string>('aws.rekognition.collectionId', 'votachain-biometric');
    await this.rekognition.send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: [reference] }));
    this.logger.debug(`rekognition forgot ${reference}`);
  }
}
