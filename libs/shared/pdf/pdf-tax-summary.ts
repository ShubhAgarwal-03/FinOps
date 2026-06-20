import type PDFDocument from 'pdfkit';
import {
  PDF_MARGIN, CONTENT_WIDTH,
  TEXT_DARK, TEXT_MUTED, TEXT_SUBTLE,
  BG_LIGHT, BORDER_COLOR,
  FONT_REGULAR, FONT_BOLD,
} from './pdf-base';
import { formatCurrency } from '../utils/currency.utils';
import { numberToWords } from '../utils/currency.utils';
import type { PDFTaxRow, PDFTotalsBlock } from './pdf.types';

const BLOCK_H = 60;

/**
 * Renders the tax breakdown box (left) and totals (right), plus the
 * "Amount in Words" band below them.
 *
 * Matches the existing pdfService.ts layout exactly:
 *   Left half:  'TAX BREAKDOWN' label + IGST / CGST+SGST rows
 *   Right half: Subtotal, Discount (if any), Tax, Grand Total
 *   Full width: Amount in Words band (blue tint background)
 *
 * @returns Y position after the amount-in-words band
 */
export function renderTaxSummary(
  doc: InstanceType<typeof PDFDocument>,
  startY: number,
  taxRows: PDFTaxRow[],
  totals: PDFTotalsBlock,
): number {
  const fmt = (n: number) => formatCurrency(n, totals.currency, totals.country);
  const HALF_W = CONTENT_WIDTH / 2;
  const totY = startY + 16;

  // ── Left: Tax breakdown box ────────────────────────────────────────────────
  doc.rect(PDF_MARGIN, totY, HALF_W, BLOCK_H).fill(BG_LIGHT);

  doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
    .text('TAX BREAKDOWN', PDF_MARGIN + 8, totY + 8);

  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
  let taxRowY = totY + 20;
  for (const row of taxRows) {
    doc.text(`${row.label}: ${fmt(row.amount)}`, PDF_MARGIN + 8, taxRowY);
    taxRowY += 12;
  }

  // ── Right: Totals ──────────────────────────────────────────────────────────
  const totX = PDF_MARGIN + HALF_W + 10;
  const totW = HALF_W - 10;
  const LABEL_W = totW - 70;

  let tY = totY;

  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);

  // Subtotal
  doc.text('Subtotal', totX, tY, { width: LABEL_W });
  doc.text(fmt(totals.subtotal), totX + LABEL_W, tY, { width: 70, align: 'right' });
  tY += 14;

  // Discount (only render if non-zero)
  if (totals.discount_amount && totals.discount_amount > 0) {
    const discLabel = totals.discount_percent
      ? `Discount (${totals.discount_percent}%)`
      : 'Discount';
    doc.text(discLabel, totX, tY, { width: LABEL_W });
    doc.text(`-${fmt(totals.discount_amount)}`, totX + LABEL_W, tY, { width: 70, align: 'right' });
    tY += 14;
  }

  // Tax total
  doc.text('Tax', totX, tY, { width: LABEL_W });
  doc.text(fmt(totals.tax_total), totX + LABEL_W, tY, { width: 70, align: 'right' });
  tY += 14;

  // Divider above grand total
  doc.rect(totX, tY, totW, 0.5).fill(BORDER_COLOR);
  tY += 6;

  // Grand total
  doc.fontSize(10).font(FONT_BOLD).fillColor(TEXT_DARK);
  doc.text('Grand Total', totX, tY, { width: LABEL_W });
  doc.text(fmt(totals.grand_total), totX + LABEL_W, tY, { width: 70, align: 'right' });

  // ── Amount in Words band ───────────────────────────────────────────────────
  const wordsY = tY + 30;
  doc.rect(PDF_MARGIN, wordsY, CONTENT_WIDTH, 24).fill('#eff6ff');

  doc.fontSize(7).font(FONT_BOLD).fillColor('#2563eb')
    .text('Amount in Words:', PDF_MARGIN + 8, wordsY + 4);

  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_DARK)
    .text(numberToWords(totals.grand_total), PDF_MARGIN + 8, wordsY + 14, {
      width: CONTENT_WIDTH - 16,
    });

  return wordsY + 36;
}
