import type PDFDocument from 'pdfkit';
import {
  PDF_MARGIN, CONTENT_WIDTH,
  BRAND_COLOR, TEXT_DARK, TEXT_MID, TEXT_MUTED,
  BG_LIGHT, BORDER_LIGHT,
  FONT_REGULAR, FONT_BOLD,
} from './pdf-base';
import { formatCurrency } from '../utils/currency.utils';
import type { PDFLineItem } from './pdf.types';

// ─── Column layout ────────────────────────────────────────────────────────────
// Matches the colWidths in the existing pdfService.ts exactly.

const COL_WIDTHS = {
  num:   20,
  desc:  150,
  hsn:   60,
  qty:   35,
  price: 70,
  tax:   35,
  total: 75,
} as const;

function buildColX() {
  let x = PDF_MARGIN;
  const cols = {} as Record<keyof typeof COL_WIDTHS, number>;
  for (const [key, w] of Object.entries(COL_WIDTHS) as [keyof typeof COL_WIDTHS, number][]) {
    cols[key] = x;
    x += w;
  }
  return cols;
}

const COL_X = buildColX();
const ROW_H = 22;
const HEADER_H = 20;

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Renders the line items table onto the PDF document.
 *
 * Matches the existing table rendering in pdfService.ts:
 *   - Blue header row with white text
 *   - Alternating light background on odd rows
 *   - Right-aligned qty, price, tax%, total columns
 *   - Thin divider after each row
 *
 * @returns Y position after the last row (before tax summary)
 */
export function renderLineItems(
  doc: InstanceType<typeof PDFDocument>,
  startY: number,
  items: PDFLineItem[],
  currency: string,
  country: string,
): number {
  const fmt = (n: number) => formatCurrency(n, currency, country);

  // ── Table header ────────────────────────────────────────────────────────────
  doc.rect(PDF_MARGIN, startY, CONTENT_WIDTH, HEADER_H).fill(BRAND_COLOR);

  doc.fontSize(7).font(FONT_BOLD).fillColor('#ffffff');
  doc.text('#',           COL_X.num,   startY + 7);
  doc.text('Description', COL_X.desc,  startY + 7, { width: COL_WIDTHS.desc });
  doc.text('HSN/SAC',     COL_X.hsn,   startY + 7, { width: COL_WIDTHS.hsn });
  doc.text('Qty',         COL_X.qty,   startY + 7, { width: COL_WIDTHS.qty,   align: 'right' });
  doc.text('Unit Price',  COL_X.price, startY + 7, { width: COL_WIDTHS.price, align: 'right' });
  doc.text('Tax%',        COL_X.tax,   startY + 7, { width: COL_WIDTHS.tax,   align: 'right' });
  doc.text('Total',       COL_X.total, startY + 7, { width: COL_WIDTHS.total, align: 'right' });

  // ── Rows ────────────────────────────────────────────────────────────────────
  let rowY = startY + HEADER_H;

  for (const item of items) {
    // Alternating background (0-indexed: even rows = white, odd = light)
    if (item.index % 2 === 0) {
      doc.rect(PDF_MARGIN, rowY, CONTENT_WIDTH, ROW_H).fill(BG_LIGHT);
    }

    doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MID);
    doc.text(String(item.index), COL_X.num,  rowY + 7);
    doc.text(item.description,   COL_X.desc, rowY + 7, { width: COL_WIDTHS.desc });
    doc.text(item.hsn_sac || '—', COL_X.hsn, rowY + 7, { width: COL_WIDTHS.hsn });

    doc.fillColor(TEXT_MUTED);
    doc.text(String(item.quantity),        COL_X.qty,   rowY + 7, { width: COL_WIDTHS.qty,   align: 'right' });
    doc.text(fmt(item.unit_price),         COL_X.price, rowY + 7, { width: COL_WIDTHS.price, align: 'right' });
    doc.text(`${item.tax_percent}%`,       COL_X.tax,   rowY + 7, { width: COL_WIDTHS.tax,   align: 'right' });

    doc.font(FONT_BOLD).fillColor(TEXT_DARK);
    doc.text(fmt(item.line_total),         COL_X.total, rowY + 7, { width: COL_WIDTHS.total, align: 'right' });

    // Row divider
    doc.rect(PDF_MARGIN, rowY + ROW_H, CONTENT_WIDTH, 0.5).fill(BORDER_LIGHT);

    rowY += ROW_H;
  }

  return rowY;
}
