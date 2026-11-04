import { Redis } from "@upstash/redis";
import type { DocType, FopId, Item } from "../types.js";

type Step = "name" | "qty" | "price" | "more" | "rate" | "warranty" | "confirm";

export interface Session {
  step: Step;
  docType: DocType;
  fopId: FopId;
  items: Item[];
  draftName?: string;
  draftQty?: number;
  rate?: string;
  warranty?: boolean;
}

export interface SessionStore {
  get(userId: number): Promise<Session | null>;
  set(userId: number, s: Session): Promise<void>;
  clear(userId: number): Promise<void>;
  seenUpdate(updateId: number): Promise<boolean>;
}

const TTL = 24 * 3600;

export function createRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Не задано змінні Redis (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)");
  return new Redis({ url, token });
}

export class RedisSessionStore implements SessionStore {
  constructor(private redis: Redis) {}
  async get(userId: number) {
    return (await this.redis.get<Session>(`session:${userId}`)) ?? null;
  }
  async set(userId: number, s: Session) {
    await this.redis.set(`session:${userId}`, s, { ex: TTL });
  }
  async clear(userId: number) {
    await this.redis.del(`session:${userId}`);
  }
  async seenUpdate(updateId: number) {
    const res = await this.redis.set(`update:${updateId}`, 1, { nx: true, ex: 3600 });
    return res === null;
  }
}
