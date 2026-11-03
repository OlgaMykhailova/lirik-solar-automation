import { AlignmentType, Document, Packer, PageBreak, Paragraph, TableRow, TextRun, type Table } from "docx";
import { CUSTOMER, PLACE } from "../data/fop.js";
import type { DocData } from "../types.js";
import { formatKop, totalKop } from "../utils/money.js";
import { amountInWords, longDate } from "../utils/words.js";
import { FONT, PAGE, cell, para, run, scaleWidths, table } from "./shared.js";

const S = 18;

function block(data: DocData): (Paragraph | Table)[] {
  const { fop, items } = data;
  const total = totalKop(items);
  const totalText = formatKop(total);
  const w = scaleWidths([4, 48, 9, 6, 16, 17]);
  const head = ["№", "Товар", "Кіл-сть", "Од.", "Ціна без ПДВ", "Сума без ПДВ"];
  const rows = [
    new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, w[i]!, S, { bold: true, align: AlignmentType.CENTER })) }),
    ...items.map(
      (it, idx) =>
        new TableRow({
          children: [
            cell(String(idx + 1), w[0]!, S, { align: AlignmentType.CENTER }),
            cell(it.name, w[1]!, S),
            cell(String(it.qty), w[2]!, S, { align: AlignmentType.CENTER }),
            cell("шт", w[3]!, S, { align: AlignmentType.CENTER }),
            cell(formatKop(it.priceKop), w[4]!, S, { align: AlignmentType.RIGHT }),
            cell(formatKop(it.sumKop), w[5]!, S, { align: AlignmentType.RIGHT }),
          ],
        }),
    ),
  ];
  return [
    para(`Видаткова накладна № ${data.number} від ${longDate(data.date)}`, { size: 28, bold: true, after: 120 }),
    para([run("Постачальник: ", S, true), run(`ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ${fop.fullName}`, S)], { after: 20 }),
    para(`Ідентифікаційний номер ${fop.taxId}`, { size: S, after: 20 }),
    para(`п/р ${fop.iban} у банку ${fop.bank}`, { size: S, after: 40 }),
    para([run("Покупець: ", S, true), run(CUSTOMER, S)], { after: 480 }),
    table(w, rows),
    para([run(`Всього: ${totalText}`, S, true)], { align: AlignmentType.RIGHT, before: 80 }),
    para(`Всього найменувань ${items.length} шт, на ${totalText} грн.`, { size: S, before: 60, after: 0 }),
    para(`( ${amountInWords(total)} )`, { size: S, bold: true, after: 100 }),
    para(`Місце складання: ${PLACE}`, { size: S, after: 120 }),
    para(`Від постачальника* ____________________          Отримав(ла) ____________________`, { size: S, after: 0 }),
  ];
}

const LINE = 207; // висота рядка 9 пт у twips
const NAME_CHARS_PER_LINE = 50;
const FIXED_HEIGHT = 3750; // заголовок, реквізити, відступи, підсумки, підписи одного примірника
const HALF_PAGE = 7500; // доступно під один примірник, коли два стоять на одному аркуші

// Два примірники на одному аркуші (для розрізання) лише якщо вони вміщаються; інакше кожен на своїй сторінці.
export function fitsTwoOnPage(data: DocData): boolean {
  const rows = data.items.reduce((h, it) => h + Math.ceil(it.name.length / NAME_CHARS_PER_LINE) * LINE + 100, 340);
  return FIXED_HEIGHT + rows <= HALF_PAGE;
}

export async function generateWaybill(data: DocData): Promise<Buffer> {
  // пунктир із тексту, бо порожній абзац із рамкою не всі програми показують
  const cutLine = new Paragraph({
    children: [new TextRun({ text: "- ".repeat(88).trim(), font: FONT, size: 16, color: "808080" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
  const divider = fitsTwoOnPage(data) ? cutLine : new Paragraph({ children: [new PageBreak()] });
  const doc = new Document({
    sections: [{ properties: { page: PAGE }, children: [...block(data), divider, ...block(data)] }],
  });
  return Packer.toBuffer(doc);
}
