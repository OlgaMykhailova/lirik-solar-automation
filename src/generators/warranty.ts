import JSZip from "jszip";
import { CUSTOMER } from "../data/fop.js";
import type { DocData, PricedItem } from "../types.js";
import { kyivDateParts } from "../utils/words.js";
import { WARRANTY_TEMPLATE_B64 } from "./warranty-template.js";

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function must(index: number, what: string): number {
  if (index < 0) throw new Error(`Шаблон гарантійного талона змінився: не знайдено ${what}`);
  return index;
}

function paragraphBounds(xml: string, marker: string): [number, number] {
  const at = must(xml.indexOf(marker), `«${marker}»`);
  const start = must(xml.lastIndexOf("<w:p ", at), `початок абзацу з «${marker}»`);
  const end = must(xml.indexOf("</w:p>", at), `кінець абзацу з «${marker}»`) + "</w:p>".length;
  return [start, end];
}

function itemRow(item: PricedItem): string {
  const rpr = '<w:rPr><w:color w:val="000000"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr>';
  const text = item.qty > 1 ? `${item.name}, ${item.qty} шт.` : item.name;
  const name = `<w:p><w:pPr><w:pStyle w:val="NormalWeb"/>${rpr}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  const serial = '<w:p><w:pPr><w:pStyle w:val="NormalWeb"/></w:pPr></w:p>';
  return (
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="8349" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>${name}</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="2367" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${serial}</w:tc></w:tr>`
  );
}

export function fillWarranty(xml: string, data: DocData): string {
  const d = kyivDateParts(data.date);

  const title = "<w:t>Гарантійний талон</w:t>";
  must(xml.indexOf(title), "заголовка «Гарантійний талон»");
  let out = xml.replace(title, `<w:t>Гарантійний талон № ${escapeXml(data.number)}</w:t>`);

  const [ds, de] = paragraphBounds(out, "<w:t>Дата:</w:t>");
  out =
    out.slice(0, ds) +
    '<w:p><w:pPr><w:pStyle w:val="NormalWeb"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Дата: </w:t></w:r>' +
    `<w:r><w:t>${d.day}.${d.month}.${d.year} р.</w:t></w:r></w:p>` +
    out.slice(de);

  const [, be] = paragraphBounds(out, "<w:t>Покупець</w:t>");
  const buyerEnd = be - "</w:p>".length;
  out = out.slice(0, buyerEnd) + `<w:r><w:t>${escapeXml(CUSTOMER)}</w:t></w:r>` + out.slice(buyerEnd);

  const first = must(out.indexOf("Гібридний сонячний інвертор "), "першого рядка обладнання");
  const rowStart = must(out.lastIndexOf("<w:tr ", first), "початку рядка обладнання");
  const last = must(out.indexOf("Акумуляторна батарея ", first), "останнього рядка обладнання");
  const rowEnd = must(out.indexOf("</w:tr>", last), "кінця рядка обладнання") + "</w:tr>".length;
  return out.slice(0, rowStart) + data.items.map(itemRow).join("") + out.slice(rowEnd);
}

export async function generateWarranty(data: DocData): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(WARRANTY_TEMPLATE_B64, "base64"));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("У шаблоні гарантійного талона немає word/document.xml");
  const xml = await file.async("string");
  zip.file("word/document.xml", fillWarranty(xml, data));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
