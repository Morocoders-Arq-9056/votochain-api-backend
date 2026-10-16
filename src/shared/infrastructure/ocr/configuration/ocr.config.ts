import { registerAs } from '@nestjs/config';

/**
 * Document OCR & Face Match Provider configuration (Sprint-03).
 * Declares the examination window and the interchangeable executor
 * selector consumed by the module factory (`OCR_EXECUTOR`).
 */
export default registerAs('ocr', () => ({
  ttlMinutes: parseInt(process.env['OCR_TTL_MINUTES'] ?? '30', 10),
  executor: process.env['OCR_EXECUTOR'] ?? 'rekognition',
}));
