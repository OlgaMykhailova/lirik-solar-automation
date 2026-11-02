import { mkdirSync, writeFileSync } from "node:fs";
import { FOPS } from "../src/data/fop.js";
import { generateInvoice } from "../src/generators/invoice.js";
import { generateWaybill } from "../src/generators/waybill.js";
import { priceItems } from "../src/utils/money.js";

mkdirSync("out", { recursive: true });
const items = priceItems(
  [
    { name: "Гібридний сонячний інвертор Deye SUN-6K-SG05LP1-EU-AM2-P (6 кВт, 1 фаза, 2 MPPT)", qty: 1, priceUsd: "1150" },
    { name: "Акумуляторна батарея Deye SE-F16 (LiFePo4 51,2В 314Аг 16 кВт*г)", qty: 2, priceUsd: "2460.50" },
  ],
  "41.7",
);
for (const fop of Object.values(FOPS)) {
  const data = { fop, number: "06-02-10", date: new Date(), items };
  writeFileSync(`out/invoice-${fop.id}.docx`, await generateInvoice(data));
  writeFileSync(`out/waybill-${fop.id}.docx`, await generateWaybill(data));
}
console.log("ok");
