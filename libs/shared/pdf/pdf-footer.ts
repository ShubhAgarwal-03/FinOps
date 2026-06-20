import type PDFDocument from 'pdfkit';
import {
  PDF_MARGIN, CONTENT_WIDTH,
  TEXT_MUTED, TEXT_SUBTLE,
  FONT_REGULAR, FONT_BOLD,
} from './pdf-base';
import type { CompanySnapshot } from './pdf.types';

/**
 * Renders bank details, notes, terms & conditions, and the authorized
 * signatory block at the bottom of the page.
 *
 * Matches the existing footer section in pdfService.ts.
 * The page chrome (blue footer bar) is already drawn by drawPageChrome()
 * in pdf-header.ts — this function sits above it.
 */
export function renderFooter(
  doc: InstanceType<typeof PDFDocument>,
  startY: number,
  company: CompanySnapshot,
  notes?: string,
  terms?: string,
): void {
  let y = startY;

  // ── Bank details ───────────────────────────────────────────────────────────
  if (company.bank_name || company.account_number) {
    doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
      .text('BANK DETAILS', PDF_MARGIN, y);
    y += 12;

    doc.fontSize(8).font(FONT_REGULAR).fillColor(TEXT_MUTED);
    if (company.bank_name)      { doc.text(`Bank: ${company.bank_name}`,         PDF_MARGIN, y); y += 11; }
    if (company.account_number) { doc.text(`Account No: ${company.account_number}`, PDF_MARGIN, y); y += 11; }
    if (company.ifsc_code)      { doc.text(`IFSC: ${company.ifsc_code}`,         PDF_MARGIN, y); y += 11; }
    if (company.branch)         { doc.text(`Branch: ${company.branch}`,          PDF_MARGIN, y); y += 11; }

    y += 8; // spacing after bank block
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (notes?.trim()) {
    doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
      .text('NOTES', PDF_MARGIN, y);
    y += 12;

    doc.fontSize(8).font(FONT_REGULAR).fillColor('#475569')
      .text(notes, PDF_MARGIN, y, { width: CONTENT_WIDTH });
    y += 20;
  }

  // ── Terms & Conditions ─────────────────────────────────────────────────────
  if (terms?.trim()) {
    doc.fontSize(7).font(FONT_BOLD).fillColor(TEXT_SUBTLE)
      .text('TERMS & CONDITIONS', PDF_MARGIN, y);
    y += 12;

    doc.fontSize(7).font(FONT_REGULAR).fillColor(TEXT_MUTED)
      .text(terms, PDF_MARGIN, y, { width: CONTENT_WIDTH });
    y += 20;
  }

  // ── Authorized signatory ───────────────────────────────────────────────────
  // Fixed position: 100pt above bottom of page, right-aligned
  const sigY = doc.page.height - 100;
  const sigX = 355;
  const sigW = 200;

  doc
    .moveTo(sigX, sigY)
    .lineTo(sigX + sigW, sigY)
    .strokeColor('#94a3b8')
    .lineWidth(0.5)
    .stroke();

  doc.fontSize(8).font(FONT_BOLD).fillColor(TEXT_MUTED)
    .text('Authorized Signatory', sigX, sigY + 6, { width: sigW, align: 'center' });

  doc.fontSize(7).font(FONT_REGULAR).fillColor(TEXT_SUBTLE)
    .text(company.name ?? '', sigX, sigY + 18, { width: sigW, align: 'center' });
}
