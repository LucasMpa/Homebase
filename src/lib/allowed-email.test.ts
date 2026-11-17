import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPublicPath, PUBLIC_PATHS } from "@/lib/allowed-email";

const PUBLIC_DIR = fileURLToPath(new URL("../app/(public)", import.meta.url));

describe("PUBLIC_PATHS", () => {
  it("acompanha as pastas de src/app/(public)", () => {
    const folders = readdirSync(PUBLIC_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const listed = [...new Set(PUBLIC_PATHS.map((p) => p.split("/")[1]))].sort();
    expect(listed).toEqual(folders);
  });

  it("libera só as rotas públicas e o que fica abaixo delas", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/share/abc")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/sharex")).toBe(false);
    expect(isPublicPath("/share-foo")).toBe(false);
    expect(isPublicPath("/auth")).toBe(false);
    expect(isPublicPath("/third-party")).toBe(false);
  });
});
