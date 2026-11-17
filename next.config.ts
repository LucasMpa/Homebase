import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components desligado de propósito: todo o app é autenticado e de um
  // único usuário, então não há shell estático que valha cachear; renderização
  // dinâmica por requisição é mais simples e evita vazar dados entre sessões.
  poweredByHeader: false,
  // Links públicos (/share/<token>): o token está na URL, então nada de Referer,
  // cache compartilhado ou indexação por buscadores.
  async headers() {
    return [
      {
        source: "/share/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  // As rotas eram em português; os endereços antigos (favoritos, histórico) continuam funcionando.
  async redirects() {
    const renamed: [string, string][] = [
      ["/relatorios", "/reports"],
      ["/mes", "/"],
      ["/month", "/"],
      ["/lancamentos/novo", "/transactions/new"],
      ["/lancamentos/:id/editar", "/transactions/:id/edit"],
      ["/lancamentos", "/transactions"],
      ["/contas/nova", "/bills/new"],
      ["/contas/:id/editar", "/bills/:id/edit"],
      ["/contas/:id", "/bills/:id"],
      ["/contas", "/bills"],
      ["/terceiros/novo", "/third-party/new"],
      ["/terceiros/:id/editar", "/third-party/:id/edit"],
      ["/terceiros", "/third-party"],
      ["/acesso-negado", "/access-denied"],
    ];
    return renamed.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
