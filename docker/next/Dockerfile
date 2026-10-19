# Imagem de desenvolvimento: o código entra por bind mount (ver docker-compose.yml).
FROM node:24-bookworm-slim

RUN npm install -g pnpm@11.24.0

# Pontos de montagem dos volumes nomeados, criados com o dono certo para o
# Docker copiar as permissões ao inicializar cada volume.
RUN mkdir -p /app/node_modules /app/.next /home/node/.local/share/pnpm/store \
  && chown -R node:node /app /home/node/.local

USER node
WORKDIR /app
EXPOSE 3000
