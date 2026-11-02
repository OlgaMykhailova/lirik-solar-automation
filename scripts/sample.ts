import { mkdirSync, writeFileSync } from "node:fs";
import { FOPS } from "../src/data/fop.js";
import { generateInvoice } from "../src/generators/invoice.js";
import { generateWaybill } from "../src/generators/waybill.js";
import { priceItems } from "../src/utils/money.js";

mkdirSync("out", { recursive: true });
const all = [
  { name: "Гібридний сонячний інвертор Deye SUN-6K-SG05LP1-EU-AM2-P (6 кВт, 1 фаза, 2 MPPT)", qty: 1, priceUsd: "1150" },
  { name: "Акумуляторна батарея Deye SE-F16 (LiFePo4 51,2В 314Аг 16 кВт*г)", qty: 2, priceUsd: "2460.50" },
  { name: "Кабель сонячний 6 мм2 червоний", qty: 100, priceUsd: "1.2" },
  { name: "Роз'єм MC4 (пара)", qty: 20, priceUsd: "2" },
  { name: "Автоматичний вимикач 63А двополюсний", qty: 2, priceUsd: "14" },
  { name: "Гібридний сонячний інвертор Deye SUN-8K-SG05LP1-EU (8 кВт, 1 фаза, 2 MPPT) розширений комплект", qty: 1, priceUsd: "1500" },
  { name: "Монтажний комплект на дах", qty: 4, priceUsd: "90" },
  { name: "Сонячна панель JA Solar 550 Вт", qty: 12, priceUsd: "95" },
];
for (const n of [2, 5, 8]) {
  const items = priceItems(all.slice(0, n), "41.7");
  const data = { fop: FOPS.neskhodovskyi, number: "06-02-10", date: new Date(), items };
  writeFileSync(`out/waybill-${n}.docx`, await generateWaybill(data));
  writeFileSync(`out/invoice-${n}.docx`, await generateInvoice(data));
}
console.log("ok");
