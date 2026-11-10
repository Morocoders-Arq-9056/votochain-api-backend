import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateCollectionCommand, DescribeCollectionCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { AWS_REKOGNITION_CLIENT } from "./aws-rekognition.tokens.js";

/**
 * Ensures the Rekognition face collection exists at boot. Idempotent across
 * replicas: concurrent `CreateCollection` calls resolve with
 * `ResourceAlreadyExistsException`, which is swallowed.
 */
@Injectable()
export class RekognitionFaceCollectionService implements OnModuleInit {
  private readonly logger = new Logger(RekognitionFaceCollectionService.name);

  constructor(
    @Inject(AWS_REKOGNITION_CLIENT) private readonly rekognition: RekognitionClient,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const collectionId = this.config.get<string>('aws.rekognition.collectionId', 'votachain-biometric');
    try {
      await this.rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      this.logger.log(`face collection ${collectionId} present`);
      return;
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
    await this.rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    this.logger.log(`face collection ${collectionId} created`);
  }
}

function isNotFound(e: unknown): boolean {
  return e instanceof Error && e.name === 'ResourceNotFoundException';
}
