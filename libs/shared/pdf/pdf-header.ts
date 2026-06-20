import type PDFDocument from 'pdfkit';
import {
  PDF_MARGIN, CONTENT_WIDTH,
  BRAND_COLOR, TEXT_DARK, TEXT_MUTED,
  FONT_REGULAR, FONT_BOLD,
  drawPageChrome,
} from './pdf-base';
import type { CompanySnapshot, PDFDocumentHeader } from './pdf.types';

/**
 * Renders the page chrome + company header (left) + document meta (right).
 *
 * Matches the existing pdfService.ts layout:
 *   Left:  company name, address, email, phone, GSTIN, PAN
 *   Right: document type label, number, status badge, dates, currency
 *
 * Returns the Y position immediately after the header block so the
 * caller knows where to start the next section.
 */
export function renderHeader(
  doc: InstanceType<typeof PDFDocument>,
  company: CompanySnapshot,
  header: PDFDocumentHeader,
): number {
  drawPageChrome(doc);

  const STATUS_COLORS: Record<string, string> = {
    draft:    '#64748b',
    sent:     '#1d4ed8',
    paid:     '#15803d',
    issued:   '#1d4ed8',
    approved: '#15803d',
    rejected: '#dc2626',
    matched:  '#15803d',
    mismatch: '#dc2626',
    pending:  '#d97706',
    partial:  '#d97706',
  };

  // ── Company block (left) ────────────────────────────────────────────────────
  let leftY = 30;

  doc.fontSize(16).font(FONT_BOLD).fillColor(TEXT_DARK)
    .text(company.name ?? 'Your Company', PDF_MARGIN, leftY);
  leftY += 22;

  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
  if (company.address)        { doc.text(company.address,              PDF_MARGIN, leftY); leftY += 12; }
  if (company.email)          { doc.text(company.email,                PDF_MARGIN, leftY); leftY += 12; }
  if (company.phone)          { doc.text(company.phone,                PDF_MARGIN, leftY); leftY += 12; }
  if (company.gstin)          { doc.text(`GSTIN: ${company.gstin}`,    PDF_MARGIN, leftY); leftY += 12; }
  if (company.pan)            { doc.text(`PAN: ${company.pan}`,        PDF_MARGIN, leftY); leftY += 12; }

  // ── Document meta (right) ───────────────────────────────────────────────────
  const RIGHT_X = 300;
  const RIGHT_W = 255;

  doc.fontSize(22).font(FONT_BOLD).fillColor(BRAND_COLOR)
    .text(header.document_type, RIGHT_X, 30, { width: RIGHT_W, align: 'right' });

  doc.fontSize(11).font(FONT_BOLD).fillColor(TEXT_DARK)
    .text(header.document_number, RIGHT_X, 58, { width: RIGHT_W, align: 'right' });

  if (header.status) {
    const statusColor = STATUS_COLORS[header.status.toLowerCase()] ?? TEXT_MUTED;
    doc.fontSize(8).font(FONT_REGULAR).fillColor(statusColor)
      .text(header.status.toUpperCase(), RIGHT_X, 74, { width: RIGHT_W, align: 'right' });
  }

  let metaY = header.status ? 90 : 74;
  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
  doc.text(`Issue Date: ${header.issue_date}`, RIGHT_X, metaY, { width: RIGHT_W, align: 'right' });
  metaY += 12;

  if (header.due_date) {
    doc.text(`Due Date: ${header.due_date}`, RIGHT_X, metaY, { width: RIGHT_W, align: 'right' });
    metaY += 12;
  }

  doc.text(`Currency: ${header.currency}`, RIGHT_X, metaY, { width: RIGHT_W, align: 'right' });

  // Return Y after the taller of the two columns
  return Math.max(leftY + 16, 140);
}

// ─── Bill-to / party block ────────────────────────────────────────────────────

import type { PDFPartyBlock } from './pdf.types';
import { TEXT_SUBTLE, BG_LIGHT, BORDER_COLOR } from './pdf-base';

/**
 * Renders the Bill To / Ship To (or Vendor / Deliver To) two-column block.
 * Matches the existing billBoxY section in pdfService.ts.
 *
 * @param topY  — Y to draw the horizontal rule above the block
 * @returns     — Y immediately after the block (ready for table header)
 */
export function renderPartyBlock(
  doc: InstanceType<typeof PDFDocument>,
  topY: number,
  primary: PDFPartyBlock,
  secondary?: PDFPartyBlock,
): number {
  const HALF_W   = CONTENT_WIDTH / 2 - 5;
  const BOX_H    = 84;
  const INNER_X  = PDF_MARGIN + 8;

  // Divider rule
  doc.rect(PDF_MARGIN, topY, CONTENT_WIDTH, 0.5).fill(BORDER_COLOR);
  const boxY = topY + 10;

  // Primary party box (left)
  doc.rect(PDF_MARGIN, boxY, HALF_W, BOX_H).fill(BG_LIGHT);

  doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
    .text(primary.label, INNER_X, boxY + 8);

  doc.fontSize(10).font(FONT_BOLD).fillColor(TEXT_DARK)
    .text(primary.name, INNER_X, boxY + 20);

  doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
  let py = boxY + 34;
  if (primary.address) { doc.text(primary.address, INNER_X, py, { width: HALF_W - 16 }); py += 12; }
  if (primary.email)   { doc.text(primary.email,   INNER_X, py); py += 12; }
  if (primary.phone)   { doc.text(primary.phone,   INNER_X, py); py += 12; }
  if (primary.gstin)   { doc.text(`GSTIN: ${primary.gstin}`, INNER_X, py); }

  // Secondary party box (right) — optional
  const secX      = PDF_MARGIN + CONTENT_WIDTH / 2 + 5;
  const secInnerX = secX + 8;

  doc.rect(secX, boxY, HALF_W, BOX_H).fill(BG_LIGHT);

  if (secondary) {
    doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
      .text(secondary.label, secInnerX, boxY + 8);

    doc.fontSize(9).font(FONT_BOLD).fillColor(TEXT_DARK)
      .text(secondary.name, secInnerX, boxY + 20);

    doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
    let sy = boxY + 32;
    if (secondary.address) { doc.text(secondary.address, secInnerX, sy, { width: HALF_W - 16 }); sy += 12; }
    if (secondary.gstin)   { doc.text(`GSTIN: ${secondary.gstin}`, secInnerX, sy); }
  } else {
    doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_SUBTLE)
      .text('—', secInnerX, boxY + 20);
  }

  return boxY + BOX_H + 16;
}
