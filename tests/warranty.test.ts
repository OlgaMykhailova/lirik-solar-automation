import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { FOPS } from "../src/data/fop.js";
import { fillWarranty, generateWarranty } from "../src/generators/warranty.js";
import { WARRANTY_TEMPLATE_B64 } from "../src/generators/warranty-template.js";
import { priceItems } from "../src/utils/money.js";

const data = (items = [{ name: "Інвертор Deye", qty: 1, priceUsd: "100" }]) => ({
  fop: FOPS.drizhenko,
  number: "04-11-10",
  date: new Date("2026-11-04T10:00:00Z"),
  items: priceItems(items, "41"),
});

async function templateXml(): Promise<string> {
  const zip = await JSZip.loadAsync(Buffer.from(WARRANTY_TEMPLATE_B64, "base64"));
  return zip.file("word/document.xml")!.async("string");
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("гарантійний талон", () => {
  it("вбудований шаблон збігається з templates/warranty.docx", () => {
    const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    expect(hash(Buffer.from(WARRANTY_TEMPLATE_B64, "base64"))).toBe(hash(readFileSync("templates/warranty.docx")));
  });

  it("підставляє номер, дату за Києвом і покупця", async () => {
    const xml = fillWarranty(await templateXml(), data());
    expect(xml).toContain("Гарантійний талон № 04-11-10</w:t>");
    expect(xml).toContain("04.11.2026 р.");
    expect(xml).not.toContain("12.10.2026");
    expect(xml).toContain("Кінцевий споживач");
    expect(xml).toContain("60</w:t>");
  });

  it("робить по рядку на кожну позицію, додає кількість і екранує спецсимволи", async () => {
    const items = [
      { name: "Інвертор Deye <8K> & \"Pro\"", qty: 1, priceUsd: "100" },
      { name: "Батарея", qty: 4, priceUsd: "50" },
      { name: "Автомат", qty: 2, priceUsd: "5" },
    ];
    const original = await templateXml();
    const xml = fillWarranty(original, data(items));
    expect(xml).toContain("Інвертор Deye &lt;8K&gt; &amp; &quot;Pro&quot;");
    expect(xml).toContain("Батарея, 4 шт.");
    expect(xml).toContain("Автомат, 2 шт.");
    expect(xml).not.toContain("Батарея, 1 шт.");
    expect(xml).not.toContain("Гібридний сонячний інвертор ");
    expect(xml).not.toContain("Акумуляторна батарея ");
    expect(count(xml, /<w:tr[ >]/g)).toBe(count(original, /<w:tr[ >]/g) - 2 + 3);
  });

  it("залишає XML збалансованим, а картинки й текст умов збереженими", async () => {
    const buf = await generateWarranty(data([{ name: "A", qty: 1, priceUsd: "1" }, { name: "B", qty: 1, priceUsd: "1" }, { name: "C", qty: 1, priceUsd: "1" }]));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const [open, close] of [[/<w:tr[ >]/g, /<\/w:tr>/g], [/<w:tc>/g, /<\/w:tc>/g], [/<w:p[ >]/g, /<\/w:p>/g], [/<w:tbl>/g, /<\/w:tbl>/g]] as const) {
      expect(count(xml, open)).toBe(count(xml, close));
    }
    expect(Object.keys(zip.files).filter((n) => n.startsWith("word/media/"))).toHaveLength(3);
    const original = await templateXml();
    const tail = (x: string) => x.slice(x.indexOf("</w:tbl>"));
    expect(tail(xml)).toBe(tail(original));
  });

  it("явно падає, якщо в шаблоні зникло потрібне місце", async () => {
    const broken = (await templateXml()).replace("<w:t>Гарантійний талон</w:t>", "<w:t>Інше</w:t>");
    expect(() => fillWarranty(broken, data())).toThrow(/Шаблон гарантійного талона змінився/);
  });
});
