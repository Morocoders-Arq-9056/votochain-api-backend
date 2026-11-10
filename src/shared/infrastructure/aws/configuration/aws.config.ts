import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env['AWS_REGION'] ?? 'us-east-1',
  rekognition: { collectionId: process.env['AWS_REKOGNITION_COLLECTION_ID'] ?? 'votachain-biometric' },
}));