import { describe, expect, it } from "vitest";
import app from "../src/index.js";

const get = (path: string) => app.fetch(new Request(`https://x.test${path}`));

describe("публічні сторінки для Google OAuth", () => {
  it("головна сторінка описує застосунок і веде на політику", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Lirik Solar Documents Bot");
    expect(html).toContain('href="/privacy"');
  });

  it("політика конфіденційності згадує scope, Limited Use і зберігання", async () => {
    const html = await (await get("/privacy")).text();
    expect(html).toContain("drive.file");
    expect(html).toContain("Limited Use");
    expect(html).toContain("Google API Services User Data Policy");
    expect(html).toContain("Privacy Policy");
  });

  it("контактна пошта береться зі змінної середовища", async () => {
    const prev = process.env.CONTACT_EMAIL;
    process.env.CONTACT_EMAIL = "owner@example.com";
    try {
      expect(await (await get("/privacy")).text()).toContain("mailto:owner@example.com");
    } finally {
      if (prev === undefined) delete process.env.CONTACT_EMAIL; else process.env.CONTACT_EMAIL = prev;
    }
    expect(await (await get("/privacy")).text()).not.toContain("mailto:");
  });
});
