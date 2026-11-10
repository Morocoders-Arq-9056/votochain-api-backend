/**
 * DI token for the shared AWS Rekognition client (one per process; the SDK
 * manages its own connection pooling). The region comes from `aws.region`.
 */
export const AWS_REKOGNITION_CLIENT = Symbol('AWS_REKOGNITION_CLIENT');
