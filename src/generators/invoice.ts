import { AlignmentType, Document, Packer, TableRow } from "docx";
import { CUSTOMER } from "../data/fop.js";
import type { DocData } from "../types.js";
import { formatKop, totalKop } from "../utils/money.js";
import { amountInWords, longDate } from "../utils/words.js";
import { PAGE, cell, para, run, scaleWidths, table } from "./shared.js";

const NOTICE =
  "Увага! Оплата цього рахунку означає погодження з умовами поставки товарів. Повідомлення про оплату є обов'язковим, в іншому випадку не гарантується наявність товарів на складі. Товар відпускається за фактом надходження коштів на п/р Постачальника, самовивозом, за наявності довіренності та паспорта.";

export async function generateInvoice(data: DocData): Promise<Buffer> {
  const { fop, items } = data;
  const total = totalKop(items);
  const totalText = formatKop(total);
  const nameUpper = fop.fullName.toUpperCase();
  const fopLine = `ФІЗИЧНА ОСОБА - ПІДПРИЄМЕЦЬ ${fop.fullName}`;

  const payW = scaleWidths([60, 40]);
  const payment = table(payW, [
    new TableRow({
      children: [
        cell(`Отримувач\nФІЗИЧНА ОСОБА - ПІДПРИЄМЕЦЬ ${nameUpper}`, payW[0]!, 20),
        cell(`Код ${fop.taxId}`, payW[1]!, 20),
      ],
    }),
    new TableRow({
      children: [
        cell(`Банк отримувача: ${fop.bank}`, payW[0]!, 20),
        cell(`КРЕДИТ рах. № ${fop.iban}`, payW[1]!, 20),
      ],
    }),
  ]);

  const w = scaleWidths([4, 35, 13, 13, 17, 18]);
  const head = ["№", "Товар", "Кількість, шт", "Од.виміру", "Ціна без ПДВ, грн", "Сума без ПДВ, грн"];
  const rows = [
    new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, w[i]!, 20, { bold: true, align: AlignmentType.CENTER })) }),
    ...items.map(
      (it, idx) =>
        new TableRow({
          children: [
            cell(String(idx + 1), w[0]!, 20, { align: AlignmentType.CENTER }),
            cell(it.name, w[1]!, 20),
            cell(String(it.qty), w[2]!, 20, { align: AlignmentType.CENTER }),
            cell("шт.", w[3]!, 20, { align: AlignmentType.CENTER }),
            cell(formatKop(it.priceKop), w[4]!, 20, { align: AlignmentType.RIGHT }),
            cell(formatKop(it.sumKop), w[5]!, 20, { align: AlignmentType.RIGHT }),
          ],
        }),
    ),
  ];

  const phone = fop.phone ? `, тел. ${fop.phone}` : "";
  const doc = new Document({
    sections: [
      {
        properties: { page: PAGE },
        children: [
          para(NOTICE, { size: 18, after: 160 }),
          payment,
          para(`Рахунок на оплату № ${data.number} від ${longDate(data.date)}`, { size: 28, bold: true, before: 240, after: 160 }),
          para([run("Виконавець: ", 22, true), run(fopLine, 22)]),
          para(`Ідентифікаційний номер ${fop.taxId}${phone}`, { size: 22 }),
          para(`п/р ${fop.iban} у банку ${fop.bank}`, { size: 22 }),
          para([run("Замовник: ", 22, true), run(CUSTOMER, 22)], { after: 360 }),
          table(w, rows),
          para([run(`Всього, без ПДВ: ${totalText}`, 22, true)], { align: AlignmentType.RIGHT, before: 120 }),
          para(`Всього найменувань ${items.length} шт, на ${totalText} грн.`, { size: 22, before: 120, after: 0 }),
          para(`( ${amountInWords(total)} )`, { size: 22, bold: true, after: 360 }),
          para(`Виписав            _______________  ${fop.signature}`, { size: 22 }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
