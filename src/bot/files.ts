import type { Redis } from "@upstash/redis";
import type { FileStore } from "./telegram.js";

const TTL_SECONDS = 15 * 60;

export class RedisFileStore implements FileStore {
  constructor(private redis: Redis) {}
  async put(id: string, file: Buffer) {
    await this.redis.set(`file:${id}`, file.toString("base64"), { ex: TTL_SECONDS });
  }
  async get(id: string) {
    const v = await this.redis.get<string>(`file:${id}`);
    return typeof v === "string" ? Buffer.from(v, "base64") : null;
  }
}

export class MemoryFileStore implements FileStore {
  m = new Map<string, Buffer>();
  async put(id: string, file: Buffer) { this.m.set(id, file); }
  async get(id: string) { return this.m.get(id) ?? null; }
}
