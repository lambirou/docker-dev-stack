# syntax=docker/dockerfile:1

# Contrairement au portail, l'image finale n'est pas un nginx : Studio a besoin d'un
# backend qui parle à Postgres, donc le même processus Node sert le bundle et le BFF.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Seules les dépendances de production : ni Vite ni esbuild n'ont de raison d'être
# dans l'image finale, le bundle est déjà construit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

# Le processus tourne sous l'utilisateur node, présent dans l'image officielle : un
# serveur exposé n'a pas besoin de root, et cette console parle à la base.
USER node

EXPOSE 5555

# Docker n'a alors plus à deviner l'état du service : la sonde interroge Postgres,
# donc un conteneur sain garantit que la console est réellement utilisable.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5555/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
