import { Redis } from "@upstash/redis";
import type { CounterType, FopId } from "../types.js";
import { kyivDateParts } from "../utils/words.js";

const FIRST_NUMBER = 10;

export interface CounterStore {
  next(key: string): Promise<number>;
}

function counterKey(fop: FopId, type: CounterType, date: Date): string {
  const d = kyivDateParts(date);
  return `counter:${fop}:${type}:${d.year}-${d.month}-${d.day}`;
}

export function formatDocNumber(date: Date, seq: number): string {
  const d = kyivDateParts(date);
  return `${d.day}-${d.month}-${seq}`;
}

export async function nextDocNumber(store: CounterStore, fop: FopId, type: CounterType, date: Date): Promise<string> {
  const seq = await store.next(counterKey(fop, type, date));
  return formatDocNumber(date, seq);
}

export class MemoryCounterStore implements CounterStore {
  private m = new Map<string, number>();
  async next(key: string): Promise<number> {
    const v = this.m.get(key) ?? FIRST_NUMBER - 1;
    this.m.set(key, v + 1);
    return v + 1;
  }
}

export class RedisCounterStore implements CounterStore {
  constructor(private redis: Redis) {}
  async next(key: string): Promise<number> {
    // NX: ініціалізуємо 9 лише якщо ключа ще немає, тож перший INCR дає 10
    await this.redis.set(key, FIRST_NUMBER - 1, { nx: true, ex: 3 * 24 * 3600 });
    return this.redis.incr(key);
  }
}
