import "server-only";
import * as pdfkit from "pdfkit";
import Helvetica from "pdfkit/standard-fonts/Helvetica";
import HelveticaBold from "pdfkit/standard-fonts/HelveticaBold";
import HelveticaOblique from "pdfkit/standard-fonts/HelveticaOblique";

const PDFDocument = pdfkit.default;

// On Cloudflare the self-contained (browser) build of pdfkit is used — it has no
// file system, so the three fonts we use are registered from bundled data.
// The Node build reads them from disk itself and has no registerStdFonts.
const registerStdFonts = (pdfkit as unknown as { registerStdFonts?: (...f: unknown[]) => void }).registerStdFonts;
registerStdFonts?.(Helvetica, HelveticaBold, HelveticaOblique);

export const COMPANY_LINE = "[LBH ZIMBABWE ENTITY NAME · REG NUMBER]";

const FOREST = "#163A2B";
const ACCENT = "#0A0A0A";
const INK = "#1B1F1C";
const MUTED = "#5E6862";

export type Doc = InstanceType<typeof PDFDocument>;

export function renderPdf(build: (doc: Doc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

export function pdfHeader(doc: Doc, subtitle: string) {
  doc
    .fillColor(FOREST)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("LBH — Let's Build Home", { continued: false });
  doc
    .fillColor(ACCENT)
    .fontSize(10)
    .font("Helvetica-Oblique")
    .text("Build back home — without being there.");
  doc.moveDown(0.3);
  doc
    .strokeColor(ACCENT)
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor(FOREST).font("Helvetica-Bold").fontSize(15).text(subtitle);
  doc.moveDown(0.5);
  doc.fillColor(INK).font("Helvetica").fontSize(10);
}

export function pdfFooter(doc: Doc, extra?: string) {
  doc.moveDown(1.2);
  doc
    .strokeColor("#CFCBC0")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.4);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8);
  doc.text(COMPANY_LINE);
  if (extra) doc.text(extra);
  doc.text("You can't be there. We can.");
}

export function kv(doc: Doc, key: string, value: string) {
  doc.font("Helvetica-Bold").fillColor(MUTED).text(`${key}: `, { continued: true });
  doc.font("Helvetica").fillColor(INK).text(value);
}
