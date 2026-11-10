import type { AnalyzeResult } from '@azure/ai-form-recognizer';

export interface ParsedDocument {
  readonly readable: boolean;
  readonly reason: string | null;
  readonly documentNumber: string | null;
  readonly rawTextLength: number;
  readonly averageWordConfidence: number;
}

/**
 * Parses `prebuilt-read` result into the closed UnreadableReason set.
 * Peruvian DNI/CE oriented: DNI 8 digits (often with 10-digit FMR), CE
 * alphanumeric. No new reasons invented — nearest of the 5.
 */
export class DniFieldParser {
  private static readonly DNI_NUMBER = /\b(\d{8})\b/;
  private static readonly FMR_CODE = /\b(\d{10})\b/;
  private static readonly CE_NUMBER = /\b([A-Z]\d{7,8}[A-Z]?)\b/;

  parse(documentType: string | undefined, analysis: AnalyzeResult): ParsedDocument {
    const content = (analysis as unknown as { content?: string }).content ?? '';
    const pages = (analysis as unknown as { pages?: Array<{ words?: Array<{ content: string; confidence: number }> }> }).pages ?? [];
    const words: Array<{ content: string; confidence: number }> = pages.flatMap((p) => p.words ?? []);
    const rawTextLength = content.length;
    const avgConfidence = words.length > 0 ? words.reduce((s, w) => s + (w.confidence ?? 0), 0) / words.length : 0;
    const wordCount = words.length;

    // Text too sparse → BLURRY
    if (wordCount < 8 || rawTextLength < 20 || avgConfidence < 0.55) {
      return { readable: false, reason: 'BLURRY', documentNumber: null, rawTextLength, averageWordConfidence: avgConfidence };
    }
    if (avgConfidence < 0.75) {
      // Low but not catastrophic → still BLURRY (GLARE is inferred the same way without image quality)
      return { readable: false, reason: 'BLURRY', documentNumber: null, rawTextLength, averageWordConfidence: avgConfidence };
    }

    let documentNumber: string | null = null;
    const type = (documentType ?? 'DNI').toUpperCase();
    if (type === 'DNI') {
      const m = content.match(DniFieldParser.DNI_NUMBER) ?? content.match(DniFieldParser.FMR_CODE);
      documentNumber = m ? m[1].slice(-8) : null;
    } else if (type === 'CE' || type === 'PASSPORT') {
      const m = content.match(DniFieldParser.CE_NUMBER);
      documentNumber = m ? m[1] : null;
    } else {
      const m = content.match(DniFieldParser.DNI_NUMBER);
      documentNumber = m ? m[1] : null;
    }

    if (!documentNumber) {
      return { readable: false, reason: 'MISMATCHED_TYPE', documentNumber: null, rawTextLength, averageWordConfidence: avgConfidence };
    }

    // Expiry check would require parsing a date — out of scope for prebuilt-read MVP.
    // Caller maps EXPIRY when a dedicated date field is available.

    return { readable: true, reason: null, documentNumber, rawTextLength, averageWordConfidence: avgConfidence };
  }
}
