import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseAddress, sendEmail } = await import("./email");

const message = { to: "eu@example.com", subject: "Assunto", html: "<p>oi</p>", text: "oi" };

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("parseAddress", () => {
  it("separa nome e e-mail", () => {
    expect(parseAddress("Homebase <a@b.com>")).toEqual({ name: "Homebase", email: "a@b.com" });
    expect(parseAddress(" a@b.com ")).toEqual({ email: "a@b.com" });
  });
});

describe("sendEmail", () => {
  it("usa o Resend quando há RESEND_API_KEY (mesmo com MAILPIT_URL)", async () => {
    const fetch = mockFetch(200, { id: "re_123" });
    const sent = await sendEmail(message, { RESEND_API_KEY: "re_key", MAILPIT_URL: "http://mailpit:8025" });
    expect(sent).toEqual({ provider: "resend", id: "re_123" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Homebase <onboarding@resend.dev>",
      to: ["eu@example.com"],
      subject: "Assunto",
      html: "<p>oi</p>",
      text: "oi",
    });
  });

  it("respeita EMAIL_FROM", async () => {
    const fetch = mockFetch(200, { id: "re_1" });
    await sendEmail(message, { RESEND_API_KEY: "k", EMAIL_FROM: "Casa <avisos@casa.dev>" });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).from).toBe("Casa <avisos@casa.dev>");
  });

  it("erro do Resend vira exceção com o motivo", async () => {
    mockFetch(422, { message: "domínio não verificado" });
    await expect(sendEmail(message, { RESEND_API_KEY: "k" })).rejects.toThrow(/422.*domínio não verificado/);
  });

  it("sem Resend, usa o Mailpit", async () => {
    const fetch = mockFetch(200, { ID: "mp1" });
    const sent = await sendEmail(message, { MAILPIT_URL: "http://mailpit:8025/" });
    expect(sent).toEqual({ provider: "mailpit", id: "mp1" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://mailpit:8025/api/v1/send");
    expect(JSON.parse(init.body as string)).toMatchObject({
      From: { Email: "onboarding@resend.dev", Name: "Homebase" },
      To: [{ Email: "eu@example.com" }],
      Subject: "Assunto",
    });
  });

  it("sem nenhum envio configurado, falha", async () => {
    await expect(sendEmail(message, {})).rejects.toThrow(/RESEND_API_KEY|MAILPIT_URL/);
  });
});
