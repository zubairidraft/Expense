import { describe, it, expect } from 'vitest';
import {
  parseRawReceiptText,
  generateDraftFromReceipt,
  AttachmentCreateSchema,
} from '../src/index.js';

describe('Phase 10: Receipts, Attachments & OCR', () => {
  const sampleReceiptText = `
    CARREFOUR HYPERMARKET
    Branch: Mall of Emirates
    Date: 2026-10-04
    Tel: +971 4 1234567

    Organic Milk          12.50
    Greek Yogurt           8.00
    Sourdough Bread        6.50
    Subtotal              27.00
    VAT (5%)               1.35
    Total Due             28.35 AED
    Payment Method: VISA **** 4022
  `;

  it('correctly parses merchant, date, currency, tax and total from receipt text', () => {
    const extracted = parseRawReceiptText(sampleReceiptText);

    expect(extracted.merchantName).toBe('CARREFOUR HYPERMARKET');
    expect(extracted.date).toBe('2026-10-04');
    expect(extracted.currency).toBe('AED');
    expect(extracted.totalAmount).toBe('28.35');
    expect(extracted.taxAmount).toBe('1.35');
    expect(extracted.confidence).toBeGreaterThan(0.7);
  });

  it('generates an uncommitted draft transaction requiring user confirmation', () => {
    const extracted = parseRawReceiptText(sampleReceiptText);
    const draft = generateDraftFromReceipt(extracted, {
      defaultCurrency: 'USD',
      attachmentId: 'att-1234',
    });

    expect(draft.status).toBe('draft');
    expect(draft.type).toBe('expense');
    expect(draft.totalAmount).toBe('28.35');
    expect(draft.currency).toBe('AED');
    expect(draft.attachmentId).toBe('att-1234');
    expect(draft.merchantName).toBe('CARREFOUR HYPERMARKET');
  });

  it('validates attachment creation payload with Zod schema', () => {
    const validPayload = {
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      filePath: 'receipts/ws-1/2026-10-04-receipt.jpg',
      fileName: 'carrefour-receipt.jpg',
      fileSize: 204850,
      mimeType: 'image/jpeg',
      ocrStatus: 'completed',
      ocrRawText: sampleReceiptText,
      ocrExtractedData: {
        merchantName: 'CARREFOUR HYPERMARKET',
        totalAmount: '28.35',
        currency: 'AED',
        date: '2026-10-04',
        confidence: 0.95,
      },
    };

    const parsed = AttachmentCreateSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });
});
