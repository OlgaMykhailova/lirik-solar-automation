import type { Item, PricedItem } from "../types.js";

export function parseDecimal(input: string, maxDecimals: number): number | null {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [, frac = ""] = s.split(".");
  if (frac.length > maxDecimals) return null;
  return Math.round(Number(s) * 10 ** maxDecimals);
}

export function parseQty(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

// priceUsd і rate парсяться як цілі (центи та 1/10000), щоб уникнути похибок float
export function priceInKop(priceUsd: string, rate: string): number | null {
  const cents = parseDecimal(priceUsd, 2);
  const rateE4 = parseDecimal(rate, 4);
  if (cents === null || rateE4 === null || cents === 0 || rateE4 === 0) return null;
  return Math.floor((cents * rateE4 * 2 + 10000) / 20000);
}

export function priceItems(items: Item[], rate: string): PricedItem[] {
  return items.map((it) => {
    const priceKop = priceInKop(it.priceUsd, rate);
    if (priceKop === null) throw new Error(`Некоректна ціна або курс: ${it.priceUsd} / ${rate}`);
    return { name: it.name, qty: it.qty, priceKop, sumKop: priceKop * it.qty };
  });
}

export function totalKop(items: PricedItem[]): number {
  return items.reduce((a, i) => a + i.sumKop, 0);
}

export function formatKop(kop: number): string {
  const grn = Math.floor(kop / 100);
  const k = String(kop % 100).padStart(2, "0");
  const grouped = String(grn).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${k}`;
}
