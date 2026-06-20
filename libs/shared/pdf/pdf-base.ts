import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

// ─── Layout constants ─────────────────────────────────────────────────────────
// These match the hardcoded values in the existing pdfService.ts exactly.

export const PDF_MARGIN   = 40;
export const PAGE_WIDTH_PT = 595;                             // A4 points
export const CONTENT_WIDTH = PAGE_WIDTH_PT - PDF_MARGIN * 2; // 515

export const BRAND_COLOR   = '#2563eb';
export const TEXT_DARK     = '#1e293b';
export const TEXT_MID      = '#475569';
export const TEXT_MUTED    = '#64748b';
export const TEXT_SUBTLE   = '#94a3b8';
export const BG_LIGHT      = '#f8fafc';
export const BG_BLUE_TINT  = '#eff6ff';
export const BORDER_COLOR  = '#e2e8f0';
export const BORDER_LIGHT  = '#f1f5f9';

// ─── Font aliases ─────────────────────────────────────────────────────────────

export const FONT_REGULAR = 'Helvetica';
export const FONT_BOLD    = 'Helvetica-Bold';

// ─── Document factory ─────────────────────────────────────────────────────────

/**
 * Creates a new PDFDocument with the standard A4 margins.
 * All PDF generators (AR invoice, PO, GRN) call this to get a consistent
 * base document instead of each setting up their own PDFDocument.
 */
export function createPDFDocument(): InstanceType<typeof PDFDocument> {
  return new PDFDocument({ margin: PDF_MARGIN, size: 'A4' });
}

/**
 * Pipes a PDFDocument to a PassThrough stream and resolves to a Buffer.
 * Matches the existing Promise<Buffer> pattern in pdfService.ts.
 *
 * Usage:
 *   const doc = createPDFDocument();
 *   // ... render content onto doc ...
 *   const buffer = await collectPDFBuffer(doc);
 */
export function collectPDFBuffer(
  doc: InstanceType<typeof PDFDocument>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data',  (chunk: Buffer) => chunks.push(chunk));
    stream.on('end',   ()              => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);
  });
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

/**
 * Draws a full-width horizontal rule at the given Y position.
 */
export function drawHRule(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  color: string = BORDER_COLOR,
): void {
  doc.rect(PDF_MARGIN, y, CONTENT_WIDTH, 0.5).fill(color);
}

/**
 * Draws the brand colour bar at the top of the page (6px strip).
 * Also draws the matching footer bar at the bottom.
 * Call once per page.
 */
export function drawPageChrome(doc: InstanceType<typeof PDFDocument>): void {
  const pageH = doc.page.height;
  // Top bar
  doc.rect(0, 0, PAGE_WIDTH_PT, 6).fill(BRAND_COLOR);
  // Bottom bar
  doc.rect(0, pageH - 6, PAGE_WIDTH_PT, 6).fill(BRAND_COLOR);
}

/**
 * Draws a filled rectangle background.
 */
export function drawBackground(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  color: string = BG_LIGHT,
): void {
  doc.rect(x, y, w, h).fill(color);
}
