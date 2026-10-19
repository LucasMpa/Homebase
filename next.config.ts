import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components desligado de propósito: todo o app é autenticado e de um
  // único usuário, então não há shell estático que valha cachear; renderização
  // dinâmica por requisição é mais simples e evita vazar dados entre sessões.
  poweredByHeader: false,
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
