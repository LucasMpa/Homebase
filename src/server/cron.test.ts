import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { appBaseUrl, isAuthorizedCron } = await import("./cron");

const secret = "s".repeat(40);

describe("isAuthorizedCron", () => {
  it("aceita só o Bearer com o segredo exato", () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCron(`bearer ${secret}`, secret)).toBe(false);
    expect(isAuthorizedCron(secret, secret)).toBe(false);
    expect(isAuthorizedCron(null, secret)).toBe(false);
  });

  it("sem segredo configurado (ou curto demais), recusa tudo", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer curto", "curto")).toBe(false);
  });
});

describe("appBaseUrl", () => {
  it("APP_URL > domínio de produção da Vercel > origem da requisição", () => {
    expect(appBaseUrl({ APP_URL: "https://casa.dev/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }, "http://a")).toBe(
      "https://casa.dev",
    );
    expect(appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "homebase.vercel.app" }, "http://a")).toBe(
      "https://homebase.vercel.app",
    );
    expect(appBaseUrl({}, "http://localhost:3000/")).toBe("http://localhost:3000");
  });
});
