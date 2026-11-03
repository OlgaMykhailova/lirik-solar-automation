const ONES_M = ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const ONES_F = ["", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const TEENS = ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"];
const TENS = ["", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто"];
const HUNDREDS = ["", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот"];

const MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

function triad(n: number, feminine: boolean): string {
  const ones = feminine ? ONES_F : ONES_M;
  const parts: string[] = [];
  parts.push(HUNDREDS[Math.floor(n / 100)] ?? "");
  const rest = n % 100;
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10] ?? "");
  } else {
    parts.push(TENS[Math.floor(rest / 10)] ?? "");
    parts.push(ones[rest % 10] ?? "");
  }
  return parts.filter(Boolean).join(" ");
}

function plural(n: number, one: string, few: string, many: string): string {
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function integerToWords(n: number, feminine = true): string {
  if (n === 0) return "нуль";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(triad(millions, false), plural(millions, "мільйон", "мільйони", "мільйонів"));
  }
  if (thousands) {
    parts.push(triad(thousands, true), plural(thousands, "тисяча", "тисячі", "тисяч"));
  }
  if (rest) parts.push(triad(rest, feminine));
  return parts.join(" ");
}

export function amountInWords(kop: number): string {
  const grn = Math.floor(kop / 100);
  const k = String(kop % 100).padStart(2, "0");
  const words = `${integerToWords(grn)} ${plural(grn, "гривня", "гривні", "гривень")} ${k} копійок`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface DateParts {
  day: string;
  month: string;
  monthGen: string;
  year: string;
}

export function kyivDateParts(date: Date): DateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const get = (t: string) => fmt.formatToParts(date).find((p) => p.type === t)?.value ?? "";
  const month = get("month");
  return { day: get("day"), month, monthGen: MONTHS_GEN[Number(month) - 1] ?? "", year: get("year") };
}

export function longDate(date: Date): string {
  const d = kyivDateParts(date);
  return `${d.day} ${d.monthGen} ${d.year} р.`;
}
