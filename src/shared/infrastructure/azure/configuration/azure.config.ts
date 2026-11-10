import { registerAs } from '@nestjs/config';

export default registerAs('azure', () => ({
  documentIntelligence: {
    endpoint: process.env['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'] ?? '',
    key: process.env['AZURE_DOCUMENT_INTELLIGENCE_KEY'] ?? '',
    model: process.env['AZURE_DOCUMENT_INTELLIGENCE_MODEL'] ?? 'prebuilt-read',
  },
}));
