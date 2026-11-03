import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";

export const FONT = "Arial";
const MARGIN_LEFT = 1134; // 2 см: поле під підшивання
const MARGIN_OTHER = 567;
export const PAGE = {
  size: { width: 11907, height: 16839 },
  margin: { top: MARGIN_OTHER, right: MARGIN_OTHER, bottom: MARGIN_OTHER, left: MARGIN_LEFT },
};
const CONTENT_WIDTH = 11907 - MARGIN_LEFT - MARGIN_OTHER;

export function run(text: string, size: number, bold = false): TextRun {
  return new TextRun({ text, font: FONT, size, bold });
}

export function para(
  children: ParagraphChild[] | string,
  opts: { size?: number; bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {},
): Paragraph {
  const kids = typeof children === "string" ? [run(children, opts.size ?? 22, opts.bold)] : children;
  return new Paragraph({
    children: kids,
    alignment: opts.align,
    spacing: { after: opts.after ?? 60, before: opts.before ?? 0 },
  });
}

const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: line, bottom: line, left: line, right: line };

export function cell(
  text: string,
  width: number,
  size: number,
  opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: text.split("\n").map((t) => new Paragraph({ children: [run(t, size, opts.bold)], alignment: opts.align, spacing: { after: 0 } })),
  });
}

export function table(widths: number[], rows: TableRow[]): Table {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    rows,
  });
}

export function scaleWidths(ratios: number[], total = CONTENT_WIDTH): number[] {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const w = ratios.map((r) => Math.floor((r / sum) * total));
  w[w.length - 1] = total - w.slice(0, -1).reduce((a, b) => a + b, 0);
  return w;
}
